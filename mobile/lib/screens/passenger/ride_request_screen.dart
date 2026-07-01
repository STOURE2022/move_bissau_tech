/// Écran de demande de course — sélection départ/destination par recherche
/// d'adresse ou carte (avec géocodage inverse) + proposition de prix.
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../../config/app_config.dart';
import '../../core/providers/ride_provider.dart';
import '../../core/services/geocoding_service.dart';
import '../../core/theme/app_theme.dart';
import '../../i18n/app_localizations.dart';
import '../../models/ride.dart';
import 'address_search_screen.dart';

class RideRequestScreen extends StatefulWidget {
  const RideRequestScreen({super.key});

  @override
  State<RideRequestScreen> createState() => _RideRequestScreenState();
}

class _RideRequestScreenState extends State<RideRequestScreen> {
  final _priceCtrl = TextEditingController();
  final _mapController = MapController();
  final _geocoding = GeocodingService();
  final _recentsStore = RecentPlacesStore();

  LatLng? _pickupLocation;
  LatLng? _dropoffLocation;
  String _pickupAddress = '';
  String _dropoffAddress = '';
  bool _resolvingDropoff = false;
  String _vehicleType = 'moto';
  PriceEstimate? _estimate;

  @override
  void initState() {
    super.initState();
    _setCurrentLocationAsPickup();
  }

  String get _lang => AppLocalizations.of(context).languageCode;

  /// Déplacer la carte sans planter si elle n'est pas encore montée.
  void _moveMap(LatLng point) {
    try {
      _mapController.move(point, 15);
    } catch (_) {}
  }

  Future<void> _setCurrentLocationAsPickup() async {
    LatLng position;
    try {
      final gps = await Geolocator.getCurrentPosition();
      position = LatLng(gps.latitude, gps.longitude);
    } catch (_) {
      position = LatLng(AppConfig.defaultLat, AppConfig.defaultLng);
    }
    if (!mounted) return;

    setState(() {
      _pickupLocation = position;
      _pickupAddress = AppLocalizations.of(context).get('my_position');
    });
    _moveMap(position);

    // Remplacer « Ma position » par l'adresse réelle dès qu'elle est connue
    final address = await _geocoding.reverseGeocode(position, lang: _lang);
    if (mounted && _pickupLocation == position) {
      setState(() => _pickupAddress = address);
    }
  }

  Future<void> _openSearch({required bool isPickup}) async {
    final pick = await Navigator.of(context).push<AddressPick>(
      MaterialPageRoute(
        builder: (_) => AddressSearchScreen(isPickup: isPickup),
      ),
    );
    if (pick == null || !mounted) return;

    if (pick.currentPosition) {
      await _setCurrentLocationAsPickup();
      if (_dropoffLocation != null) _getEstimate();
      return;
    }

    final place = pick.place!;
    setState(() {
      if (isPickup) {
        _pickupLocation = place.location;
        _pickupAddress = place.fullAddress;
      } else {
        _dropoffLocation = place.location;
        _dropoffAddress = place.fullAddress;
      }
    });
    _moveMap(place.location);
    if (_pickupLocation != null && _dropoffLocation != null) _getEstimate();
  }

  Future<void> _onMapTap(LatLng point) async {
    setState(() {
      _dropoffLocation = point;
      _resolvingDropoff = true;
      _dropoffAddress = _geocoding.coordsLabel(point);
    });
    _getEstimate();

    final address = await _geocoding.reverseGeocode(point, lang: _lang);
    if (mounted && _dropoffLocation == point) {
      setState(() {
        _dropoffAddress = address;
        _resolvingDropoff = false;
      });
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
                // Départ (ouvre la recherche)
                _addressField(
                  icon: Icons.radio_button_on,
                  iconColor: AppColors.primary,
                  label: l.get('pickup'),
                  value: _pickupAddress,
                  hint: l.get('locating'),
                  onTap: () => _openSearch(isPickup: true),
                ),
                const SizedBox(height: 12),

                // Destination (ouvre la recherche)
                _addressField(
                  icon: Icons.location_on,
                  iconColor: AppColors.error,
                  label: l.get('destination'),
                  value: _dropoffAddress,
                  hint: l.get('search_or_tap_map'),
                  loading: _resolvingDropoff,
                  onTap: () => _openSearch(isPickup: false),
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
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: _pickupLocation ??
                        LatLng(AppConfig.defaultLat, AppConfig.defaultLng),
                    initialZoom: 15,
                    onTap: (_, point) => _onMapTap(point),
                  ),
                  children: [
                    TileLayer(
                        urlTemplate: AppConfig.osmTileUrl,
                        userAgentPackageName: 'com.movebissau.app'),
                    MarkerLayer(
                      markers: [
                        if (_pickupLocation != null)
                          Marker(
                            point: _pickupLocation!,
                            width: 36, height: 36,
                            child: const Icon(Icons.radio_button_on,
                                color: AppColors.primary, size: 24),
                          ),
                        if (_dropoffLocation != null)
                          Marker(
                            point: _dropoffLocation!,
                            width: 36, height: 36,
                            child: const Icon(Icons.location_on,
                                color: AppColors.error, size: 32),
                          ),
                      ],
                    ),
                  ],
                ),

                // Aide : toucher la carte
                if (_dropoffLocation == null)
                  Positioned(
                    top: 12, left: 0, right: 0,
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.95),
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: const [
                            BoxShadow(color: Colors.black12, blurRadius: 6)
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.location_on,
                                size: 14, color: AppColors.error),
                            const SizedBox(width: 6),
                            Text(l.get('tap_map_to_choose'),
                                style: const TextStyle(fontSize: 13)),
                          ],
                        ),
                      ),
                    ),
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

  Widget _addressField({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
    required String hint,
    bool loading = false,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, color: iconColor, size: 18),
          suffixIcon: loading
              ? const Padding(
                  padding: EdgeInsets.all(12),
                  child: SizedBox(
                    width: 16, height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : const Icon(Icons.search, size: 18),
          filled: true,
        ),
        child: Text(
          value.isNotEmpty ? value : hint,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 15,
            color: value.isNotEmpty ? AppColors.textPrimary : AppColors.textHint,
          ),
        ),
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

    if (estimate != null && mounted) {
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
      pickupAddress: _pickupAddress,
      dropoffAddress: _dropoffAddress,
      proposedPrice: price,
      vehicleType: _vehicleType,
    );

    if (request != null && mounted) {
      // Mémoriser la destination pour les prochaines courses
      _recentsStore.add(GeoPlace(
        name: _dropoffAddress.split(',').first.trim(),
        fullAddress: _dropoffAddress,
        location: _dropoffLocation!,
      ));
      context.push('/passenger/offers/${request.id}');
    }
  }

  @override
  void dispose() {
    _priceCtrl.dispose();
    super.dispose();
  }
}
