/// Provider pour l'état du chauffeur — en ligne/hors ligne, demandes,
/// offres en attente, course active et crédit.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../models/driver_models.dart';
import '../../models/ride.dart';
import '../api/api_client.dart';
import '../api/ws_client.dart';

class DriverProvider extends ChangeNotifier {
  final ApiClient _api;

  DriverProfile? _profile;
  CommissionCredit? _credit;
  bool _isOnline = false;
  bool _isLoading = false;
  String? _error;

  // Demandes entrantes
  List<Map<String, dynamic>> _incomingRequests = [];
  final Set<String> _dismissedRequestIds = {};

  // Offres envoyées en attente de réponse du passager
  // Chaque entrée : {id, ride_request_id, offered_price, pickup_address, dropoff_address}
  final List<Map<String, dynamic>> _pendingOffers = [];

  // Course active
  Ride? _activeRide;

  // Événement à afficher à l'utilisateur (clé i18n), consommé par l'UI
  String? _notice;

  // Course à ouvrir automatiquement (offre venant d'être acceptée)
  String? _rideToOpen;

  // GPS
  LatLng? _currentPosition;
  StreamSubscription<Position>? _locationSubscription;
  WsClient? _requestsWs;
  WsClient? _locationWs;
  WsClient? _trackingWs;
  StreamSubscription? _requestsSubscription;
  StreamSubscription? _trackingSubscription;
  Timer? _offersPollTimer;
  Timer? _requestsPollTimer;
  Timer? _ridePollTimer;

  DriverProvider(this._api);

  DriverProfile? get profile => _profile;
  CommissionCredit? get credit => _credit;
  bool get isOnline => _isOnline;
  bool get isLoading => _isLoading;
  String? get error => _error;
  List<Map<String, dynamic>> get incomingRequests => _incomingRequests;
  List<Map<String, dynamic>> get pendingOffers => List.unmodifiable(_pendingOffers);
  Ride? get activeRide => _activeRide;
  LatLng? get currentPosition => _currentPosition;
  String? get notice => _notice;

  /// L'UI consomme la notification après l'avoir affichée.
  void clearNotice() {
    _notice = null;
  }

  /// Course à ouvrir automatiquement (une seule fois, à l'acceptation).
  String? get rideToOpen => _rideToOpen;
  void consumeRideToOpen() {
    _rideToOpen = null;
  }

  /// Charger le profil chauffeur
  Future<void> loadProfile() async {
    try {
      final response = await _api.get('/drivers/me');
      _profile = DriverProfile.fromJson(response.data);
      _isOnline = _profile?.isOnline ?? false;
      notifyListeners();

      // Si le chauffeur était déjà en ligne (reprise d'app), relancer GPS + WS
      if (_isOnline) {
        _startLocationUpdates();
        _connectToRequests();
        _startRequestsPolling();
      }
    } catch (_) {}
  }

  /// Charger le solde de crédit
  Future<void> loadCredit() async {
    try {
      final response = await _api.get('/commissions/balance');
      _credit = CommissionCredit.fromJson(response.data);
      notifyListeners();
    } catch (_) {}
  }

  /// Vérifier s'il existe une course active (reprise après crash/redémarrage)
  Future<void> checkActiveRide() async {
    try {
      final response = await _api.get('/rides/active');
      _setActiveRide(Ride.fromJson(response.data));
    } catch (_) {
      // 404 = pas de course active
    }
  }

  /// Se mettre en ligne
  Future<bool> goOnline() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _api.post('/drivers/go-online');
      _isOnline = true;
      _isLoading = false;
      notifyListeners();

      // Démarrer l'envoi GPS et l'écoute des demandes (WS + polling de secours)
      _startLocationUpdates();
      _connectToRequests();
      _startRequestsPolling();
      checkActiveRide();

