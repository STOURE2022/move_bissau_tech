/// Service de géocodage — recherche d'adresses et géocodage inverse via
/// Nominatim (OpenStreetMap), limité à la Guinée-Bissau, avec cache mémoire.
/// Même source de données que le frontend web (nominatim.openstreetmap.org).
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:latlong2/latlong.dart';

import '../../config/app_config.dart';

class GeoPlace {
  final String name; // Libellé court (premier segment de l'adresse)
  final String fullAddress; // Adresse lisible (2-3 premiers segments)
  final LatLng location;
  final String? type; // Type Nominatim (hospital, marketplace, aerodrome…)

  const GeoPlace({
    required this.name,
    required this.fullAddress,
    required this.location,
    this.type,
  });

  Map<String, dynamic> toJson() => {
        'name': name,
        'full': fullAddress,
        'lat': location.latitude,
        'lng': location.longitude,
      };

  factory GeoPlace.fromJson(Map<String, dynamic> json) => GeoPlace(
        name: json['name'] ?? '',
        fullAddress: json['full'] ?? json['name'] ?? '',
        location: LatLng(
          (json['lat'] as num).toDouble(),
          (json['lng'] as num).toDouble(),
        ),
      );
}

class GeocodingService {
  static final GeocodingService _instance = GeocodingService._();
  factory GeocodingService() => _instance;
  GeocodingService._();

  final Dio _dio = Dio(BaseOptions(
    baseUrl: 'https://nominatim.openstreetmap.org',
    connectTimeout: const Duration(seconds: 8),
    receiveTimeout: const Duration(seconds: 8),
    headers: {'User-Agent': 'MoveBissau/1.0'},
  ));

  // Cache mémoire du géocodage inverse (évite de re-requêter le même point)
  final Map<String, String> _reverseCache = {};

  /// Lieux connus de Bissau proposés comme suggestions de recherche.
  /// Résolus via Nominatim (pas de coordonnées codées en dur).
  static const List<String> bissauSuggestions = [
    'Aéroport Osvaldo Vieira',
    'Mercado de Bandim',
    'Hospital Nacional Simão Mendes',
    'Porto de Bissau',
    'Estádio 24 de Setembro',
    'Bissau Velho',
  ];

  /// Nominatim ne connaît pas le kriol : retomber sur le portugais.
  String _lang(String code) => code == 'gcr' ? 'pt' : code;

  /// Recherche d'adresses/lieux en Guinée-Bissau, priorisée autour de Bissau.
  Future<List<GeoPlace>> search(String query, {String lang = 'fr'}) async {
    if (query.trim().length < 3) return [];

    try {
      const delta = 0.5;
      final response = await _dio.get('/search', queryParameters: {
        'format': 'json',
        'q': query,
        'limit': 8,
        'countrycodes': 'gw',
        'accept-language': _lang(lang),
        'addressdetails': 1,
        'viewbox': '${AppConfig.defaultLng - delta},'
            '${AppConfig.defaultLat + delta},'
            '${AppConfig.defaultLng + delta},'
            '${AppConfig.defaultLat - delta}',
      });

      final data = response.data as List;
      return data.map((r) {
        final displayName = (r['display_name'] ?? '') as String;
        final parts = displayName.split(',').map((p) => p.trim()).toList();
        return GeoPlace(
          name: parts.isNotEmpty ? parts.first : displayName,
          fullAddress: parts.take(3).join(', '),
          location: LatLng(
            double.parse(r['lat'] as String),
            double.parse(r['lon'] as String),
          ),
          type: r['type'] as String?,
        );
      }).toList();
    } catch (_) {
      return [];
    }
  }

  /// Adresse lisible d'un point GPS. Retombe sur les coordonnées si échec.
  Future<String> reverseGeocode(LatLng point, {String lang = 'fr'}) async {
    final key = '${point.latitude.toStringAsFixed(5)},'
        '${point.longitude.toStringAsFixed(5)},$lang';
    final cached = _reverseCache[key];
    if (cached != null) return cached;

    try {
      final response = await _dio.get('/reverse', queryParameters: {
        'format': 'json',
        'lat': point.latitude,
        'lon': point.longitude,
        'accept-language': _lang(lang),
      });

      final displayName = response.data['display_name'] as String?;
      if (displayName == null || displayName.isEmpty) {
        return coordsLabel(point);
      }
      final short =
          displayName.split(',').map((p) => p.trim()).take(3).join(', ');
      _reverseCache[key] = short;
      return short;
    } catch (_) {
      return coordsLabel(point);
    }
  }

  String coordsLabel(LatLng p) =>
      '${p.latitude.toStringAsFixed(4)}, ${p.longitude.toStringAsFixed(4)}';
}

/// Destinations récentes du passager, persistées localement.
class RecentPlacesStore {
  static const _storageKey = 'mb_recent_destinations';
  static const _maxItems = 5;

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<List<GeoPlace>> load() async {
    try {
      final raw = await _storage.read(key: _storageKey);
      if (raw == null) return [];
      return (jsonDecode(raw) as List)
          .map((j) => GeoPlace.fromJson(j as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> add(GeoPlace place) async {
    try {
      final items = await load();
      items.removeWhere((p) => p.name == place.name);
      items.insert(0, place);
      await _storage.write(
        key: _storageKey,
        value: jsonEncode(
          items.take(_maxItems).map((p) => p.toJson()).toList(),
        ),
      );
    } catch (_) {}
  }
}
