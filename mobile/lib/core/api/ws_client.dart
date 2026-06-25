/// Client WebSocket pour la communication temps réel.
/// Gère la reconnexion automatique en cas de perte de connexion.
import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../../config/app_config.dart';

class WsClient {
  WebSocketChannel? _channel;
  StreamController<Map<String, dynamic>>? _messageController;
  Timer? _reconnectTimer;
  String? _url;
  String? _token;
  bool _isConnected = false;
  bool _shouldReconnect = true;

  bool get isConnected => _isConnected;
  Stream<Map<String, dynamic>>? get messages => _messageController?.stream;

  /// Se connecte à un canal WebSocket
  Future<void> connect(String path, String token) async {
    _token = token;
    _url = '${AppConfig.wsUrl}/$path?token=$token';
    _shouldReconnect = true;
    _messageController = StreamController<Map<String, dynamic>>.broadcast();

    _doConnect();
  }

  void _doConnect() {
    if (_url == null) return;

    try {
      _channel = WebSocketChannel.connect(Uri.parse(_url!));

      _channel!.stream.listen(
        (data) {
          _isConnected = true;
          try {
            final decoded = jsonDecode(data as String) as Map<String, dynamic>;
            _messageController?.add(decoded);
          } catch (_) {}
        },
        onError: (error) {
          _isConnected = false;
          _scheduleReconnect();
        },
        onDone: () {
          _isConnected = false;
          _scheduleReconnect();
        },
      );
    } catch (_) {
      _scheduleReconnect();
    }
  }

  /// Envoie un message JSON
  void send(Map<String, dynamic> data) {
    if (_channel != null && _isConnected) {
      _channel!.sink.add(jsonEncode(data));
    }
  }

  /// Programme une reconnexion
  void _scheduleReconnect() {
    if (!_shouldReconnect) return;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(
      Duration(seconds: AppConfig.wsReconnectDelaySeconds),
      _doConnect,
    );
  }

  /// Ferme la connexion
  void disconnect() {
    _shouldReconnect = false;
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    _messageController?.close();
    _isConnected = false;
  }
}
