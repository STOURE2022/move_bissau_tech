/// Écran course en cours côté chauffeur — carte, passager, progression
/// des statuts, encaissement et annulation.
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/app_config.dart';
import '../../core/providers/driver_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../i18n/app_localizations.dart';
import '../../models/ride.dart';

class DriverRideScreen extends StatefulWidget {
  final String rideId;
  const DriverRideScreen({super.key, required this.rideId});

  @override
  State<DriverRideScreen> createState() => _DriverRideScreenState();
}

class _DriverRideScreenState extends State<DriverRideScreen> {
  bool _isSubmitting = false;
  bool _leaving = false;

  @override
  void initState() {
    super.initState();
    final driver = context.read<DriverProvider>();
    if (driver.activeRide == null || driver.activeRide!.id != widget.rideId) {
      driver.loadActiveRide(widget.rideId);
    }
  }

  /// Gère les fins de course déclenchées côté serveur (annulation passager…)
  void _handleStateChanges(DriverProvider driver, AppLocalizations l) {
    final ride = driver.activeRide;
    if (ride == null || ride.id != widget.rideId || _leaving) return;

    if (ride.isCancelled) {
      _leaving = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final byPassenger = ride.cancelledBy == 'passenger';
        driver.clearNotice();
        driver.clearActiveRide();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(l.get(
                byPassenger ? 'ride_cancelled_by_passenger' : 'ride_cancelled')),
            backgroundColor: AppColors.warning,
          ),
        );
        context.go('/driver');
      });
    } else if (ride.isPaid) {
      _leaving = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        driver.clearActiveRide();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(l.get('payment_confirmed')),
            backgroundColor: AppColors.success,
          ),
        );
        context.go('/driver');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final driver = context.watch<DriverProvider>();
    final ride = driver.activeRide;
    final l = AppLocalizations.of(context);

    if (ride == null || ride.id != widget.rideId) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    _handleStateChanges(driver, l);

    return Scaffold(
      body: Stack(
        children: [
          _buildMap(ride, driver.currentPosition),

          // Bouton retour (la course continue en arrière-plan)
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: CircleAvatar(
                backgroundColor: Colors.white,
                child: IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () => context.go('/driver'),
                ),
              ),
            ),
          ),

          // Panneau inférieur
          Positioned(
            left: 0, right: 0, bottom: 0,
            child: Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 10)],
              ),
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
              child: ride.isCompleted
                  ? _paymentPanel(ride, l)
                  : _ridePanel(ride, l),
            ),
          ),
        ],
      ),
    );
  }

  // === Carte ===

  Widget _buildMap(Ride ride, LatLng? driverPos) {
    final points = <LatLng>[
      if (ride.pickupLocation != null) ride.pickupLocation!,
      if (ride.dropoffLocation != null) ride.dropoffLocation!,
      if (driverPos != null) driverPos,
    ];

    final options = points.length >= 2
        ? MapOptions(
            initialCameraFit: CameraFit.coordinates(
              coordinates: points,
              padding: const EdgeInsets.fromLTRB(60, 100, 60, 320),
            ),
          )
        : MapOptions(
            initialCenter: points.isNotEmpty
                ? points.first
                : LatLng(AppConfig.defaultLat, AppConfig.defaultLng),
            initialZoom: 15,
          );

    return FlutterMap(
      options: options,
      children: [
        TileLayer(
          urlTemplate: AppConfig.osmTileUrl,
          userAgentPackageName: 'com.movebissau.app',
        ),
        MarkerLayer(
          markers: [
            if (ride.pickupLocation != null)
              Marker(
                point: ride.pickupLocation!,
                width: 36, height: 36,
                child: const Icon(Icons.radio_button_on,
                    color: AppColors.primary, size: 28),
              ),
            if (ride.dropoffLocation != null)
              Marker(
                point: ride.dropoffLocation!,
                width: 40, height: 40,
                child: const Icon(Icons.location_on,
                    color: AppColors.error, size: 36),
              ),
            if (driverPos != null)
              Marker(
                point: driverPos,
                width: 44, height: 44,
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.info,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 3),
                  ),
                  child: Icon(
                    ride.vehicleType == 'moto'
                        ? Icons.motorcycle
                        : Icons.directions_car,
                    color: Colors.white, size: 22,
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }

  // === Panneau course en cours ===

  Widget _ridePanel(Ride ride, AppLocalizations l) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _statusBanner(ride.status, l),
        const SizedBox(height: 16),

        // Passager + prix
        Row(
          children: [
            CircleAvatar(
              backgroundColor: AppColors.primary.withOpacity(0.1),
              radius: 24,
              backgroundImage: ride.passengerAvatar.isNotEmpty
                  ? CachedNetworkImageProvider(ride.passengerAvatar)
                  : null,
              child: ride.passengerAvatar.isEmpty
                  ? const Icon(Icons.person, color: AppColors.primary)
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(ride.passengerName,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                  Text(ride.vehicleType == 'moto' ? l.moto : l.car,
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                ],
              ),
            ),
            Text('${ride.agreedPrice} F',
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(width: 8),
            if (ride.passengerPhone != null)
              CircleAvatar(
                backgroundColor: AppColors.primary,
                child: IconButton(
                  icon: const Icon(Icons.phone, color: Colors.white, size: 20),
                  tooltip: l.get('call'),
                  onPressed: () =>
                      launchUrl(Uri.parse('tel:${ride.passengerPhone}')),
                ),
              ),
          ],
        ),
        const Divider(height: 24),

        // Adresses
        Row(
          children: [
            const Icon(Icons.radio_button_on, size: 14, color: AppColors.primary),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                ride.pickupAddress.isNotEmpty ? ride.pickupAddress : l.get('pickup_point'),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            const Icon(Icons.location_on, size: 14, color: AppColors.error),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                ride.dropoffAddress.isNotEmpty ? ride.dropoffAddress : l.get('dropoff_point'),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),

        // Action principale selon le statut
        _actionButton(ride, l),

        // Annuler (tant que le passager n'est pas à bord)
        if (ride.status != 'passenger_onboard') ...[
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: _isSubmitting ? null : () => _showCancelSheet(ride, l),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.error,
              side: const BorderSide(color: AppColors.error),
            ),
            child: Text(l.cancel),
          ),
        ],
      ],
    );
  }

  Widget _statusBanner(String status, AppLocalizations l) {
    final Map<String, Map<String, dynamic>> statusInfo = {
      'driver_assigned': {'text': l.get('driver_assigned_label'), 'color': AppColors.info, 'icon': Icons.check_circle_outline},
      'driver_en_route': {'text': l.driverEnRoute, 'color': AppColors.info, 'icon': Icons.navigation},
      'driver_arrived': {'text': l.driverArrived, 'color': AppColors.success, 'icon': Icons.place},
      'passenger_onboard': {'text': l.onBoard, 'color': AppColors.primary, 'icon': Icons.directions},
    };

    final info = statusInfo[status] ??
        {'text': status, 'color': AppColors.info, 'icon': Icons.info};

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

  Widget _actionButton(Ride ride, AppLocalizations l) {
    final Map<String, Map<String, dynamic>> actions = {
      'driver_assigned': {
        'label': l.get('im_en_route'),
        'next': 'driver_en_route',
        'color': AppColors.info,
        'icon': Icons.navigation,
      },
      'driver_en_route': {
        'label': l.get('im_arrived'),
        'next': 'driver_arrived',
        'color': AppColors.primary,
        'icon': Icons.place,
      },
      'driver_arrived': {
        'label': l.get('passenger_aboard'),
        'next': 'passenger_onboard',
        'color': AppColors.primary,
        'icon': Icons.person_add,
      },
      'passenger_onboard': {
        'label': l.get('finish_ride'),
        'next': 'completed',
        'color': AppColors.success,
        'icon': Icons.flag,
      },
    };

    final action = actions[ride.status];
    if (action == null) return const SizedBox();

    return ElevatedButton.icon(
      onPressed: _isSubmitting
          ? null
          : () => _updateStatus(action['next'] as String),
      icon: Icon(action['icon'] as IconData),
      label: Text(action['label'] as String, style: const TextStyle(fontSize: 18)),
      style: ElevatedButton.styleFrom(
        backgroundColor: action['color'] as Color,
        padding: const EdgeInsets.symmetric(vertical: 16),
      ),
    );
  }

  // === Panneau encaissement (course terminée) ===

  Widget _paymentPanel(Ride ride, AppLocalizations l) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
          decoration: BoxDecoration(
            color: AppColors.success.withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              const Icon(Icons.check_circle, color: AppColors.success),
              const SizedBox(width: 12),
              Text(l.rideCompleted,
                style: const TextStyle(
                  fontSize: 16, fontWeight: FontWeight.w600,
                  color: AppColors.success,
                )),
            ],
          ),
        ),
        const SizedBox(height: 20),

        Text(l.get('collect_cash'),
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.textSecondary)),
        const SizedBox(height: 4),
        Text('${ride.amountDue} F CFA',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 40, fontWeight: FontWeight.bold)),

        if (ride.discountAmount > 0) ...[
          const SizedBox(height: 4),
          Text(
            l.getf('driver_promo_note', {'amount': '${ride.discountAmount}'}),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, color: AppColors.success),
          ),
        ],

        if (ride.commissionAmount != null) ...[
          const SizedBox(height: 4),
          Text(
            l.getf('commission_info', {'amount': '${ride.commissionAmount}'}),
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
        ],
        const SizedBox(height: 20),

        ElevatedButton.icon(
          onPressed: _isSubmitting ? null : _confirmCash,
          icon: const Icon(Icons.payments),
          label: Text(l.get('confirm_cash'), style: const TextStyle(fontSize: 17)),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.success,
            padding: const EdgeInsets.symmetric(vertical: 16),
          ),
        ),
      ],
    );
  }

  // === Actions ===

  Future<void> _updateStatus(String nextStatus) async {
    setState(() => _isSubmitting = true);
    final ok = await context
        .read<DriverProvider>()
        .updateRideStatus(widget.rideId, nextStatus);
    if (mounted) {
      setState(() => _isSubmitting = false);
      if (!ok) {
        final l = AppLocalizations.of(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l.get('error')), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _confirmCash() async {
    setState(() => _isSubmitting = true);
    final driver = context.read<DriverProvider>();
    final ok = await driver.confirmCashPayment(widget.rideId);
    if (!mounted) return;
    setState(() => _isSubmitting = false);

    final l = AppLocalizations.of(context);
    if (ok) {
      _leaving = true;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(l.get('payment_confirmed')),
          backgroundColor: AppColors.success,
        ),
      );
      context.go('/driver');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l.get('error')), backgroundColor: AppColors.error),
      );
    }
  }

  Future<void> _showCancelSheet(Ride ride, AppLocalizations l) async {
    final reasons = [
      'reason_passenger_unreachable',
      'reason_wrong_pickup',
      'reason_vehicle_issue',
      'reason_other',
    ];
    String selected = reasons.first;

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l.get('cancel_ride_q'),
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(l.get('cancel_fee_warning'),
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
              const SizedBox(height: 16),

              Text(l.get('cancel_reason'),
                style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              ...reasons.map((r) => RadioListTile<String>(
                    value: r,
                    groupValue: selected,
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(l.get(r)),
                    onChanged: (v) => setSheetState(() => selected = v!),
                  )),
              const SizedBox(height: 16),

              ElevatedButton(
                onPressed: () => Navigator.pop(sheetContext, true),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
                child: Text(l.get('confirm_cancel_ride')),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () => Navigator.pop(sheetContext, false),
                child: Text(l.get('keep_ride')),
              ),
            ],
          ),
        ),
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _isSubmitting = true);
    final driver = context.read<DriverProvider>();
    final ok = await driver.cancelActiveRide(widget.rideId, l.get(selected));
    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (ok) {
      _leaving = true;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(l.get('ride_cancelled')),
          backgroundColor: AppColors.warning,
        ),
      );
      context.go('/driver');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l.get('error')), backgroundColor: AppColors.error),
      );
    }
  }
}
