"""Vues API pour les courses — cœur du système de négociation."""
import logging

from django.contrib.gis.geos import Point
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.rides.models import Ride, RideOffer, RideRequest
from apps.rides.services.matching_service import find_eligible_drivers
from apps.rides.services.pricing_service import (
    calculate_distance_geodesic,
    calculate_suggested_price,
    get_price_estimate,
    validate_offer_price,
    validate_proposed_price,
)
from apps.rides.services.ride_lifecycle_service import (
    RideLifecycleError,
    accept_offer,
    cancel_ride,
    update_ride_status,
)
from core.config_service import get_config_int
from core.permissions import IsDriver, IsPassenger, IsPassengerOrDriver

from .serializers import (
    AcceptOfferSerializer,
    CancelRideSerializer,
    PriceEstimateSerializer,
    RideHistorySerializer,
    RideOfferCreateSerializer,
    RideOfferResponseSerializer,
    RideRequestCreateSerializer,
    RideRequestSerializer,
    RideSerializer,
    RideStatusUpdateSerializer,
)

logger = logging.getLogger(__name__)


class PriceEstimateView(APIView):
    """POST /api/rides/estimate — Estimation de prix pour une course."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PriceEstimateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        pickup = Point(data['pickup_lng'], data['pickup_lat'], srid=4326)
        dropoff = Point(data['dropoff_lng'], data['dropoff_lat'], srid=4326)

        estimate = get_price_estimate(pickup, dropoff, data['vehicle_type'])
        return Response(estimate)


class ActiveRideRequestView(APIView):
    """GET /api/rides/requests/active — Demande de course en cours du passager."""
    permission_classes = [IsAuthenticated, IsPassenger]

    def get(self, request):
        active = RideRequest.objects.filter(
            passenger=request.user,
            status__in=['pending', 'offers_received']
        ).order_by('-created_at').first()
        if not active:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(RideRequestSerializer(active).data)


class NearbyRideRequestsView(APIView):
    """GET /api/rides/requests/nearby — Demandes de course à proximité du chauffeur.

    Polling toutes les 5s par le chauffeur pour voir les nouvelles demandes.
    Remplace le WebSocket quand celui-ci n'est pas disponible.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        from django.contrib.gis.measure import D

        try:
            driver = request.user.driver_profile
        except Exception:
            return Response([])

        if not driver.is_online:
            return Response([])

        # Demandes en cours non expirées
        # Exclure uniquement les demandes où le chauffeur a une offre pending ou accepted
        # (pas rejected — le chauffeur peut revoir une demande après rejet)
        from apps.rides.models import RideOffer as RO
        already_offered_ids = RO.objects.filter(
            driver=driver,
            status__in=['pending', 'accepted'],
        ).values_list('ride_request_id', flat=True)

        requests_qs = RideRequest.objects.filter(
            status__in=['pending', 'offers_received'],
            expires_at__gt=timezone.now(),
        ).exclude(
            id__in=already_offered_ids,
        ).select_related('passenger')

        # Filtre géographique seulement si le chauffeur a une position GPS
        if driver.current_location:
            radius_m = get_config_int('default_search_radius_m', 50000)  # 50km par défaut pour tests
            requests_qs = requests_qs.filter(
                pickup_location__distance_lte=(driver.current_location, D(m=radius_m)),
            )
        # Pas de filtre véhicule strict — montrer toutes les demandes
        # Le chauffeur voit tout et décide lui-même

        requests_qs = requests_qs.order_by('-created_at')[:10]

        results = []
        for r in requests_qs:
            distance_m = 0
            if driver.current_location and r.pickup_location:
                try:
                    from django.contrib.gis.db.models.functions import Distance as DistFunc
                    annotated = Driver.objects.filter(id=driver.id).annotate(
                        d=DistFunc('current_location', r.pickup_location)
                    ).first()
                    if annotated and annotated.d:
                        distance_m = annotated.d.m
                except Exception:
                    pass

            results.append({
                'id': str(r.id),
                'pickup_address': r.pickup_address,
                'dropoff_address': r.dropoff_address,
                'proposed_price': r.proposed_price,
                'suggested_price': r.suggested_price,
                'vehicle_type': r.vehicle_type,
                'luggage_type': getattr(r, 'luggage_type', 'none'),
                'estimated_distance_m': r.estimated_distance_m,
                'passenger_name': f"{r.passenger.first_name} {r.passenger.last_name[0]}.",
                'passenger_avatar': r.passenger.avatar_url or '',
                'expires_at': r.expires_at.isoformat(),
                'distance_to_pickup_m': int(distance_m),
            })

        return Response(results)


