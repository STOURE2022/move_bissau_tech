/// Écran de saisie du code OTP reçu par SMS.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:pin_code_fields/pin_code_fields.dart';
import 'package:provider/provider.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';

class OtpScreen extends StatefulWidget {
  final String phone;
  const OtpScreen({super.key, required this.phone});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  String _code = '';

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Vérification'),
        backgroundColor: Colors.transparent,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 32),
            const Icon(Icons.sms_outlined, size: 64, color: AppColors.primary),
            const SizedBox(height: 24),
            Text(
              'Code envoyé au\n${widget.phone}',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 18),
            ),
            const SizedBox(height: 40),

            // Champ PIN
            PinCodeTextField(
              appContext: context,
              length: 6,
              onChanged: (value) => _code = value,
              onCompleted: (_) => _verify(),
              pinTheme: PinTheme(
                shape: PinCodeFieldShape.box,
                borderRadius: BorderRadius.circular(12),
                fieldHeight: 56,
                fieldWidth: 46,
                activeFillColor: Colors.white,
                inactiveFillColor: Colors.grey.shade50,
                selectedFillColor: Colors.white,
                activeColor: AppColors.primary,
                inactiveColor: AppColors.divider,
                selectedColor: AppColors.primary,
              ),
              enableActiveFill: true,
              keyboardType: TextInputType.number,
              animationType: AnimationType.fade,
            ),
            const SizedBox(height: 24),

            if (auth.error != null) ...[
              Text(auth.error!,
                style: const TextStyle(color: AppColors.error),
                textAlign: TextAlign.center),
              const SizedBox(height: 12),
            ],

            ElevatedButton(
              onPressed: auth.isLoading ? null : _verify,
              child: auth.isLoading
                  ? const SizedBox(height: 20, width: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Vérifier'),
            ),

            const SizedBox(height: 16),
            TextButton(
              onPressed: () => context.read<AuthProvider>().requestOtp(widget.phone),
              child: const Text('Renvoyer le code'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _verify() async {
    if (_code.length != 6) return;

    final auth = context.read<AuthProvider>();
    final success = await auth.verifyOtp(widget.phone, _code);

    if (success && mounted) {
      if (!auth.isProfileComplete) {
        context.go('/auth/complete-profile');
      } else {
        context.go(auth.isDriver ? '/driver' : '/passenger');
      }
    }
  }
}
