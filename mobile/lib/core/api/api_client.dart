/// Client HTTP centralisé pour l'API MoveBissau.
/// Gère l'authentification JWT, le refresh token et les erreurs.
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../config/app_config.dart';

class ApiClient {
  late final Dio _dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  static const String _accessTokenKey = 'access_token';
  static const String _refreshTokenKey = 'refresh_token';

  ApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: '${AppConfig.baseUrl}/api',
      connectTimeout: Duration(seconds: AppConfig.apiTimeoutSeconds),
      receiveTimeout: Duration(seconds: AppConfig.apiTimeoutSeconds),
      headers: {'Content-Type': 'application/json'},
    ));

    // Intercepteur pour ajouter le JWT et gérer le refresh
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: _accessTokenKey);
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          // Tenter un refresh token
          final refreshed = await _refreshToken();
          if (refreshed) {
            // Rejouer la requête originale
            final token = await _storage.read(key: _accessTokenKey);
            error.requestOptions.headers['Authorization'] = 'Bearer $token';
            final response = await _dio.fetch(error.requestOptions);
            handler.resolve(response);
            return;
          }
        }
        handler.next(error);
      },
    ));
  }

  /// Sauvegarde les tokens JWT
  Future<void> saveTokens(String accessToken, String refreshToken) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
  }

  /// Supprime les tokens (déconnexion)
  Future<void> clearTokens() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }

  /// Vérifie si un token existe
  Future<bool> hasToken() async {
    final token = await _storage.read(key: _accessTokenKey);
    return token != null;
  }

  /// Récupère le token d'accès
  Future<String?> getAccessToken() async {
    return await _storage.read(key: _accessTokenKey);
  }

  /// Refresh le token
  Future<bool> _refreshToken() async {
    try {
      final refreshToken = await _storage.read(key: _refreshTokenKey);
      if (refreshToken == null) return false;

      final response = await Dio(BaseOptions(
        baseUrl: '${AppConfig.baseUrl}/api',
      )).post('/auth/token/refresh', data: {'refresh': refreshToken});

      if (response.statusCode == 200) {
        await saveTokens(
          response.data['access'],
          response.data['refresh'] ?? refreshToken,
        );
        return true;
      }
    } catch (_) {}
    return false;
  }

  // === Méthodes HTTP ===

  Future<Response> get(String path, {Map<String, dynamic>? queryParams}) {
    return _dio.get(path, queryParameters: queryParams);
  }

  Future<Response> post(String path, {dynamic data}) {
    return _dio.post(path, data: data);
  }

  Future<Response> patch(String path, {dynamic data}) {
    return _dio.patch(path, data: data);
  }

  Future<Response> delete(String path) {
    return _dio.delete(path);
  }
}
