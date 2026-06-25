/// Écran de suivi de course en temps réel — GPS chauffeur + statuts + SOS.
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/app_config.dart';
import '../../core/providers/ride_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../i18n/app_localizations.dart';

class RideTrackingScreen extends StatefulWidget {
  final String rideId;
  const RideTrackingScreen({super.key, required this.rideId});

  @override
  State<RideTrackingScreen> createState() => _RideTrackingScreenState();
}

class _RideTrackingScreenState extends State<RideTrackingScreen> {
  final _mapController = MapController();

  @override
  void initState() {
    super.initState();
    // Charger les détails de la course si pas déjà chargée
    final ride = context.read<RideProvider>();
    if (ride.currentRide == null || ride.currentRide!.id != widget.rideId) {
      ride.getRide(widget.rideId);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rideProvider = context.watch<RideProvider>();
    final ride = rideProvider.currentRide;
    final driverPos = rideProvider.driverLocation;
    final l = AppLocalizations.of(context);

    if (ride == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    // Rediriger vers paiement si terminée
    if (ride.isCompleted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.go('/passenger/payment/${ride.id}');
      });
    }

    // Rediriger vers notation si payée
    if (ride.isPaid) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.go('/rating/${ride.id}');
      });
    }

    return Scaffold(
      body: Stack(
        children: [
          // Carte avec position du chauffeur
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: driverPos ?? LatLng(AppConfig.defaultLat, AppConfig.defaultLng),
              initialZoom: 16,
            ),
            children: [
              TileLayer(urlTemplate: AppConfig.osmTileUrl, userAgentPackageName: 'com.movebissau.app'),
              MarkerLayer(
                markers: [
                  // Position du chauffeur
                  if (driverPos != null)
                    Marker(
                      point: driverPos,
                      width: 44, height: 44,
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 3),
                        ),
                        child: Icon(
                          ride.vehicleType == 'moto' ? Icons.motorcycle : Icons.directions_car,
                          color: Colors.white, size: 22,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),

          // Bouton retour
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: CircleAvatar(
                backgroundColor: Colors.white,
                child: IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () => context.go('/passenger'),
                ),
              ),
            ),
          ),

          // Panel inférieur
          Positioned(
            left: 0, right: 0, bottom: 0,
            child: Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 10)],
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Statut
                  _statusBanner(ride.status, l),
                  const Divider(height: 24),

                  // Info chauffeur
                  Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: AppColors.primary.withOpacity(0.1),
                        radius: 24,
                        child: Icon(
                          ride.vehicleType == 'moto' ? Icons.motorcycle : Icons.directions_car,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(ride.driverName,
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                            if (ride.driverVehicle != null)
                              Text(
                                '${ride.driverVehicle!['brand']} ${ride.driverVehicle!['model']} - ${ride.driverVehicle!['color']}',
                                style: TextStyle(color: AppColors.textSecondary),
                              ),
                          ],
                        ),
                      ),
                      Text('${ride.agreedPrice} F',
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Boutons d'action
                  Row(
                    children: [
                      // Appeler le chauffeur
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _callDriver(ride.driverPhoneMasked),
                          icon: const Icon(Icons.phone),
                          label: const Text('Appeler'),
                        ),
                      ),
                      const SizedBox(width: 8),

                      // Partager le trajet
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _shareTrip(context),
                          icon: const Icon(Icons.share),
                          label: Text(l.shareTrip),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Boutons SOS + Annuler
                  Row(
                    children: [
                      // SOS
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => _triggerSos(context),
                          icon: const Icon(Icons.warning),
                          label: Text(l.sos),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.error,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),

                      // Annuler
                      if (ride.status != 'passenger_onboard')
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => _cancelRide(context),
                            style: OutlinedButton.styleFrom(foregroundColor: AppColors.error),
                            child: Text(l.cancel),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusBanner(String status, AppLocalizations l) {
    final Map<String, Map<String, dynamic>> statusInfo = {
      'driver_assigned': {'text': l.driverEnRoute, 'color': AppColors.info, 'icon': Icons.person_pin},
      'driver_en_route': {'text': l.driverEnRoute, 'color': AppColors.info, 'icon': Icons.navigation},
      'driver_arrived': {'text': l.driverArrived, 'color': AppColors.success, 'icon': Icons.place},
      'passenger_onboard': {'text': l.onBoard, 'color': AppColors.primary, 'icon': Icons.directions},
      'completed': {'text': l.rideCompleted, 'color': AppColors.success, 'icon': Icons.check_circle},
    };

    final info = statusInfo[status] ?? {'text': status, 'color': AppColors.info, 'icon': Icons.info};

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      decoration: BoxDecoration(
        color: (info['color'] as Color).withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(info['icon'] as IconData, color: info['color'] as Color),
          const SizedBox(width: 12),
          Text(info['text'] as String,
            style: TextStyle(
              fontSize: 16, fontWeight: FontWeight.w600,
              color: info['color'] as Color,
            )),
        ],
      ),
    );
  }

  void _callDriver(String? phone) {
    if (phone != null && phone != '***masqué***') {
      launchUrl(Uri.parse('tel:$phone'));
    }
  }

  Future<void> _shareTrip(BuildContext context) async {
    final url = await context.read<RideProvider>().shareTrip(widget.rideId);
    if (url != null) {
      Share.share('Suivez mon trajet MoveBissau : $url');
    }
  }

  Future<void> _triggerSos(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('SOS Urgence'),
        content: const Text('Confirmer l\'appel d\'urgence ? Les services seront alertés.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Non')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('OUI, SOS'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      await context.read<RideProvider>().triggerSos(widget.rideId);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('SOS envoyé ! Les services ont été alertés.'),
            backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _cancelRide(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Annuler la course ?'),
        content: const Text('Des frais d\'annulation de 500 F CFA seront appliqués.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Non')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Annuler'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      await context.read<RideProvider>().cancelRide(widget.rideId);
      if (context.mounted) context.go('/passenger');
    }
  }
}