class RideRequestCreateView(APIView):
    """POST /api/rides/requests — Créer une demande de course."""
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request):
        serializer = RideRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = request.user

        # Vérifier la dette d'annulation
        if user.has_unpaid_cancellation:
            return Response(
                {'error': f'Vous avez des frais d\'annulation impayés de {user.cancellation_debt} XOF. Réglez-les avant de commander.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Vérifier qu'il n'a pas déjà une demande active
        active_request = RideRequest.objects.filter(
            passenger=user,
            status__in=['pending', 'offers_received']
        ).exists()
        if active_request:
            return Response(
                {'error': 'Vous avez déjà une demande de course en cours.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        pickup = Point(data['pickup_lng'], data['pickup_lat'], srid=4326)
        dropoff = Point(data['dropoff_lng'], data['dropoff_lat'], srid=4326)

        # Calculer la distance et le prix indicatif
        distance_m = calculate_distance_geodesic(pickup, dropoff)
        suggested_price = calculate_suggested_price(distance_m, data['vehicle_type'])

        # Valider le prix proposé
        validation = validate_proposed_price(
            data['proposed_price'], suggested_price, data['vehicle_type']
        )
        if not validation['valid']:
            return Response(
                {'error': validation['error']},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Valider le code promo s'il est fourni (erreur explicite au passager)
        promo_code = (data.get('promo_code') or '').strip().upper()
        if promo_code:
            from apps.accounts.services.promo_service import PromoError, validate_promo_for_user
            try:
                validate_promo_for_user(promo_code, user, data['proposed_price'])
            except PromoError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Créer la demande
        search_radius = get_config_int('default_search_radius_m', 3000)
        max_drivers = get_config_int('max_drivers_notified', 10)
        ttl = get_config_int('ride_request_ttl_s', 300)

        ride_request = RideRequest.objects.create(
            passenger=user,
            pickup_location=pickup,
            pickup_address=data.get('pickup_address', ''),
            dropoff_location=dropoff,
            dropoff_address=data.get('dropoff_address', ''),
            estimated_distance_m=distance_m,
            suggested_price=suggested_price,
            proposed_price=data['proposed_price'],
            vehicle_type=data['vehicle_type'],
            luggage_type=data.get('luggage_type', 'none'),
            promo_code=promo_code,
            search_radius_m=search_radius,
            max_drivers_notified=max_drivers,
            expires_at=timezone.now() + timezone.timedelta(seconds=ttl),
        )

        # Rechercher et notifier les chauffeurs (non bloquant)
        preferred_driver_id = data.get('preferred_driver_id')
        try:
            if preferred_driver_id:
                # Chauffeur spécifique choisi par le passager
                from apps.drivers.models import Driver as DriverModel
                try:
                    preferred = DriverModel.objects.get(id=preferred_driver_id, is_online=True)
                    eligible = [{'driver': preferred}]
                except DriverModel.DoesNotExist:
                    eligible = []
            else:
                eligible = find_eligible_drivers(
                    pickup_location=pickup,
                    vehicle_type=data['vehicle_type'],
                    radius_m=search_radius,
                    max_drivers=max_drivers,
                )

            ride_request.notified_count = len(eligible)
            ride_request.save(update_fields=['notified_count'])

            if eligible:
                from apps.rides.tasks import notify_drivers_of_request
                try:
                    notify_drivers_of_request.delay(
                        str(ride_request.id),
                        [str(d['driver'].id) for d in eligible]
                    )
                except Exception as e:
                    logger.warning(f"Notification Celery échouée (non bloquant): {e}")

                # Push + notification in-app aux chauffeurs (thread
                # d'arrière-plan : fonctionne sans Celery, sans latence API)
                from apps.notifications.services.notification_service import notify_users_async
                pickup_label = data.get('pickup_address', '') or 'Bissau'
                notify_users_async(
                    [d['driver'].user for d in eligible],
                    'new_request',
                    params={
                        'price': data['proposed_price'],
                        'pickup': pickup_label,
                    },
                    notification_type='ride_request',
                    data={'ride_request_id': str(ride_request.id)},
                )

            logger.info(
                f"Demande #{str(ride_request.id)[:8]} créée : "
                f"{data['proposed_price']} XOF, {len(eligible)} chauffeurs notifiés"
                f"{' (chauffeur préféré)' if preferred_driver_id else ''}"
            )
        except Exception as e:
            logger.warning(f"Recherche chauffeurs échouée (non bloquant): {e}")

        return Response(
            RideRequestSerializer(ride_request).data,
            status=status.HTTP_201_CREATED
        )


class RideRequestDetailView(APIView):
    """GET /api/rides/requests/<id> — Détails d'une demande."""
    permission_classes = [IsAuthenticated]

    def get(self, request, request_id):
        try:
            ride_request = RideRequest.objects.get(id=request_id, passenger=request.user)
        except RideRequest.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(RideRequestSerializer(ride_request).data)


class RideRequestCancelView(APIView):
    """POST /api/rides/requests/<id>/cancel — Annuler une demande."""
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request, request_id):
        try:
            ride_request = RideRequest.objects.get(id=request_id, passenger=request.user)
        except RideRequest.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if ride_request.status not in ('pending', 'offers_received'):
            return Response(
                {'error': 'Cette demande ne peut plus être annulée.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ride_request.status = 'cancelled'
        ride_request.cancelled_at = timezone.now()
        ride_request.save(update_fields=['status', 'cancelled_at', 'updated_at'])

        # Rejeter toutes les offres (capturer les chauffeurs concernés avant)
        pending_offers = RideOffer.objects.filter(
            ride_request=ride_request, status='pending'
        )
        offering_driver_ids = list(pending_offers.values_list('driver_id', flat=True))
        pending_offers.update(status='expired')

        # Notifier les chauffeurs qui avaient une offre en cours (non bloquant)
        try:
            from apps.rides.tasks import notify_request_cancelled
            notify_request_cancelled.delay(
                str(ride_request.id),
                [str(d) for d in offering_driver_ids],
            )
        except Exception:
            pass

        return Response({'status': 'cancelled'})


class RideRequestOffersView(APIView):
    """GET /api/rides/requests/<id>/offers — Voir les offres reçues."""
    permission_classes = [IsAuthenticated, IsPassenger]

    def get(self, request, request_id):
        try:
            ride_request = RideRequest.objects.get(id=request_id, passenger=request.user)
        except RideRequest.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        offers = ride_request.offers.filter(
            status='pending'
        ).order_by('offered_price')

        return Response(RideOfferResponseSerializer(offers, many=True).data)


class AcceptOfferView(APIView):
    """POST /api/rides/requests/<id>/accept-offer — Accepter une offre."""
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request, request_id):
        serializer = AcceptOfferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            ride_request = RideRequest.objects.get(id=request_id, passenger=request.user)
        except RideRequest.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        try:
            offer = RideOffer.objects.get(
                id=serializer.validated_data['offer_id'],
                ride_request=ride_request,
            )
        except RideOffer.DoesNotExist:
            return Response(
                {'error': 'Offre introuvable.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Capturer les chauffeurs perdants AVANT l'acceptation (leurs offres
        # passeront à 'rejected' dans accept_offer)
        losing_driver_ids = list(
            RideOffer.objects.filter(
                ride_request=ride_request, status='pending'
            ).exclude(id=offer.id).values_list('driver_id', flat=True)
        )

        try:
            ride = accept_offer(ride_request, offer)
        except RideLifecycleError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Notifier le chauffeur gagnant et les perdants (non bloquant)
        try:
            from apps.rides.tasks import notify_offer_accepted
            notify_offer_accepted.delay(
                str(ride.id),
                [str(d) for d in losing_driver_ids],
            )
        except Exception as e:
            logger.warning(f"Notification acceptation échouée (non bloquant): {e}")

        # Push + in-app au chauffeur gagnant (thread d'arrière-plan)
        from apps.notifications.services.notification_service import notify_user_async
        notify_user_async(
            ride.driver.user,
            'offer_accepted',
            params={'price': ride.agreed_price},
            notification_type='ride_status',
            data={'ride_id': str(ride.id)},
        )

        return Response(RideSerializer(ride).data, status=status.HTTP_201_CREATED)


class RejectOfferView(APIView):
    """POST /api/rides/requests/<id>/reject-offer — Passager refuse une offre."""
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request, request_id):
        offer_id = request.data.get('offer_id')
        if not offer_id:
            return Response({'error': 'offer_id requis.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            offer = RideOffer.objects.get(
                id=offer_id,
                ride_request_id=request_id,
                ride_request__passenger=request.user,
                status='pending',
            )
        except RideOffer.DoesNotExist:
            return Response({'error': 'Offre introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        offer.status = 'rejected'
        offer.save(update_fields=['status', 'updated_at'])

        logger.info(f"Offre {offer_id} rejetée par le passager")

        # Notifier le chauffeur (non bloquant)
        try:
            from apps.rides.tasks import notify_offer_rejected
            notify_offer_rejected.delay(str(offer.driver_id), str(request_id))
        except Exception:
            pass

        return Response({'status': 'rejected'})


class RideOfferCreateView(APIView):
    """POST /api/rides/offers — Chauffeur fait une offre."""
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        serializer = RideOfferCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            driver = request.user.driver_profile
        except Exception:
            return Response({'error': 'Profil chauffeur introuvable.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ride_request = RideRequest.objects.get(
                id=data['ride_request_id'],
                status__in=['pending', 'offers_received']
            )
        except RideRequest.DoesNotExist:
            return Response(
                {'error': 'Demande de course introuvable ou expirée.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Vérifier que le chauffeur n'a pas déjà une offre active (pending/accepted)
        existing = RideOffer.objects.filter(ride_request=ride_request, driver=driver)
        active_offer = existing.filter(status__in=['pending', 'accepted']).exists()
        if active_offer:
            return Response(
                {'error': 'Vous avez déjà fait une offre sur cette demande.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        # Supprimer les offres rejetées/expirées pour permettre une nouvelle
        existing.filter(status__in=['rejected', 'expired', 'withdrawn']).delete()

        try:
            # Valider le prix de l'offre
            validation = validate_offer_price(
                data['offered_price'],
                ride_request.proposed_price,
                ride_request.suggested_price,
                ride_request.vehicle_type,
            )
            if not validation['valid']:
                return Response(
                    {'error': validation['error']},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Calculer distance et ETA
            distance_m = 0
            eta_s = 0
            if driver.current_location:
                from apps.rides.services.pricing_service import calculate_distance_geodesic
                distance_m = calculate_distance_geodesic(
                    driver.current_location, ride_request.pickup_location
                )
                speed_ms = 20 * 1000 / 3600
                eta_s = int(distance_m / speed_ms)

            offer_ttl = get_config_int('ride_offer_ttl_s', 120)
            is_counter = data['offered_price'] != ride_request.proposed_price

            offer = RideOffer.objects.create(
                ride_request=ride_request,
                driver=driver,
                offered_price=data['offered_price'],
                is_counter_offer=is_counter,
                driver_distance_m=distance_m,
                estimated_arrival_s=eta_s,
                driver_rating=driver.average_rating,
                expires_at=timezone.now() + timezone.timedelta(seconds=offer_ttl),
            )

            # Mettre à jour le statut de la demande si c'est la première offre
            if ride_request.status == 'pending':
                ride_request.status = 'offers_received'
                ride_request.save(update_fields=['status', 'updated_at'])

        except Exception as e:
            logger.error(f"Erreur création offre: {e}", exc_info=True)
            return Response(
                {'error': f'Erreur serveur: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Notifier le passager (non bloquant)
        try:
            from apps.rides.tasks import notify_passenger_of_offer
            notify_passenger_of_offer.delay(str(ride_request.id), str(offer.id))
        except Exception:
            pass

        # Push + in-app au passager (thread d'arrière-plan)
        from apps.notifications.services.notification_service import notify_user_async
        notify_user_async(
            ride_request.passenger,
            'new_offer',
            params={
                'driver': driver.user.first_name,
                'price': offer.offered_price,
            },
            notification_type='ride_offer',
            data={
                'ride_request_id': str(ride_request.id),
                'offer_id': str(offer.id),
            },
        )

        return Response(
            RideOfferResponseSerializer(offer).data,
            status=status.HTTP_201_CREATED
        )


class MyPendingOffersView(APIView):
    """GET /api/rides/offers/my-pending — Statut des offres du chauffeur."""
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        try:
            driver = request.user.driver_profile
        except Exception:
            return Response([])

        # Offres récentes du chauffeur (dernières 24h)
        from datetime import timedelta
        since = timezone.now() - timedelta(hours=24)

        offers = RideOffer.objects.filter(
            driver=driver,
            created_at__gte=since,
        ).select_related('ride_request').order_by('-created_at')[:20]

        results = []
        for o in offers:
            results.append({
                'id': str(o.id),
                'ride_request_id': str(o.ride_request_id),
                'offered_price': o.offered_price,
                'status': o.status,  # pending, accepted, rejected, expired, withdrawn
            })

        return Response(results)


class RideOfferWithdrawView(APIView):
    """DELETE /api/rides/offers/<id> — Chauffeur retire son offre."""
    permission_classes = [IsAuthenticated, IsDriver]

    def delete(self, request, offer_id):
        try:
            offer = RideOffer.objects.get(
                id=offer_id,
                driver=request.user.driver_profile,
                status='pending'
            )
        except RideOffer.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        offer.status = 'withdrawn'
        offer.save(update_fields=['status', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ActiveRideView(APIView):
    """GET /api/rides/active — Course en cours de l'utilisateur (passager ou chauffeur).

    Permet à l'app de reprendre une course après un redémarrage ou une
    coupure réseau. Inclut les courses terminées mais pas encore payées
    (le chauffeur doit encore encaisser).
    """
    permission_classes = [IsAuthenticated, IsPassengerOrDriver]

    ACTIVE_STATUSES = [
        'driver_assigned', 'driver_en_route', 'driver_arrived',
        'passenger_onboard', 'completed',
    ]

    def get(self, request):
        qs = Ride.objects.select_related(
            'driver', 'driver__user', 'passenger'
        ).filter(status__in=self.ACTIVE_STATUSES)

        try:
            driver = request.user.driver_profile
        except Exception:
            driver = None

        if driver is not None:
            qs = qs.filter(driver=driver)
        else:
            qs = qs.filter(passenger=request.user)

        ride = qs.order_by('-created_at').first()
        if not ride:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(RideSerializer(ride).data)


class RideDetailView(APIView):
    """GET /api/rides/<id> — Détails d'une course."""
    permission_classes = [IsAuthenticated]

    def get(self, request, ride_id):
        try:
            ride = Ride.objects.select_related(
                'driver', 'driver__user', 'passenger'
            ).get(id=ride_id)
        except Ride.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        # Vérifier que l'utilisateur est impliqué dans la course
        if request.user != ride.passenger and request.user != ride.driver.user:
            if request.user.role != 'admin':
                return Response(status=status.HTTP_403_FORBIDDEN)

        return Response(RideSerializer(ride).data)


class RideStatusUpdateView(APIView):
    """POST /api/rides/<id>/status — Changer le statut d'une course."""
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, ride_id):
        serializer = RideStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            ride = Ride.objects.get(id=ride_id, driver=request.user.driver_profile)
        except Ride.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        try:
            ride = update_ride_status(ride, serializer.validated_data['status'])
        except RideLifecycleError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Notifier le passager (non bloquant)
        try:
            from apps.rides.tasks import notify_ride_status_change
            notify_ride_status_change.delay(str(ride.id))
        except Exception as e:
            logger.warning(f"Notification statut échouée (non bloquant): {e}")

        # Push + in-app au passager pour les étapes clés (thread d'arrière-plan)
        status_message_keys = {
            'driver_en_route': 'driver_en_route',
            'driver_arrived': 'driver_arrived',
            'completed': 'ride_completed',
        }
        message_key = status_message_keys.get(ride.status)
        if message_key:
            from apps.notifications.services.notification_service import notify_user_async
            notify_user_async(
                ride.passenger,
                message_key,
                params={
                    'driver': ride.driver.user.first_name,
                    'price': ride.agreed_price,
                },
                notification_type='ride_status',
                data={'ride_id': str(ride.id), 'status': ride.status},
            )

        return Response(RideSerializer(ride).data)


class RideCancelView(APIView):
    """POST /api/rides/<id>/cancel — Annuler une course."""
    permission_classes = [IsAuthenticated, IsPassengerOrDriver]

    def post(self, request, ride_id):
        serializer = CancelRideSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            ride = Ride.objects.get(id=ride_id)
        except Ride.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        # Déterminer qui annule
        if request.user == ride.passenger:
            cancelled_by = 'passenger'
        elif request.user == ride.driver.user:
            cancelled_by = 'driver'
        else:
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            ride = cancel_ride(
                ride, cancelled_by,
                reason=serializer.validated_data.get('reason', '')
            )
        except RideLifecycleError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Notifier l'autre partie via le canal de suivi (non bloquant)
        try:
            from apps.rides.tasks import notify_ride_status_change
            notify_ride_status_change.delay(str(ride.id))
        except Exception as e:
            logger.warning(f"Notification annulation échouée (non bloquant): {e}")

        # Push + in-app à l'autre partie (thread d'arrière-plan)
        from apps.notifications.services.notification_service import notify_user_async
        if cancelled_by == 'passenger':
            notify_user_async(
                ride.driver.user,
                'cancelled_by_passenger',
                notification_type='ride_status',
                data={'ride_id': str(ride.id)},
            )
        else:
            notify_user_async(
                ride.passenger,
                'cancelled_by_driver',
                notification_type='ride_status',
                data={'ride_id': str(ride.id)},
            )

        return Response(RideSerializer(ride).data)


class RideApplyPromoView(APIView):
    """POST /api/rides/<id>/apply-promo — Appliquer un code promo à une course.

    Utilisé au moment du paiement : la réduction est financée par la
    plateforme (le chauffeur est compensé sur son crédit commission).
    """
    permission_classes = [IsAuthenticated, IsPassenger]

    APPLICABLE_STATUSES = [
        'driver_assigned', 'driver_en_route', 'driver_arrived',
        'passenger_onboard', 'completed',
    ]

    def post(self, request, ride_id):
        code = (request.data.get('code') or '').strip().upper()

        try:
            ride = Ride.objects.get(id=ride_id, passenger=request.user)
        except Ride.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if ride.status not in self.APPLICABLE_STATUSES:
            return Response(
                {'error': 'Cette course ne peut plus recevoir de code promo.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from apps.accounts.services.promo_service import PromoError, apply_promo_code_to_ride
        try:
            apply_promo_code_to_ride(ride, code)
        except PromoError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(RideSerializer(ride).data)


class RideShareView(APIView):
    """POST /api/rides/<id>/share — Générer un lien de partage de trajet."""
    permission_classes = [IsAuthenticated]

    def post(self, request, ride_id):
        try:
            ride = Ride.objects.get(id=ride_id, passenger=request.user)
        except Ride.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        token = ride.generate_share_token()
        share_url = f"{request.build_absolute_uri('/api/rides/')}{ride_id}/track/{token}"

        return Response({
            'share_url': share_url,
            'share_token': token,
            'expires_at': ride.share_expires_at,
        })


class RideTrackPublicView(APIView):
    """GET /api/rides/<id>/track/<token> — Suivi public d'une course."""
    permission_classes = []  # Accès public avec token

    def get(self, request, ride_id, token):
        try:
            ride = Ride.objects.get(id=ride_id, share_token=token)
        except Ride.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if ride.share_expires_at and timezone.now() > ride.share_expires_at:
            return Response(
                {'error': 'Ce lien de partage a expiré.'},
                status=status.HTTP_410_GONE
            )

        # Retourner des infos limitées
        return Response({
            'status': ride.status,
            'pickup_address': ride.pickup_address,
            'dropoff_address': ride.dropoff_address,
            'driver_name': f"{ride.driver.user.first_name} {ride.driver.user.last_name[0]}.",
            'vehicle_type': ride.vehicle_type,
        })


class RideSOSView(APIView):
    """POST /api/rides/<id>/sos — Déclencher le SOS."""
    permission_classes = [IsAuthenticated]

    def post(self, request, ride_id):
        try:
            ride = Ride.objects.get(id=ride_id)
        except Ride.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        ride.emergency_triggered = True
        ride.save(update_fields=['emergency_triggered'])

        # Créer un incident prioritaire
        from apps.incidents.models import Incident
        incident = Incident.objects.create(
            ride=ride,
            reported_by=request.user,
            incident_type='sos_emergency',
            description=f"SOS déclenché par {request.user.role}",
            location=request.user.last_location,
            priority='critical',
        )

        logger.warning(f"SOS déclenché ! Course #{str(ride.id)[:8]}, incident #{str(incident.id)[:8]}")

        # Alerter immédiatement l'équipe MoveBissau (in-app + push)
        try:
            from apps.accounts.models import User
            from apps.notifications.services.notification_service import notify_users_async
            admins = list(User.objects.filter(role='admin', is_active=True))
            notify_users_async(
                admins,
                'sos_alert',
                params={
                    'ride': str(ride.id)[:8],
                    'by': request.user.role,
                },
                notification_type='incident',
                data={
                    'ride_id': str(ride.id),
                    'incident_id': str(incident.id),
                },
            )
        except Exception as e:
            logger.error(f"Alerte SOS aux admins échouée : {e}")

        # Message honnête : c'est l'équipe MoveBissau qui est alertée,
        # pas les services d'urgence publics.
        return Response({
            'message': "Alerte envoyée à l'équipe MoveBissau. "
                       "En cas de danger immédiat, appelez directement la police.",
            'incident_id': str(incident.id),
        })


class RideHistoryView(APIView):
    """GET /api/rides/history — Historique des courses."""
    permission_classes = [IsAuthenticated]

    ACTIVE_STATUSES = ['driver_assigned', 'driver_en_route', 'driver_arrived', 'passenger_onboard', 'completed']

    def get(self, request):
        user = request.user
        rides = Ride.objects.none()

        if user.role == 'driver':
            try:
                rides = Ride.objects.filter(driver=user.driver_profile)
            except Exception:
                pass
        elif user.role == 'passenger':
            rides = Ride.objects.filter(passenger=user)
        elif user.role == 'admin':
            # Admin peut voir ses courses en tant que passager ET chauffeur
            from django.db.models import Q
            q = Q(passenger=user)
            try:
                q |= Q(driver=user.driver_profile)
            except Exception:
                pass
            rides = Ride.objects.filter(q)

        # Filtrer par statut actif si demandé
        status_filter = request.query_params.get('status')
        if status_filter == 'active':
            rides = rides.filter(status__in=self.ACTIVE_STATUSES)

        rides = rides.order_by('-created_at')[:50]

        if status_filter == 'active':
            return Response({'results': RideSerializer(rides, many=True).data})
        return Response(RideHistorySerializer(rides, many=True).data)
