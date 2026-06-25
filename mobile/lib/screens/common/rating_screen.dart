/// Écran de notation — noter la course après paiement.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/api/api_client.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../i18n/app_localizations.dart';

class RatingScreen extends StatefulWidget {
  final String rideId;
  const RatingScreen({super.key, required this.rideId});

  @override
  State<RatingScreen> createState() => _RatingScreenState();
}

class _RatingScreenState extends State<RatingScreen> {
  int _score = 5;
  final _commentCtrl = TextEditingController();
  bool _isSubmitting = false;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(l.rateRide)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Spacer(),

            // Étoiles
            Center(
              child: Text(l.get('your_rating'),
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(5, (i) {
                return GestureDetector(
                  onTap: () => setState(() => _score = i + 1),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: Icon(
                      i < _score ? Icons.star : Icons.star_border,
                      size: 48,
                      color: AppColors.secondary,
                    ),
                  ),
                );
              }),
            ),
            const SizedBox(height: 32),

            // Commentaire
            TextField(
              controller: _commentCtrl,
              maxLines: 3,
              maxLength: 500,
              decoration: InputDecoration(
                labelText: l.get('comment_optional'),
                alignLabelWithHint: true,
              ),
            ),

            const Spacer(),

            // Bouton
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              child: _isSubmitting
                  ? const SizedBox(height: 20, width: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Text(l.get('submit')),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => _goHome(),
              child: const Text('Passer'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);

    try {
      final api = context.read<ApiClient>();
      await api.post('/ratings/', data: {
        'ride_id': widget.rideId,
        'score': _score,
        'comment': _commentCtrl.text,
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Merci pour votre avis !'), backgroundColor: AppColors.success),
        );
        _goHome();
      }
    } catch (_) {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _goHome() {
    final auth = context.read<AuthProvider>();
    context.go(auth.isDriver ? '/driver' : '/passenger');
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }
}
