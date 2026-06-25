/// Provider d'authentification — gère l'état de connexion et le profil utilisateur.
import 'package:flutter/material.dart';

import '../../models/user.dart';
import '../api/api_client.dart';

class AuthProvider extends ChangeNotifier {
  final ApiClient _api;

  User? _user;
  bool _isLoading = false;
  String? _error;

  AuthProvider(this._api);

  User? get user => _user;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _user != null;
  bool get isProfileComplete => _user?.isProfileComplete ?? false;
  bool get isDriver => _user?.isDriver ?? false;
  bool get isPassenger => _user?.isPassenger ?? true;

  /// Vérifie si l'utilisateur est déjà connecté (au lancement)
  Future<void> checkAuth() async {
    final hasToken = await _api.hasToken();
    if (!hasToken) return;

    try {
      final response = await _api.get('/auth/users/me');
      _user = User.fromJson(response.data);
      notifyListeners();
    } catch (_) {
      await _api.clearTokens();
    }
  }

  /// Demande un OTP par SMS
  Future<bool> requestOtp(String phone) async {
    _setLoading(true);
    try {
      await _api.post('/auth/otp/request', data: {'phone': phone});
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(_extractError(e));
      return false;
    }
  }

  /// Vérifie l'OTP et connecte l'utilisateur
  Future<bool> verifyOtp(String phone, String code) async {
    _setLoading(true);
    try {
      final response = await _api.post('/auth/otp/verify', data: {
        'phone': phone,
        'code': code,
      });

      final data = response.data;
      await _api.saveTokens(data['access'], data['refresh']);
      _user = User.fromJson(data['user']);
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(_extractError(e));
      return false;
    }
  }

  /// Complète le profil après première inscription
  Future<bool> completeProfile({
    required String firstName,
    required String lastName,
    required String role,
    required String lang,
  }) async {
    _setLoading(true);
    try {
      final response = await _api.post('/auth/complete-profile', data: {
        'first_name': firstName,
        'last_name': lastName,
        'role': role,
        'preferred_lang': lang,
      });

      _user = User.fromJson(response.data);
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(_extractError(e));
      return false;
    }
  }

  /// Change la langue
  Future<void> changeLanguage(String lang) async {
    try {
      await _api.patch('/auth/users/me/language', data: {
        'preferred_lang': lang,
      });
      // Mettre à jour localement
      if (_user != null) {
        _user = User.fromJson({
          ..._userToJson(),
          'preferred_lang': lang,
        });
        notifyListeners();
      }
    } catch (_) {}
  }

  /// Déconnexion
  Future<void> logout() async {
    await _api.clearTokens();
    _user = null;
    notifyListeners();
  }

  /// Recharger le profil
  Future<void> refreshProfile() async {
    try {
      final response = await _api.get('/auth/users/me');
      _user = User.fromJson(response.data);
      notifyListeners();
    } catch (_) {}
  }

  Map<String, dynamic> _userToJson() {
    if (_user == null) return {};
    return {
      'id': _user!.id,
      'phone': _user!.phone,
      'phone_verified': _user!.phoneVerified,
      'role': _user!.role,
      'first_name': _user!.firstName,
      'last_name': _user!.lastName,
      'preferred_lang': _user!.preferredLang,
      'avatar_url': _user!.avatarUrl,
      'cancellation_debt': _user!.cancellationDebt,
      'has_unpaid_cancellation': _user!.hasUnpaidCancellation,
    };
  }

  void _setLoading(bool value) {
    _isLoading = value;
    _error = null;
    notifyListeners();
  }

  void _setError(String msg) {
    _error = msg;
    _isLoading = false;
    notifyListeners();
  }

  String _extractError(dynamic e) {
    if (e is Exception) {
      return e.toString().replaceAll('Exception: ', '');
    }
    return 'Erreur inattendue';
  }
}
