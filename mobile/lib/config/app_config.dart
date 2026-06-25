/// Configuration de l'application MoveBissau.
class AppConfig {
  // API Backend
  static const String apiBaseUrl = 'https://api.movebissau.com';
  static const String wsBaseUrl = 'wss://api.movebissau.com';

  // Dev
  static const String apiBaseUrlDev = 'http://10.0.2.2:8000';
  static const String wsBaseUrlDev = 'ws://10.0.2.2:8000';

  // Mapbox
  static const String mapboxAccessToken = 'VOTRE_TOKEN_MAPBOX';
  static const String mapboxStyleUrl =
      'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=';

  // Tile server OSM (fallback gratuit)
  static const String osmTileUrl =
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  // Position par défaut : centre de Bissau
  static const double defaultLat = 11.8636;
  static const double defaultLng = -15.5977;
  static const double defaultZoom = 14.0;

  // GPS
  static const int gpsUpdateIntervalMs = 5000; // 5 secondes
  static const int gpsDistanceFilterM = 10; // 10 mètres minimum

  // Timeouts
  static const int apiTimeoutSeconds = 15;
  static const int wsReconnectDelaySeconds = 3;

  // Devise
  static const String currency = 'XOF';
  static const String currencySymbol = 'F CFA';

  // Mode dev
  static const bool isDev = true;

  static String get baseUrl => isDev ? apiBaseUrlDev : apiBaseUrl;
  static String get wsUrl => isDev ? wsBaseUrlDev : wsBaseUrl;
}