      return true;
    } catch (e) {
      _setError('Impossible de se mettre en ligne');
      return false;
    }
  }

  /// Se mettre hors ligne
  Future<void> goOffline() async {
    await _api.post('/drivers/go-offline');
    _isOnline = false;
    _stopLocationUpdates();
    _stopRequestsPolling();
    _requestsWs?.disconnect();
    _incomingRequests = [];
    _dismissedRequestIds.clear();
    notifyListeners();
  }

  /// Polling de secours des demandes proches (le WebSocket peut être
  /// indisponible, notamment derrière un déploiement WSGI).
  void _startRequestsPolling() {
    _requestsPollTimer?.cancel();
    _requestsPollTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      if (!_isOnline) {
        _stopRequestsPolling();
        return;
      }
      // Chauffeur occupé : inutile d'afficher de nouvelles demandes
      if (_activeRide != null &&
          (_activeRide!.isActive || _activeRide!.isCompleted)) {
        return;
      }

      try {
        final response = await _api.get('/rides/requests/nearby');
        final list = (response.data as List)
            .cast<Map<String, dynamic>>()
            .where((r) => !_dismissedRequestIds.contains(r['id']))
            .toList();

        // Ne notifier que si la liste a changé (évite les rebuilds inutiles)
        final newIds = list.map((r) => r['id']).join(',');
        final currentIds = _incomingRequests.map((r) => r['id']).join(',');
        if (newIds != currentIds) {
          _incomingRequests = list;
          notifyListeners();
        }
      } catch (_) {}
    });
  }

  void _stopRequestsPolling() {
    _requestsPollTimer?.cancel();
    _requestsPollTimer = null;
  }

  /// Démarrer l'envoi de la position GPS
  void _startLocationUpdates() async {
    _locationSubscription?.cancel();

    // Connecter le WebSocket de position (complément du fallback REST)
    _locationWs?.disconnect();
    _locationWs = WsClient();
    final token = await _api.getAccessToken();
    if (token != null) {
      await _locationWs!.connect('ws/driver/location', token);
    }

    _locationSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10, // Mise à jour tous les 10 mètres
      ),
    ).listen((position) {
      _currentPosition = LatLng(position.latitude, position.longitude);

      // Envoyer via REST (fallback) ou WebSocket
      _api.post('/drivers/location', data: {
        'latitude': position.latitude,
        'longitude': position.longitude,
      });

      // Aussi via WebSocket si connecté
      _locationWs?.send({
        'latitude': position.latitude,
        'longitude': position.longitude,
        'heading': position.heading,
        'speed': position.speed,
      });

      notifyListeners();
    });
  }

  void _stopLocationUpdates() {
    _locationSubscription?.cancel();
    _locationWs?.disconnect();
  }

  /// Se connecter au WebSocket pour recevoir les demandes et les
  /// réponses à nos offres (acceptée / rejetée / demande annulée).
  void _connectToRequests() async {
    _requestsWs?.disconnect();
    _requestsSubscription?.cancel();
    _requestsWs = WsClient();
    final token = await _api.getAccessToken();
    if (token == null) return;

    await _requestsWs!.connect('ws/driver/requests', token);
    _requestsSubscription = _requestsWs!.messages?.listen((data) {
      switch (data['type']) {
        case 'new_ride_request':
          _incomingRequests.insert(0, data['ride_request']);
          notifyListeners();
          break;

        case 'offer_accepted':
          _onOfferAccepted(data['ride']);
          break;

        case 'offer_rejected':
          _removePendingOffer(data['ride_request_id'], notice: 'offer_rejected_msg');
          break;

        case 'request_cancelled':
          _incomingRequests.removeWhere((r) => r['id'] == data['ride_request_id']);
          _removePendingOffer(data['ride_request_id'], notice: 'request_cancelled_msg');
          break;
      }
    });
  }

  /// Le passager a accepté notre offre : la course démarre.
  void _onOfferAccepted(Map<String, dynamic> rideJson) {
    _pendingOffers.clear();
    _incomingRequests = [];
    _stopOffersPolling();
    _notice = 'offer_accepted_title';
    final ride = Ride.fromJson(rideJson);
    _rideToOpen = ride.id;
    _setActiveRide(ride);
  }

  void _removePendingOffer(String? requestId, {String? notice}) {
    if (requestId == null) return;
    final before = _pendingOffers.length;
    _pendingOffers.removeWhere((o) => o['ride_request_id'] == requestId);
    if (_pendingOffers.length != before) {
      if (notice != null) _notice = notice;
      if (_pendingOffers.isEmpty) _stopOffersPolling();
      notifyListeners();
    }
  }

  void _setActiveRide(Ride ride) {
    _activeRide = ride;
    if (ride.isActive || ride.isCompleted) {
      _connectRideTracking(ride.id);
      _startRidePolling(ride.id);
    }
    notifyListeners();
  }

  /// Polling de secours du statut de la course (annulation passager, etc.)
  /// quand le WebSocket n'est pas disponible.
  void _startRidePolling(String rideId) {
    _ridePollTimer?.cancel();
    _ridePollTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      final current = _activeRide;
      if (current == null ||
          current.id != rideId ||
          current.isCancelled ||
          current.isPaid) {
        _stopRidePolling();
        return;
      }

      try {
        final response = await _api.get('/rides/$rideId');
        final updated = Ride.fromJson(response.data);
        // Statut OU montant (promo appliquée par le passager au paiement)
        if (updated.status != current.status ||
            updated.discountAmount != current.discountAmount) {
          _activeRide = updated;
          if (updated.isCancelled && updated.cancelledBy == 'passenger') {
            _notice = 'ride_cancelled_by_passenger';
          }
          notifyListeners();
        }
      } catch (_) {}
    });
  }

  void _stopRidePolling() {
    _ridePollTimer?.cancel();
    _ridePollTimer = null;
  }

  /// Souscrit au canal de suivi de la course pour recevoir les changements
  /// de statut (ex. annulation par le passager).
  void _connectRideTracking(String rideId) async {
    _trackingWs?.disconnect();
    _trackingSubscription?.cancel();
    _trackingWs = WsClient();
    final token = await _api.getAccessToken();
    if (token == null) return;

    await _trackingWs!.connect('ws/rides/$rideId/tracking', token);
    _trackingSubscription = _trackingWs!.messages?.listen((data) {
      if (data['type'] == 'ride_status_changed' && data['ride'] != null) {
        final updated = Ride.fromJson(data['ride']);
        if (_activeRide?.id != updated.id) return;
        _activeRide = updated;
        if (updated.isCancelled && updated.cancelledBy == 'passenger') {
          _notice = 'ride_cancelled_by_passenger';
        }
        notifyListeners();
      }
    });
  }

  /// Faire une offre sur une demande
  Future<bool> makeOffer(String requestId, int price) async {
    try {
      Map<String, dynamic>? request;
      for (final r in _incomingRequests) {
        if (r['id'] == requestId) {
          request = r;
          break;
        }
      }

      final response = await _api.post('/rides/offers', data: {
        'ride_request_id': requestId,
        'offered_price': price,
      });

      // Suivre l'offre en attente de réponse
      _pendingOffers.insert(0, {
        'id': response.data['id'],
        'ride_request_id': requestId,
        'offered_price': price,
        'pickup_address': request?['pickup_address'] ?? '',
        'dropoff_address': request?['dropoff_address'] ?? '',
      });
      _startOffersPolling();

      // Retirer de la liste des demandes entrantes
      _incomingRequests.removeWhere((r) => r['id'] == requestId);
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Retirer une offre en attente
  Future<bool> withdrawOffer(String offerId) async {
    try {
      await _api.delete('/rides/offers/$offerId');
      _pendingOffers.removeWhere((o) => o['id'] == offerId);
      if (_pendingOffers.isEmpty) _stopOffersPolling();
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Polling de secours (si le WebSocket est coupé) : vérifie le statut
  /// des offres envoyées toutes les 5 secondes.
  void _startOffersPolling() {
    _offersPollTimer?.cancel();
    _offersPollTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      if (_pendingOffers.isEmpty || (_activeRide?.isActive ?? false)) {
        _stopOffersPolling();
        return;
      }

      try {
        final response = await _api.get('/rides/offers/my-pending');
        final statuses = <String, String>{
          for (final o in (response.data as List))
            o['id'] as String: o['status'] as String,
        };

        var accepted = false;
        var changed = false;
        _pendingOffers.removeWhere((offer) {
          final status = statuses[offer['id']];
          if (status == null || status == 'pending') return false;
          changed = true;
          if (status == 'accepted') {
            accepted = true;
          } else if (status == 'rejected' || status == 'expired') {
            _notice = 'offer_rejected_msg';
          }
          return true;
        });

        if (accepted) {
          _stopOffersPolling();
          _pendingOffers.clear();
          _notice = 'offer_accepted_title';
          await checkActiveRide();
          _rideToOpen = _activeRide?.id;
          notifyListeners();
        } else if (changed) {
          if (_pendingOffers.isEmpty) _stopOffersPolling();
          notifyListeners();
        }
      } catch (_) {}
    });
  }

  void _stopOffersPolling() {
    _offersPollTimer?.cancel();
    _offersPollTimer = null;
  }

  /// Changer le statut de la course active
  Future<bool> updateRideStatus(String rideId, String status) async {
    try {
      final response = await _api.post('/rides/$rideId/status', data: {
        'status': status,
      });
      _activeRide = Ride.fromJson(response.data);
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Annuler la course active (appel API réel, frais possibles)
  Future<bool> cancelActiveRide(String rideId, String reason) async {
    try {
      final response = await _api.post('/rides/$rideId/cancel', data: {
        'reason': reason,
      });
      _activeRide = Ride.fromJson(response.data);
      await loadCredit(); // Frais d'annulation déduits du crédit
      clearActiveRide();
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Confirmer paiement cash
  Future<bool> confirmCashPayment(String rideId) async {
    try {
      await _api.post('/payments/confirm-cash', data: {
        'ride_id': rideId,
      });
      await loadCredit(); // Recharger le solde (commission déduite)
      clearActiveRide();
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Terminer proprement l'état de course active (après paiement/annulation)
  void clearActiveRide() {
    _activeRide = null;
    _stopRidePolling();
    _trackingWs?.disconnect();
    _trackingSubscription?.cancel();
    _trackingWs = null;
    notifyListeners();
  }

  /// Recharger le crédit
  Future<bool> topupCredit(int amount, String method, String phone) async {
    _isLoading = true;
    notifyListeners();

    try {
      await _api.post('/commissions/topup', data: {
        'amount': amount,
        'payment_method': method,
        'phone': phone,
      });
      await loadCredit();
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _setError('Échec du rechargement');
      return false;
    }
  }

  /// Charger la course active
  Future<void> loadActiveRide(String rideId) async {
    try {
      final response = await _api.get('/rides/$rideId');
      _setActiveRide(Ride.fromJson(response.data));
    } catch (_) {}
  }

  /// Retirer une demande de la liste
  void dismissRequest(String requestId) {
    _dismissedRequestIds.add(requestId);
    _incomingRequests.removeWhere((r) => r['id'] == requestId);
    notifyListeners();
  }

  void _setError(String msg) {
    _error = msg;
    _isLoading = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _locationSubscription?.cancel();
    _requestsSubscription?.cancel();
    _trackingSubscription?.cancel();
    _offersPollTimer?.cancel();
    _requestsPollTimer?.cancel();
    _ridePollTimer?.cancel();
    _requestsWs?.disconnect();
    _locationWs?.disconnect();
    _trackingWs?.disconnect();
    super.dispose();
  }
}
