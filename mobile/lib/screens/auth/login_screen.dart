/// Écran de connexion — saisie du numéro de téléphone.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../i18n/app_localizations.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneController = TextEditingController(text: '+245');
  String _selectedLang = 'fr';

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final l = AppLocalizations(Locale(_selectedLang));

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),

              // Logo
              Center(
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Center(
                    child: Text('MB',
                      style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white)),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Center(
                child: Text('MoveBissau',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: AppColors.primary)),
              ),
              const SizedBox(height: 48),

              // Sélection de langue
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _langChip('FR', 'fr'),
                  const SizedBox(width: 8),
                  _langChip('PT', 'pt'),
                  const SizedBox(width: 8),
                  _langChip('Kriol', 'gcr'),
                ],
              ),
              const SizedBox(height: 32),

              // Champ téléphone
              Text(l.enterPhone,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
              const SizedBox(height: 8),
              TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  hintText: '+245 XX XXX XXXX',
                  prefixIcon: const Icon(Icons.phone, color: AppColors.primary),
                ),
                style: const TextStyle(fontSize: 18, letterSpacing: 1.5),
              ),
              const SizedBox(height: 24),

              // Bouton envoyer
              if (auth.error != null) ...[
                Text(auth.error!,
                  style: const TextStyle(color: AppColors.error),
                  textAlign: TextAlign.center),
                const SizedBox(height: 12),
              ],

              ElevatedButton(
                onPressed: auth.isLoading ? null : _sendOtp,
                child: auth.isLoading
                    ? const SizedBox(height: 20, width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : Text(l.sendCode),
              ),

              const Spacer(flex: 2),
            ],
          ),
        ),
      ),
    );
  }

  Widget _langChip(String label, String code) {
    final selected = _selectedLang == code;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      selectedColor: AppColors.primary,
      labelStyle: TextStyle(
        color: selected ? Colors.white : AppColors.textPrimary,
        fontWeight: FontWeight.w600,
      ),
      onSelected: (_) => setState(() => _selectedLang = code),
    );
  }

  Future<void> _sendOtp() async {
    final phone = _phoneController.text.trim();
    if (phone.length < 8) return;

    final success = await context.read<AuthProvider>().requestOtp(phone);
    if (success && mounted) {
      context.push('/auth/otp', extra: phone);
    }
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }
}
