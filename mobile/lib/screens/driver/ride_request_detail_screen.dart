/// Écran détail d'une demande — le chauffeur peut accepter ou contre-offrir.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/providers/driver_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../i18n/app_localizations.dart';

class RideRequestDetailScreen extends StatefulWidget {
  final String requestId;
  const RideRequestDetailScreen({super.key, required this.requestId});

  @override
  State<RideRequestDetailScreen> createState() => _RideRequestDetailScreenState();
}

class _RideRequestDetailScreenState extends State<RideRequestDetailScreen> {
  final _priceCtrl = TextEditingController();
  bool _isSubmitting = false;

  @override
  Widget build(BuildContext context) {
    final driver = context.watch<DriverProvider>();
    final l = AppLocalizations.of(context);

    // Trouver la demande dans la liste
    final request = driver.incomingRequests
        .where((r) => r['id'] == widget.requestId)
        .firstOrNull;

    if (request == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Demande')),
        body: const Center(child: Text('Demande expirée ou introuvable')),
      );
    }

    final proposedPrice = request['proposed_price'] as int;
    if (_priceCtrl.text.isEmpty) {
      _priceCtrl.text = proposedPrice.toString();
    }

    return Scaffold(
      appBar: AppBar(title: Text(l.get('new_request'))),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Prix proposé par le passager
            Card(
              color: AppColors.primary.withOpacity(0.05),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Text(l.get('passenger_proposed_price'),
                      style: TextStyle(color: AppColors.textSecondary)),
                    const SizedBox(height: 8),
                    Text('$proposedPrice F CFA',
                      style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: AppColors.primary)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Détails de la course
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.radio_button_on, size: 16, color: AppColors.primary),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(request['pickup_address'] ?? l.get('pickup_point'),
                            style: const TextStyle(fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                    Container(
                      margin: const EdgeInsets.only(left: 7),
                      height: 20,
                      width: 2,
                      color: AppColors.divider,
                    ),
                    Row(
                      children: [
                        const Icon(Icons.location_on, size: 16, color: AppColors.error),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(request['dropoff_address'] ?? l.get('dropoff_point'),
                            style: const TextStyle(fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _infoItem(Icons.straighten,
                          '${((request['estimated_distance_m'] ?? 0) / 1000).toStringAsFixed(1)} km',
                          l.get('distance')),
                        _infoItem(
                          request['vehicle_type'] == 'moto' ? Icons.motorcycle : Icons.directions_car,
                          request['vehicle_type'] == 'moto' ? l.moto : l.car,
                          l.get('vehicle')),
                        _infoItem(Icons.person, request['passenger_name'] ?? '', l.passenger),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Votre offre
            Text(l.get('your_offer'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            TextField(
              controller: _priceCtrl,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
              decoration: const InputDecoration(
                suffixText: 'F CFA',
                suffixStyle: TextStyle(fontSize: 16),
              ),
            ),
            const SizedBox(height: 8),

            // Raccourcis de prix
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _priceAdjust('-100', -100),
                _priceAdjust('-50', -50),
                _priceAdjust('=', 0, isReset: true),
                _priceAdjust('+50', 50),
                _priceAdjust('+100', 100),
              ],
            ),
            const SizedBox(height: 24),

            // Bouton accepter le prix du passager
            ElevatedButton(
              onPressed: _isSubmitting ? null : () => _submitOffer(proposedPrice),
              child: Text(l.get('accept_price')),
            ),
            const SizedBox(height: 8),

            // Bouton faire contre-offre
            OutlinedButton(
              onPressed: _isSubmitting ? null : () {
                final price = int.tryParse(_priceCtrl.text);
                if (price != null && price != proposedPrice) {
                  _submitOffer(price);
                }
              },
              child: Text('${l.get("counter_offer")} : ${_priceCtrl.text} F'),
            ),
            const SizedBox(height: 8),

            // Ignorer
            TextButton(
              onPressed: () {
                context.read<DriverProvider>().dismissRequest(widget.requestId);
                context.pop();
              },
              child: Text(l.get('ignore_request')),
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoItem(IconData icon, String value, String label) {
    return Column(
      children: [
        Icon(icon, color: AppColors.primary, size: 20),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        Text(label, style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
      ],
    );
  }

  Widget _priceAdjust(String label, int delta, {bool isReset = false}) {
    return GestureDetector(
      onTap: () {
        final current = int.tryParse(_priceCtrl.text) ?? 0;
        if (isReset) {
          final driver = context.read<DriverProvider>();
          final request = driver.incomingRequests
              .where((r) => r['id'] == widget.requestId).firstOrNull;
          if (request != null) {
            _priceCtrl.text = request['proposed_price'].toString();
          }
        } else {
          final newPrice = current + delta;
          if (newPrice > 0) _priceCtrl.text = newPrice.toString();
        }
        setState(() {});
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isReset ? AppColors.primary.withOpacity(0.1) : AppColors.background,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(label, style: TextStyle(
          fontWeight: FontWeight.w600,
          color: isReset ? AppColors.primary : AppColors.textPrimary,
        )),
      ),
    );
  }

  Future<void> _submitOffer(int price) async {
    setState(() => _isSubmitting = true);
    final success = await context.read<DriverProvider>().makeOffer(widget.requestId, price);

    if (mounted) {
      setState(() => _isSubmitting = false);
      final l = AppLocalizations.of(context);
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${l.get("offer_sent")} — ${l.get("waiting_passenger")}'),
            backgroundColor: AppColors.success,
          ),
        );
        context.pop();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l.get('error')), backgroundColor: AppColors.error),
        );
      }
    }
  }

  @override
  void dispose() {
    _priceCtrl.dispose();
    super.dispose();
  }
}
