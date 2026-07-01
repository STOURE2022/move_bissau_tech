/// Service de notifications push (Firebase Cloud Messaging).
///
/// Se désactive silencieusement si Firebase n'est pas configuré
/// (google-services.json absent) : l'app fonctionne alors normalement,
/// sans push. Lancer `flutterfire configure` pour l'activer.
import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';

class PushService {
  static final PushService _instance = PushService._();
  factory PushService() => _instance;
  PushService._();

  bool _available = false;
  String? _token;
  StreamSubscription<String>? _refreshSubscription;

  bool get isAvailable => _available;

  String get _platform {
    if (kIsWeb) return 'web';
    try {
      return Platform.isIOS ? 'ios' : 'android';
    } catch (_) {
      return 'android';
    }
  }

  /// À appeler au démarrage de l'app (avant runApp).
  Future<void> init() async {
    try {
      await Firebase.initializeApp();
      _available = true;
    } catch (e) {
      debugPrint('Firebase non configuré — push désactivé : $e');
      _available = false;
    }
  }

  /// Enregistre le token de l'appareil auprès du backend.
  /// À appeler une fois l'utilisateur connecté.
  Future<void> register(ApiClient api) async {
    if (!_available) return;
    try {
      final messaging = FirebaseMessaging.instance;

      final settings = await messaging.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;

      _token = await messaging.getToken();
      if (_token != null) {
        await _sendToken(api, _token!);
      }

      // Ré-enregistrer automatiquement si FCM renouvelle le token
      _refreshSubscription?.cancel();
      _refreshSubscription = messaging.onTokenRefresh.listen((newToken) {
        _token = newToken;
        _sendToken(api, newToken);
      });
    } catch (e) {
      debugPrint('Enregistrement push échoué : $e');
    }
  }

  Future<void> _sendToken(ApiClient api, String token) async {
    try {
      await api.post('/notifications/device-token', data: {
        'token': token,
        'platform': _platform,
      });
    } catch (e) {
      debugPrint('Envoi du token push échoué : $e');
    }
  }

  /// Désactive le token côté backend (à appeler AVANT de purger les
  /// jetons d'authentification au logout).
  Future<void> unregister(ApiClient api) async {
    if (!_available || _token == null) return;
    try {
      await api.delete('/notifications/device-token', data: {'token': _token});
    } catch (_) {}
    _refreshSubscription?.cancel();
  }
}
