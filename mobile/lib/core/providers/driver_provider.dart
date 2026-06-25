/// Provider pour l'état du chauffeur — en ligne/hors ligne, demandes, crédit.
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

  // Course active
  Ride? _activeRide;

  // GPS
  StreamSubscription<Position>? _locationSubscription;
  WsClient? _requestsWs;
  WsClient? _locationWs;
  StreamSubscription? _requestsSubscription;

  DriverProvider(this._api);

  DriverProfile? get profile => _profile;
  CommissionCredit? get credit => _credit;
  bool get isOnline => _isOnline;
  bool get isLoading => _isLoading;
  String? get error => _error;
  List<Map<String, dynamic>> get incomingRequests => _incomingRequests;
  Ride? get activeRide => _activeRide;

  /// Charger le profil chauffeur
  Future<void> loadProfile() async {
    try {
      final response = await _api.get('/drivers/me');
      _profile = DriverProfile.fromJson(response.data);
      _isOnline = _profile?.isOnline ?? false;
      notifyListeners();
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

  /// Se mettre en ligne
  Future<bool> goOnline() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _api.post('/drivers/go-online');
      _isOnline = true;
      _isLoading = false;
      notifyListeners();

      // Démarrer l'envoi GPS et l'écoute des demandes
      _startLocationUpdates();
      _connectToRequests();

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
    _requestsWs?.disconnect();
    _incomingRequests = [];
    notifyListeners();
  }

  /// Démarrer l'envoi de la position GPS
  void _startLocationUpdates() {
    _locationSubscription?.cancel();

    _locationSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10, // Mise à jour tous les 10 mètres
      ),
    ).listen((position) {
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
    });
  }

  void _stopLocationUpdates() {
    _locationSubscription?.cancel();
    _locationWs?.disconnect();
  }

  /// Se connecter au WebSocket pour recevoir les demandes
  void _connectToRequests() async {
    _requestsWs = WsClient();
    final token = await _api.getAccessToken();
    if (token == null) return;

    await _requestsWs!.connect('ws/driver/requests', token);
    _requestsSubscription = _requestsWs!.messages?.listen((data) {
      if (data['type'] == 'new_ride_request') {
        _incomingRequests.insert(0, data['ride_request']);
        notifyListeners();
      }
    });
  }

  /// Faire une offre sur une demande
  Future<bool> makeOffer(String requestId, int price) async {
    try {
      await _api.post('/rides/offers', data: {
        'ride_request_id': requestId,
        'offered_price': price,
      });

      // Retirer de la liste des demandes entrantes
      _incomingRequests.removeWhere((r) => r['id'] == requestId);
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
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

  /// Confirmer paiement cash
  Future<bool> confirmCashPayment(String rideId) async {
    try {
      await _api.post('/payments/confirm-cash', data: {
        'ride_id': rideId,
      });
      await loadCredit(); // Recharger le solde (commission déduite)
      return true;
    } catch (_) {
      return false;
    }
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
      _activeRide = Ride.fromJson(response.data);
      notifyListeners();
    } catch (_) {}
  }

  /// Retirer une demande de la liste
  void dismissRequest(String requestId) {
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
    _requestsWs?.disconnect();
    _locationWs?.disconnect();
    super.dispose();
  }
}
