/// Chat passager ↔ chauffeur pendant une course.
/// Messages prédéfinis par clé (affichés dans la langue de chacun) +
/// texte libre. Polling REST toutes les 3 s (compatible prod WSGI).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api/api_client.dart';
import '../core/theme/app_theme.dart';
import '../i18n/app_localizations.dart';
import '../models/ride.dart';

/// Clés synchronisées avec le backend (apps/rides/chat_messages.py)
const kChatQuickKeys = [
  'chat_where_are_you',
  'chat_im_coming',
  'chat_im_here',
  'chat_at_pickup',
  'chat_wait_2min',
  'chat_traffic',
  'chat_call_me',
  'chat_ok',
];

/// Bouton d'ouverture du chat, avec badge de messages non lus.
class RideChatButton extends StatefulWidget {
  final String rideId;

  /// Rôle de l'utilisateur courant : 'passenger' ou 'driver'
  final String role;

  const RideChatButton({super.key, required this.rideId, required this.role});

  @override
  State<RideChatButton> createState() => _RideChatButtonState();
}

class _RideChatButtonState extends State<RideChatButton> {
  List<RideMessage> _messages = [];
  DateTime _lastSeenAt = DateTime.now();
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _load();
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) => _load());
  }

  Future<void> _load() async {
    try {
      final api = context.read<ApiClient>();
      final response = await api.get('/rides/${widget.rideId}/messages');
      if (!mounted) return;
      setState(() {
        _messages = (response.data as List)
            .map((j) => RideMessage.fromJson(j as Map<String, dynamic>))
            .toList();
      });
    } catch (_) {}
  }

  int get _unread => _messages
      .where((m) =>
          m.senderRole != widget.role && m.createdAt.isAfter(_lastSeenAt))
      .length;

  Future<void> _openChat() async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => RideChatSheet(rideId: widget.rideId, role: widget.role),
    );
    // Tout est lu à la fermeture du chat
    if (mounted) {
      setState(() => _lastSeenAt = DateTime.now());
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final unread = _unread;

    return OutlinedButton.icon(
      onPressed: _openChat,
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          const Icon(Icons.chat_bubble_outline, size: 18),
          if (unread > 0)
            Positioned(
              top: -6,
              right: -8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: AppColors.error,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text('$unread',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold)),
              ),
            ),
        ],
      ),
      label: Text(l.get('chat_title')),
    );
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }
}

/// Panneau de conversation (bottom sheet).
class RideChatSheet extends StatefulWidget {
  final String rideId;
  final String role;

  const RideChatSheet({super.key, required this.rideId, required this.role});

  @override
  State<RideChatSheet> createState() => _RideChatSheetState();
}

class _RideChatSheetState extends State<RideChatSheet> {
  final _inputCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  List<RideMessage> _messages = [];
  Timer? _pollTimer;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) => _load());
  }

  Future<void> _load() async {
    try {
      final api = context.read<ApiClient>();
      final response = await api.get('/rides/${widget.rideId}/messages');
      if (!mounted) return;
      final messages = (response.data as List)
          .map((j) => RideMessage.fromJson(j as Map<String, dynamic>))
          .toList();
      final hadNew = messages.length != _messages.length;
      setState(() => _messages = messages);
      if (hadNew) _scrollToBottom();
    } catch (_) {}
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.jumpTo(_scrollCtrl.position.maxScrollExtent);
      }
    });
  }

  Future<void> _send({String? key, String? text}) async {
    if (_sending) return;
    setState(() => _sending = true);
    try {
      final api = context.read<ApiClient>();
      final response = await api.post(
        '/rides/${widget.rideId}/messages',
        data: {'message_key': key ?? '', 'text': text ?? ''},
      );
      if (mounted) {
        setState(() {
          _messages.add(
              RideMessage.fromJson(response.data as Map<String, dynamic>));
          _inputCtrl.clear();
        });
        _scrollToBottom();
      }
    } catch (_) {}
    if (mounted) setState(() => _sending = false);
  }

  /// Affiche un message prédéfini dans la langue de l'utilisateur.
  String _renderText(RideMessage m, AppLocalizations l) {
    if (m.messageKey.isNotEmpty) {
      final localized = l.get(m.messageKey);
      if (localized != m.messageKey) return localized;
    }
    return m.text;
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);

    return Padding(
      // Laisser la place au clavier
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.65,
        child: Column(
          children: [
            // En-tête
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 8, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '💬 ${widget.role == 'passenger' ? l.driver : l.passenger}',
                      style: const TextStyle(
                          fontSize: 17, fontWeight: FontWeight.bold),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),

            // Messages
            Expanded(
              child: _messages.isEmpty
                  ? Center(
                      child: Text(l.get('chat_empty'),
                          style: TextStyle(
                              fontSize: 13, color: AppColors.textSecondary)),
                    )
                  : ListView.builder(
                      controller: _scrollCtrl,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                      itemCount: _messages.length,
                      itemBuilder: (_, i) => _bubble(_messages[i], l),
                    ),
            ),

            // Messages rapides
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: kChatQuickKeys
                    .map((key) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ActionChip(
                            label: Text(l.get(key),
                                style: const TextStyle(fontSize: 12)),
                            backgroundColor:
                                AppColors.primary.withOpacity(0.08),
                            side: BorderSide.none,
                            onPressed:
                                _sending ? null : () => _send(key: key),
                          ),
                        ))
                    .toList(),
              ),
            ),

            // Saisie libre
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _inputCtrl,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (v) {
                        if (v.trim().isNotEmpty) _send(text: v.trim());
                      },
                      decoration: InputDecoration(
                        hintText: l.get('chat_placeholder'),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  CircleAvatar(
                    backgroundColor: AppColors.primary,
                    child: IconButton(
                      icon: const Icon(Icons.send,
                          color: Colors.white, size: 18),
                      onPressed: _sending
                          ? null
                          : () {
                              final text = _inputCtrl.text.trim();
                              if (text.isNotEmpty) _send(text: text);
                            },
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _bubble(RideMessage m, AppLocalizations l) {
    final mine = m.senderRole == widget.role;
    final time =
        '${m.createdAt.hour.toString().padLeft(2, '0')}:${m.createdAt.minute.toString().padLeft(2, '0')}';

    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.72),
        decoration: BoxDecoration(
          color: mine ? AppColors.primary : AppColors.background,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(mine ? 16 : 4),
            bottomRight: Radius.circular(mine ? 4 : 16),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _renderText(m, l),
              style: TextStyle(
                fontSize: 14,
                color: mine ? Colors.white : AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              time,
              style: TextStyle(
                fontSize: 10,
                color: mine
                    ? Colors.white.withOpacity(0.7)
                    : AppColors.textHint,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _inputCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }
}
