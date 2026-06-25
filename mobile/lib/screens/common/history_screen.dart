/// Écran historique des courses.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/providers/ride_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../i18n/app_localizations.dart';
import '../../models/ride.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<Ride> _rides = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    final rides = await context.read<RideProvider>().getHistory();
    if (mounted) setState(() { _rides = rides; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(l.history)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _rides.isEmpty
              ? const Center(child: Text('Aucune course'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _rides.length,
                  itemBuilder: (_, i) => _buildRideCard(_rides[i]),
                ),
    );
  }

  Widget _buildRideCard(Ride ride) {
    final statusColor = switch (ride.status) {
      'paid' => AppColors.success,
      'cancelled' => AppColors.error,
      'completed' => AppColors.info,
      _ => AppColors.textSecondary,
    };

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(ride.vehicleType == 'moto' ? Icons.motorcycle : Icons.directions_car,
                  color: AppColors.primary, size: 20),
                const SizedBox(width: 8),
                Text('${ride.agreedPrice} F CFA',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(ride.status,
                    style: TextStyle(fontSize: 12, color: statusColor, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
            const Divider(height: 16),
            Text(ride.pickupAddress, style: const TextStyle(fontSize: 13)),
            const Text('→', style: TextStyle(color: AppColors.textSecondary)),
            Text(ride.dropoffAddress, style: const TextStyle(fontSize: 13)),
            const SizedBox(height: 4),
            Text(
              '${ride.createdAt.day}/${ride.createdAt.month}/${ride.createdAt.year}',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
