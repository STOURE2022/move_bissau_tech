/// Provider pour la gestion des courses côté passager.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../../models/ride.dart';
import '../api/api_client.dart';
import '../api/ws_client.dart';

class RideProvider extends ChangeNotifier {
  final ApiClient _api;

  // État
  PriceEstimate? _estimate;
  RideRequest? _currentRequest;
  Ride? _currentRide;
  List<RideOffer> _offers = [];
  bool _isLoading = false;
  String? _error;

  // WebSocket
  WsClient? _offersWs;
  WsClient? _trackingWs;
  StreamSubscription? _offersSubscription;
  StreamSubscription? _trackingSubscription;

  // Position chauffeur en temps réel
  LatLng? _driverLocation;

  RideProvider(this._api);

  PriceEstimate? get estimate => _estimate;
  RideRequest? get currentRequest => _currentRequest;
  Ride? get currentRide => _currentRide;
  List<RideOffer> get offers => _offers;
  bool get isLoading => _isLoading;
  String? get error => _error;
  LatLng? get driverLocation => _driverLocation;

  /// Estimation de prix
  Future<PriceEstimate?> getEstimate({
    required LatLng pickup,
    required LatLng dropoff,
    required String vehicleType,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.post('/rides/estimate', data: {
        'pickup_lat': pickup.latitude,
        'pickup_lng': pickup.longitude,
        'dropoff_lat': dropoff.latitude,
        'dropoff_lng': dropoff.longitude,
        'vehicle_type': vehicleType,
      });
      _estimate = PriceEstimate.fromJson(response.data);
      _isLoading = false;
      notifyListeners();
      return _estimate;
    } catch (e) {
      _setError('Erreur lors de l\'estimation');
      return null;
    }
  }

  /// Créer une demande de course
  Future<RideRequest?> createRequest({
    required LatLng pickup,
    required LatLng dropoff,
    required String pickupAddress,
    required String dropoffAddress,
    required int proposedPrice,
    required String vehicleType,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.post('/rides/requests', data: {
        'pickup_lat': pickup.latitude,
        'pickup_lng': pickup.longitude,
        'pickup_address': pickupAddress,
        'dropoff_lat': dropoff.latitude,
        'dropoff_lng': dropoff.longitude,
        'dropoff_address': dropoffAddress,
        'proposed_price': proposedPrice,
        'vehicle_type': vehicleType,
      });

      _currentRequest = RideRequest.fromJson(response.data);
      _offers = [];
      _isLoading = false;
      notifyListeners();

      // Se connecter au WebSocket pour recevoir les offres
      _connectToOffers(_currentRequest!.id);

      return _currentRequest;
    } catch (e) {
      _setError('Erreur lors de la création de la demande');
      return null;
    }
  }

  /// Se connecter au WebSocket des offres
  void _connectToOffers(String requestId) async {
    _offersWs = WsClient();
    final token = await _api.getAccessToken();
    if (token == null) return;

    await _offersWs!.connect('ws/rides/$requestId/offers', token);
    _offersSubscription = _offersWs!.messages?.listen((data) {
      if (data['type'] == 'new_offer') {
        final offer = RideOffer.fromJson(data['offer']);
        _offers.add(offer);
        notifyListeners();
      }
    });
  }

  /// Accepter une offre
  Future<Ride?> acceptOffer(String requestId, String offerId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _api.post(
        '/rides/requests/$requestId/accept-offer',
        data: {'offer_id': offerId},
      );

      _currentRide = Ride.fromJson(response.data);
      _offersWs?.disconnect();
      _isLoading = false;
      notifyListeners();

      // Se connecter au suivi GPS
      _connectToTracking(_currentRide!.id);

      return _currentRide;
    } catch (e) {
      _setError('Erreur lors de l\'acceptation');
      return null;
    }
  }

  /// Se connecter au suivi GPS
  void _connectToTracking(String rideId) async {
    _trackingWs = WsClient();
    final token = await _api.getAccessToken();
    if (token == null) return;

    await _trackingWs!.connect('ws/rides/$rideId/tracking', token);
    _trackingSubscription = _trackingWs!.messages?.listen((data) {
      if (data['type'] == 'driver_location') {
        _driverLocation = LatLng(
          (data['latitude'] as num).toDouble(),
          (data['longitude'] as num).toDouble(),
        );
        notifyListeners();
      } else if (data['type'] == 'ride_status_changed') {
        _currentRide = Ride.fromJson(data['ride']);
        notifyListeners();
      }
    });
  }

  /// Récupérer les détails d'une course
  Future<Ride?> getRide(String rideId) async {
    try {
      final response = await _api.get('/rides/$rideId');
      _currentRide = Ride.fromJson(response.data);
      notifyListeners();
      return _currentRide;
    } catch (_) {
      return null;
    }
  }

  /// Annuler une demande
  Future<bool> cancelRequest(String requestId) async {
    try {
      await _api.post('/rides/requests/$requestId/cancel');
      _currentRequest = null;
      _offers = [];
      _offersWs?.disconnect();
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Annuler une course
  Future<bool> cancelRide(String rideId, {String reason = ''}) async {
    try {
      final response = await _api.post('/rides/$rideId/cancel', data: {
        'reason': reason,
      });
      _currentRide = Ride.fromJson(response.data);
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Partager le trajet
  Future<String?> shareTrip(String rideId) async {
    try {
      final response = await _api.post('/rides/$rideId/share');
      return response.data['share_url'];
    } catch (_) {
      return null;
    }
  }

  /// SOS
  Future<bool> triggerSos(String rideId) async {
    try {
      await _api.post('/rides/$rideId/sos');
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Historique
  Future<List<Ride>> getHistory() async {
    try {
      final response = await _api.get('/rides/history');
      return (response.data as List).map((r) => Ride.fromJson(r)).toList();
    } catch (_) {
      return [];
    }
  }

  void _setError(String msg) {
    _error = msg;
    _isLoading = false;
    notifyListeners();
  }

  /// Nettoyer à la fin
  void reset() {
    _offersSubscription?.cancel();
    _trackingSubscription?.cancel();
    _offersWs?.disconnect();
    _trackingWs?.disconnect();
    _currentRequest = null;
    _currentRide = null;
    _offers = [];
    _driverLocation = null;
    notifyListeners();
  }

  @override
  void dispose() {
    reset();
    super.dispose();
  }
}
