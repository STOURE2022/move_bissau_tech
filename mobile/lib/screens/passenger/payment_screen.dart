/// Écran de paiement — choix cash ou mobile money.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/api/api_client.dart';
import '../../core/providers/ride_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../i18n/app_localizations.dart';

class PaymentScreen extends StatefulWidget {
  final String rideId;
  const PaymentScreen({super.key, required this.rideId});

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  String _method = 'cash';
  final _phoneCtrl = TextEditingController();
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    context.read<RideProvider>().getRide(widget.rideId);
  }

  @override
  Widget build(BuildContext context) {
    final ride = context.watch<RideProvider>().currentRide;
    final l = AppLocalizations.of(context);

    if (ride == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: Text(l.pay)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Récapitulatif course
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Text(l.rideCompleted,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(l.get('price'), style: TextStyle(color: AppColors.textSecondary)),
                        Text('${ride.agreedPrice} F CFA',
                          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const Divider(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(ride.pickupAddress, style: const TextStyle(fontSize: 13)),
                        const Icon(Icons.arrow_forward, size: 16),
                        Text(ride.dropoffAddress, style: const TextStyle(fontSize: 13)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Choix mode de paiement
            Text(l.get('payment_method'),
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),

            // Cash
            _paymentMethodCard(
              'cash',
              Icons.payments,
              l.cash,
              'Payez directement au chauffeur',
              AppColors.success,
            ),
            const SizedBox(height: 8),

            // Orange Money
            _paymentMethodCard(
              'orange_money',
              Icons.phone_android,
              'Orange Money',
              'Paiement via votre compte Orange Money',
              Colors.orange,
            ),
            const SizedBox(height: 8),

            // Moov Money
            _paymentMethodCard(
              'moov_money',
              Icons.phone_android,
              'Moov Money',
              'Paiement via votre compte Moov Money',
              Colors.blue,
            ),
            const SizedBox(height: 16),

            // Champ téléphone pour mobile money
            if (_method != 'cash') ...[
              TextField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Numéro de téléphone',
                  hintText: '+245 XX XXX XXXX',
                  prefixIcon: Icon(Icons.phone),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Bouton payer
            ElevatedButton(
              onPressed: _isProcessing ? null : _pay,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: _isProcessing
                  ? const SizedBox(height: 20, width: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Text('${l.pay} ${ride.agreedPrice} F CFA',
                      style: const TextStyle(fontSize: 18)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _paymentMethodCard(String method, IconData icon, String title, String subtitle, Color color) {
    final selected = _method == method;
    return GestureDetector(
      onTap: () => setState(() => _method = method),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: selected ? color.withOpacity(0.05) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? color : AppColors.divider,
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 32),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: color)),
                  Text(subtitle, style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                ],
              ),
            ),
            if (selected)
              Icon(Icons.check_circle, color: color),
          ],
        ),
      ),
    );
  }

  Future<void> _pay() async {
    setState(() => _isProcessing = true);
    final api = context.read<ApiClient>();

    try {
      if (_method == 'cash') {
        // Pour le cash, le chauffeur confirme côté chauffeur
        // On affiche un message et on redirige
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Payez le chauffeur en espèces. Merci !')),
          );
          context.go('/rating/${widget.rideId}');
        }
      } else {
        if (_phoneCtrl.text.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Entrez votre numéro de téléphone')),
          );
          setState(() => _isProcessing = false);
          return;
        }

        await api.post('/payments/initiate', data: {
          'ride_id': widget.rideId,
          'payment_method': _method,
          'phone': _phoneCtrl.text.trim(),
        });

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Paiement initié. Confirmez sur votre téléphone.')),
          );
          context.go('/rating/${widget.rideId}');
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur de paiement'), backgroundColor: AppColors.error),
        );
      }
    }

    if (mounted) setState(() => _isProcessing = false);
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }
}
