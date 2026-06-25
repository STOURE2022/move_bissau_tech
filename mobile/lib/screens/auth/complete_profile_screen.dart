/// Écran de complétion du profil — première connexion.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';

class CompleteProfileScreen extends StatefulWidget {
  const CompleteProfileScreen({super.key});

  @override
  State<CompleteProfileScreen> createState() => _CompleteProfileScreenState();
}

class _CompleteProfileScreenState extends State<CompleteProfileScreen> {
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  String _role = 'passenger';
  String _lang = 'fr';

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Compléter votre profil'),
        backgroundColor: Colors.transparent,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Prénom
            const Text('Prénom', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            TextField(
              controller: _firstNameCtrl,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                hintText: 'Votre prénom',
                prefixIcon: Icon(Icons.person_outline),
              ),
            ),
            const SizedBox(height: 20),

            // Nom
            const Text('Nom', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            TextField(
              controller: _lastNameCtrl,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                hintText: 'Votre nom',
                prefixIcon: Icon(Icons.person_outline),
              ),
            ),
            const SizedBox(height: 28),

            // Rôle
            const Text('Je suis...', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _roleCard('passenger', Icons.hail, 'Passager')),
                const SizedBox(width: 12),
                Expanded(child: _roleCard('driver', Icons.motorcycle, 'Chauffeur')),
              ],
            ),
            const SizedBox(height: 28),

            // Langue
            const Text('Langue préférée', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
            const SizedBox(height: 12),
            Row(
              children: [
                _langOption('Français', 'fr'),
                const SizedBox(width: 8),
                _langOption('Português', 'pt'),
                const SizedBox(width: 8),
                _langOption('Kriol', 'gcr'),
              ],
            ),
            const SizedBox(height: 32),

            if (auth.error != null) ...[
              Text(auth.error!,
                style: const TextStyle(color: AppColors.error),
                textAlign: TextAlign.center),
              const SizedBox(height: 12),
            ],

            ElevatedButton(
              onPressed: auth.isLoading ? null : _submit,
              child: auth.isLoading
                  ? const SizedBox(height: 20, width: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Continuer'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _roleCard(String role, IconData icon, String label) {
    final selected = _role == role;
    return GestureDetector(
      onTap: () => setState(() => _role = role),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 24),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary.withOpacity(0.1) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.divider,
            width: selected ? 2 : 1,
          ),
        ),
        child: Column(
          children: [
            Icon(icon, size: 48, color: selected ? AppColors.primary : AppColors.textSecondary),
            const SizedBox(height: 8),
            Text(label, style: TextStyle(
              fontWeight: FontWeight.w600,
              color: selected ? AppColors.primary : AppColors.textPrimary,
            )),
          ],
        ),
      ),
    );
  }

  Widget _langOption(String label, String code) {
    final selected = _lang == code;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _lang = code),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: selected ? AppColors.primary : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: selected ? AppColors.primary : AppColors.divider),
          ),
          child: Center(
            child: Text(label, style: TextStyle(
              color: selected ? Colors.white : AppColors.textPrimary,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            )),
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (_firstNameCtrl.text.isEmpty || _lastNameCtrl.text.isEmpty) return;

    final auth = context.read<AuthProvider>();
    final success = await auth.completeProfile(
      firstName: _firstNameCtrl.text.trim(),
      lastName: _lastNameCtrl.text.trim(),
      role: _role,
      lang: _lang,
    );

    if (success && mounted) {
      context.go(auth.isDriver ? '/driver' : '/passenger');
    }
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    super.dispose();
  }
}
