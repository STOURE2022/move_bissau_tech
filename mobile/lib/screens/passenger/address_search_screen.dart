/// Écran de recherche d'adresse — autocomplétion Nominatim, position
/// actuelle, destinations récentes et lieux connus de Bissau.
import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/services/geocoding_service.dart';
import '../../core/theme/app_theme.dart';
import '../../i18n/app_localizations.dart';

/// Résultat renvoyé par l'écran de recherche.
class AddressPick {
  final GeoPlace? place;
  final bool currentPosition;

  const AddressPick.place(GeoPlace this.place) : currentPosition = false;
  const AddressPick.current()
      : place = null,
        currentPosition = true;
}

class AddressSearchScreen extends StatefulWidget {
  /// true = choix du point de départ, false = destination
  final bool isPickup;

  const AddressSearchScreen({super.key, required this.isPickup});

  @override
  State<AddressSearchScreen> createState() => _AddressSearchScreenState();
}

class _AddressSearchScreenState extends State<AddressSearchScreen> {
  final _searchCtrl = TextEditingController();
  final _geocoding = GeocodingService();
  final _recentsStore = RecentPlacesStore();

  List<GeoPlace> _results = [];
  List<GeoPlace> _recents = [];
  bool _searching = false;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _loadRecents();
  }

  Future<void> _loadRecents() async {
    final recents = await _recentsStore.load();
    if (mounted) setState(() => _recents = recents);
  }

  void _onQueryChanged(String query) {
    _debounce?.cancel();
    if (query.trim().length < 3) {
      setState(() {
        _results = [];
        _searching = false;
      });
      return;
    }

    _debounce = Timer(const Duration(milliseconds: 400), () async {
      setState(() => _searching = true);
      final lang = AppLocalizations.of(context).languageCode;
      final results = await _geocoding.search(query, lang: lang);
      if (!mounted) return;
      setState(() {
        _results = results;
        _searching = false;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final query = _searchCtrl.text.trim();

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        title: TextField(
          controller: _searchCtrl,
          autofocus: true,
          onChanged: _onQueryChanged,
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: l.get('search_address'),
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            filled: false,
            suffixIcon: query.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: () {
                      _searchCtrl.clear();
                      _onQueryChanged('');
                    },
                  )
                : null,
          ),
        ),
      ),
      body: ListView(
        children: [
          if (_searching)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(child: CircularProgressIndicator()),
            ),

          // Résultats de recherche
          if (!_searching)
            ..._results.map((place) => _placeTile(
                  icon: Icons.location_on,
                  iconColor: widget.isPickup ? AppColors.primary : AppColors.error,
                  title: place.name,
                  subtitle: place.fullAddress,
                  onTap: () => Navigator.pop(context, AddressPick.place(place)),
                )),

          // Aucun résultat
          if (!_searching && query.length >= 3 && _results.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Column(
                children: [
                  Icon(Icons.location_off, size: 40, color: AppColors.textHint),
                  const SizedBox(height: 12),
                  Text(l.get('no_results'),
                      style: TextStyle(color: AppColors.textSecondary)),
                  Text(l.get('try_other_terms'),
                      style: TextStyle(
                          fontSize: 12, color: AppColors.textHint)),
                ],
              ),
            ),

          // Contenu par défaut (avant la saisie)
          if (query.length < 3) ...[
            // Ma position actuelle (point de départ)
            if (widget.isPickup)
              _placeTile(
                icon: Icons.my_location,
                iconColor: AppColors.info,
                title: l.get('my_position'),
                onTap: () =>
                    Navigator.pop(context, const AddressPick.current()),
              ),

            // Destinations récentes
            if (!widget.isPickup && _recents.isNotEmpty) ...[
              _sectionHeader(l.get('recent_destinations')),
              ..._recents.map((place) => _placeTile(
                    icon: Icons.history,
                    iconColor: AppColors.textSecondary,
                    title: place.name,
                    subtitle: place.fullAddress,
                    onTap: () =>
                        Navigator.pop(context, AddressPick.place(place)),
                  )),
            ],

            // Lieux connus de Bissau (pré-remplissent la recherche)
            _sectionHeader(l.get('popular_places')),
            ...GeocodingService.bissauSuggestions.map((name) => _placeTile(
                  icon: Icons.place,
                  iconColor: AppColors.textSecondary,
                  title: name,
                  onTap: () {
                    _searchCtrl.text = name;
                    _searchCtrl.selection = TextSelection.collapsed(
                        offset: _searchCtrl.text.length);
                    _onQueryChanged(name);
                    setState(() {});
                  },
                )),
          ],
        ],
      ),
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
      child: Text(
        title.toUpperCase(),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
          color: AppColors.textHint,
        ),
      ),
    );
  }

  Widget _placeTile({
    required IconData icon,
    required Color iconColor,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: iconColor.withOpacity(0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 18, color: iconColor),
      ),
      title: Text(title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 15)),
      subtitle: subtitle != null && subtitle != title
          ? Text(subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary))
          : null,
      onTap: onTap,
    );
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }
}
