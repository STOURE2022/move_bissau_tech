/// Écran de demande de course — sélection destination + proposition de prix.
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../../config/app_config.dart';
import '../../core/providers/ride_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../i18n/app_localizations.dart';
import '../../models/ride.dart';

class RideRequestScreen extends StatefulWidget {
  const RideRequestScreen({super.key});

  @override
  State<RideRequestScreen> createState() => _RideRequestScreenState();
}

class _RideRequestScreenState extends State<RideRequestScreen> {
  final _pickupCtrl = TextEditingController();
  final _dropoffCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _mapController = MapController();

  LatLng? _pickupLocation;
  LatLng? _dropoffLocation;
  String _vehicleType = 'moto';
  PriceEstimate? _estimate;
  bool _selectingDropoff = false;

  @override
  void initState() {
    super.initState();
    _setCurrentLocationAsPickup();
  }

  Future<void> _setCurrentLocationAsPickup() async {
    try {
      final position = await Geolocator.getCurrentPosition();
      setState(() {
        _pickupLocation = LatLng(position.latitude, position.longitude);
        _pickupCtrl.text = 'Ma position actuelle';
      });
    } catch (_) {
      _pickupLocation = LatLng(AppConfig.defaultLat, AppConfig.defaultLng);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ride = context.watch<RideProvider>();
    final l = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(l.whereToGo)),
      body: Column(
        children: [
          // Champs départ/arrivée
          Container(
            color: Colors.white,
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                // Départ
                TextField(
                  controller: _pickupCtrl,
                  decoration: InputDecoration(
                    labelText: l.get('pickup'),
                    prefixIcon: const Icon(Icons.radio_button_on, color: AppColors.primary, size: 18),
                    filled: true,
                  ),
                  readOnly: true,
                ),
                const SizedBox(height: 12),

                // Destination
                TextField(
                  controller: _dropoffCtrl,
                  decoration: InputDecoration(
                    labelText: l.get('destination'),
                    prefixIcon: const Icon(Icons.location_on, color: AppColors.error, size: 18),
                    hintText: 'Touchez la carte pour choisir',
                    filled: true,
                  ),
                  readOnly: true,
                ),
                const SizedBox(height: 12),

                // Type de véhicule
                Row(
                  children: [
                    Expanded(child: _vehicleChip('moto', Icons.motorcycle, l.moto)),
                    const SizedBox(width: 8),
                    Expanded(child: _vehicleChip('car', Icons.directions_car, l.car)),
                  ],
                ),
              ],
            ),
          ),

          // Carte
          Expanded(
            child: FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: _pickupLocation ?? LatLng(AppConfig.defaultLat, AppConfig.defaultLng),
                initialZoom: 15,
                onTap: (_, point) {
                  setState(() {
                    _dropoffLocation = point;
                    _dropoffCtrl.text = '${point.latitude.toStringAsFixed(4)}, ${point.longitude.toStringAsFixed(4)}';
                  });
                  _getEstimate();
                },
              ),
              children: [
                TileLayer(urlTemplate: AppConfig.osmTileUrl, userAgentPackageName: 'com.movebissau.app'),
                MarkerLayer(
                  markers: [
                    if (_pickupLocation != null)
                      Marker(
                        point: _pickupLocation!,
                        width: 36, height: 36,
                        child: const Icon(Icons.radio_button_on, color: AppColors.primary, size: 24),
                      ),
                    if (_dropoffLocation != null)
                      Marker(
                        point: _dropoffLocation!,
                        width: 36, height: 36,
                        child: const Icon(Icons.location_on, color: AppColors.error, size: 32),
                      ),
                  ],
                ),
              ],
            ),
          ),

          // Panel de prix
          if (_estimate != null)
            Container(
              color: Colors.white,
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  // Info distance et prix suggéré
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _infoChip(Icons.straighten, '${_estimate!.distanceKm} ${l.km}'),
                      _infoChip(Icons.attach_money, '${l.suggestedPrice}: ${_estimate!.suggestedPrice} F'),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${l.minPrice}: ${_estimate!.minPrice} F — ${l.maxPrice}: ${_estimate!.maxPrice} F',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 16),

                  // Saisie du prix
                  Text(l.proposePrice, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _priceCtrl,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                    decoration: InputDecoration(
                      suffixText: 'F CFA',
                      suffixStyle: TextStyle(fontSize: 16, color: AppColors.textSecondary),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Bouton envoyer
                  ElevatedButton(
                    onPressed: ride.isLoading ? null : _sendRequest,
                    child: ride.isLoading
                        ? const SizedBox(height: 20, width: 20,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Text(l.sendRequest),
                  ),

                  if (ride.error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(ride.error!, style: const TextStyle(color: AppColors.error)),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _vehicleChip(String type, IconData icon, String label) {
    final selected = _vehicleType == type;
    return GestureDetector(
      onTap: () {
        setState(() => _vehicleType = type);
        if (_dropoffLocation != null) _getEstimate();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected ? AppColors.primary : AppColors.divider),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 20, color: selected ? Colors.white : AppColors.textSecondary),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : AppColors.textPrimary,
            )),
          ],
        ),
      ),
    );
  }

  Widget _infoChip(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.textSecondary),
        const SizedBox(width: 4),
        Text(text, style: TextStyle(color: AppColors.textSecondary)),
      ],
    );
  }

  Future<void> _getEstimate() async {
    if (_pickupLocation == null || _dropoffLocation == null) return;

    final estimate = await context.read<RideProvider>().getEstimate(
      pickup: _pickupLocation!,
      dropoff: _dropoffLocation!,
      vehicleType: _vehicleType,
    );

    if (estimate != null) {
      setState(() {
        _estimate = estimate;
        _priceCtrl.text = estimate.suggestedPrice.toString();
      });
    }
  }

  Future<void> _sendRequest() async {
    if (_pickupLocation == null || _dropoffLocation == null || _priceCtrl.text.isEmpty) return;

    final price = int.tryParse(_priceCtrl.text);
    if (price == null || price <= 0) return;

    final request = await context.read<RideProvider>().createRequest(
      pickup: _pickupLocation!,
      dropoff: _dropoffLocation!,
      pickupAddress: _pickupCtrl.text,
      dropoffAddress: _dropoffCtrl.text,
      proposedPrice: price,
      vehicleType: _vehicleType,
    );

    if (request != null && mounted) {
      context.push('/passenger/offers/${request.id}');
    }
  }

  @override
  void dispose() {
    _pickupCtrl.dispose();
    _dropoffCtrl.dispose();
    _priceCtrl.dispose();
    super.dispose();
  }
}
