/// Écran course en cours côté chauffeur — progression des statuts.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/providers/driver_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../i18n/app_localizations.dart';

class DriverRideScreen extends StatefulWidget {
  final String rideId;
  const DriverRideScreen({super.key, required this.rideId});

  @override
  State<DriverRideScreen> createState() => _DriverRideScreenState();
}

class _DriverRideScreenState extends State<DriverRideScreen> {
  @override
  void initState() {
    super.initState();
    context.read<DriverProvider>().loadActiveRide(widget.rideId);
  }

  @override
  Widget build(BuildContext context) {
    final driver = context.watch<DriverProvider>();
    final ride = driver.activeRide;
    final l = AppLocalizations.of(context);

    if (ride == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Course en cours')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Prix
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Text('${ride.agreedPrice} F CFA',
                      style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold)),
                    Text(ride.vehicleType == 'moto' ? l.moto : l.car,
                      style: TextStyle(color: AppColors.textSecondary)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Adresses
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.radio_button_on, size: 14, color: AppColors.primary),
                        const SizedBox(width: 8),
                        Expanded(child: Text(ride.pickupAddress)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(Icons.location_on, size: 14, color: AppColors.error),
                        const SizedBox(width: 8),
                        Expanded(child: Text(ride.dropoffAddress)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Stepper de statut
            _statusStepper(ride.status, l),

            const Spacer(),

            // Bouton action principale
            _actionButton(ride.status, l),
            const SizedBox(height: 8),

            // Bouton annuler (si pas encore passager à bord)
            if (ride.status != 'passenger_onboard' && ride.status != 'completed')
              OutlinedButton(
                onPressed: () => _cancelRide(context),
                style: OutlinedButton.styleFrom(foregroundColor: AppColors.error),
                child: Text(l.cancel),
              ),
          ],
        ),
      ),
    );
  }

  Widget _statusStepper(String currentStatus, AppLocalizations l) {
    final statuses = [
      {'key': 'driver_assigned', 'label': 'Assigné'},
      {'key': 'driver_en_route', 'label': l.driverEnRoute},
      {'key': 'driver_arrived', 'label': l.driverArrived},
      {'key': 'passenger_onboard', 'label': l.onBoard},
      {'key': 'completed', 'label': l.rideCompleted},
    ];

    final currentIndex = statuses.indexWhere((s) => s['key'] == currentStatus);

    return Column(
      children: statuses.asMap().entries.map((entry) {
        final i = entry.key;
        final status = entry.value;
        final isActive = i <= currentIndex;
        final isCurrent = i == currentIndex;

        return Row(
          children: [
            Column(
              children: [
                Container(
                  width: 28, height: 28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isActive ? AppColors.primary : AppColors.divider,
                    border: isCurrent
                        ? Border.all(color: AppColors.primary, width: 3)
                        : null,
                  ),
                  child: isActive
                      ? const Icon(Icons.check, color: Colors.white, size: 16)
                      : null,
                ),
                if (i < statuses.length - 1)
                  Container(width: 2, height: 24,
                    color: isActive ? AppColors.primary : AppColors.divider),
              ],
            ),
            const SizedBox(width: 12),
            Text(status['label']!,
              style: TextStyle(
                fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                color: isActive ? AppColors.textPrimary : AppColors.textSecondary,
              )),
          ],
        );
      }).toList(),
    );
  }

  Widget _actionButton(String status, AppLocalizations l) {
    final Map<String, Map<String, dynamic>> actions = {
      'driver_assigned': {
        'label': 'Je suis en route',
        'next': 'driver_en_route',
        'color': AppColors.info,
      },
      'driver_en_route': {
        'label': 'Je suis arrivé',
        'next': 'driver_arrived',
        'color': AppColors.primary,
      },
      'driver_arrived': {
        'label': 'Passager à bord',
        'next': 'passenger_onboard',
        'color': AppColors.primary,
      },
      'passenger_onboard': {
        'label': 'Course terminée',
        'next': 'completed',
        'color': AppColors.success,
      },
      'completed': {
        'label': l.get('confirm_cash'),
        'next': null,
        'color': AppColors.success,
      },
    };

    final action = actions[status];
    if (action == null) return const SizedBox();

    return ElevatedButton(
      onPressed: () => _handleAction(status, action),
      style: ElevatedButton.styleFrom(
        backgroundColor: action['color'] as Color,
        padding: const EdgeInsets.symmetric(vertical: 16),
      ),
      child: Text(action['label'] as String, style: const TextStyle(fontSize: 18)),
    );
  }

  Future<void> _handleAction(String status, Map<String, dynamic> action) async {
    final driver = context.read<DriverProvider>();

    if (status == 'completed') {
      // Confirmer paiement cash
      final success = await driver.confirmCashPayment(widget.rideId);
      if (success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Paiement confirmé !'), backgroundColor: AppColors.success),
        );
        context.go('/driver');
      }
    } else {
      final nextStatus = action['next'] as String;
      await driver.updateRideStatus(widget.rideId, nextStatus);
    }
  }

  Future<void> _cancelRide(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Annuler la course ?'),
        content: const Text('Des frais de 500 F CFA seront déduits de votre crédit.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Non')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Annuler la course'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      final api = context.read<DriverProvider>();
      // Annulation via l'API rides
      context.go('/driver');
    }
  }
}
