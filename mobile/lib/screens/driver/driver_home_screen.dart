/// Écran principal chauffeur — en ligne/hors ligne, demandes entrantes,
/// offres en attente et reprise de course active.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/providers/driver_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../i18n/app_localizations.dart';

class DriverHomeScreen extends StatefulWidget {
  const DriverHomeScreen({super.key});

  @override
  State<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends State<DriverHomeScreen> {
  @override
  void initState() {
    super.initState();
    final driver = context.read<DriverProvider>();
    driver.loadProfile();
    driver.loadCredit();
    driver.checkActiveRide();
  }

  /// Réagit aux changements d'état après chaque frame : notification à
  /// afficher, ou course active vers laquelle naviguer.
  void _handleStateChanges(DriverProvider driver, AppLocalizations l) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;

      // Notification (offre acceptée / rejetée / demande annulée)
      final notice = driver.notice;
      if (notice != null) {
        driver.clearNotice();
        final isPositive = notice == 'offer_accepted_title';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(l.get(notice)),
            backgroundColor: isPositive ? AppColors.success : AppColors.warning,
          ),
        );
      }

      final ride = driver.activeRide;

      // Course annulée pendant qu'on est sur l'accueil : nettoyer l'état
      if (ride != null && ride.isCancelled) {
        driver.clearActiveRide();
        return;
      }

      // Offre qui vient d'être acceptée : ouvrir l'écran de course (une fois)
      final rideToOpen = driver.rideToOpen;
      if (rideToOpen != null) {
        driver.consumeRideToOpen();
        context.go('/driver/ride/$rideToOpen');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final driver = context.watch<DriverProvider>();
    final auth = context.watch<AuthProvider>();
    final l = AppLocalizations.of(context);

    _handleStateChanges(driver, l);

    return Scaffold(
      appBar: AppBar(
        title: const Text('MoveBissau'),
        actions: [
          // Crédit
          GestureDetector(
            onTap: () => context.push('/driver/credit'),
            child: Container(
              margin: const EdgeInsets.only(right: 16),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                children: [
                  const Icon(Icons.account_balance_wallet, size: 18),
                  const SizedBox(width: 4),
                  Text('${driver.credit?.balance ?? 0} F',
                    style: const TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ),
        ],
      ),
      drawer: _buildDrawer(context, auth, l),
      body: Column(
        children: [
          // Bouton en ligne / hors ligne
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            color: driver.isOnline ? AppColors.online.withOpacity(0.1) : AppColors.background,
            child: Column(
              children: [
                // Toggle
                GestureDetector(
                  onTap: () async {
                    if (driver.isOnline) {
                      await driver.goOffline();
                    } else {
                      await driver.goOnline();
                    }
                  },
                  child: Container(
                    width: 120, height: 120,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: driver.isOnline ? AppColors.online : AppColors.offline,
                      boxShadow: [
                        BoxShadow(
                          color: (driver.isOnline ? AppColors.online : AppColors.offline).withOpacity(0.3),
                          blurRadius: 20,
                          spreadRadius: 5,
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          driver.isOnline ? Icons.power_settings_new : Icons.power_off,
                          color: Colors.white, size: 36,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          driver.isOnline ? l.get('online') : l.get('offline'),
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  driver.isOnline
                      ? l.get('receiving_requests')
                      : l.get('tap_to_go_online'),
                  style: TextStyle(color: AppColors.textSecondary),
                ),

                if (driver.error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(driver.error!, style: const TextStyle(color: AppColors.error)),
                  ),
              ],
            ),
          ),

          // Bannière course active (reprise manuelle si besoin)
          if (driver.activeRide != null && !driver.activeRide!.isCancelled)
            _activeRideBanner(driver, l),

          // Stats rapides
          if (driver.profile != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  _statCard(Icons.star, '${driver.profile!.averageRating}', l.get('rating')),
                  const SizedBox(width: 8),
                  _statCard(Icons.directions_car, '${driver.profile!.totalRides}', l.get('rides')),
                  const SizedBox(width: 8),
                  _statCard(Icons.account_balance_wallet, '${driver.credit?.balance ?? 0} F', l.creditBalance),
                ],
              ),
            ),

          // Alerte crédit bas
          if (driver.credit != null && !driver.credit!.hasSufficientCredit)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warning.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.warning),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning, color: AppColors.warning),
                  const SizedBox(width: 8),
                  Expanded(child: Text(l.get('low_credit'))),
                  TextButton(
                    onPressed: () => context.push('/driver/credit'),
                    child: Text(l.recharge),
                  ),
                ],
              ),
            ),

          // Offres en attente de réponse
          if (driver.pendingOffers.isNotEmpty) ...[
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  '${l.get("my_pending_offers")} (${driver.pendingOffers.length})',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ),
            ),
            ...driver.pendingOffers.map((o) => _buildPendingOfferCard(o, driver, l)),
          ],

          // Demandes entrantes
          const SizedBox(height: 8),
          if (driver.incomingRequests.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('${l.get("new_request")} (${driver.incomingRequests.length})',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ),

          Expanded(
            child: driver.incomingRequests.isEmpty
                ? Center(
                    child: Text(
                      driver.isOnline && driver.pendingOffers.isEmpty
                          ? l.get('waiting_requests')
                          : '',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: driver.incomingRequests.length,
                    itemBuilder: (_, i) => _buildRequestCard(driver.incomingRequests[i], l),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _activeRideBanner(DriverProvider driver, AppLocalizations l) {
    final ride = driver.activeRide!;
    return GestureDetector(
      onTap: () => context.go('/driver/ride/${ride.id}'),
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            const Icon(Icons.navigation, color: Colors.white),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l.get('ride_in_progress'),
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  Text('${ride.agreedPrice} F CFA — ${ride.passengerName}',
                    style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 13)),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(l.get('resume_ride'),
                style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600, fontSize: 12)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPendingOfferCard(
      Map<String, dynamic> offer, DriverProvider driver, AppLocalizations l) {
    return Card(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const SizedBox(
              width: 20, height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${offer['offered_price']} F CFA',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  Text(l.get('waiting_passenger'),
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                ],
              ),
            ),
            TextButton(
              onPressed: () => driver.withdrawOffer(offer['id'] as String),
              style: TextButton.styleFrom(foregroundColor: AppColors.error),
              child: Text(l.get('withdraw_offer')),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statCard(IconData icon, String value, String label) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4)],
        ),
        child: Column(
          children: [
            Icon(icon, color: AppColors.primary, size: 20),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            Text(label, style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
          ],
        ),
      ),
    );
  }

  Widget _buildRequestCard(Map<String, dynamic> request, AppLocalizations l) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Prix proposé
            Row(
              children: [
                const Icon(Icons.local_offer, color: AppColors.primary),
                const SizedBox(width: 8),
                Text('${request['proposed_price']} F CFA',
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                const Spacer(),
                Text(request['vehicle_type'] == 'moto' ? '🏍️' : '🚗', style: const TextStyle(fontSize: 24)),
              ],
            ),
            const SizedBox(height: 12),

            // Adresses
            Row(
              children: [
                const Icon(Icons.radio_button_on, size: 14, color: AppColors.primary),
                const SizedBox(width: 8),
                Expanded(child: Text(request['pickup_address'] ?? l.get('pickup_point'), overflow: TextOverflow.ellipsis)),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.location_on, size: 14, color: AppColors.error),
                const SizedBox(width: 8),
                Expanded(child: Text(request['dropoff_address'] ?? l.get('dropoff_point'), overflow: TextOverflow.ellipsis)),
              ],
            ),
            const SizedBox(height: 12),

            // Distance estimée
            Text('${(request['estimated_distance_m'] / 1000).toStringAsFixed(1)} km',
              style: TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 12),

            // Bouton voir détails / faire offre
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => context.push('/driver/request/${request['id']}'),
                child: Text(l.get('make_offer')),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDrawer(BuildContext context, AuthProvider auth, AppLocalizations l) {
    return Drawer(
      child: ListView(
        children: [
          DrawerHeader(
            decoration: const BoxDecoration(color: AppColors.primary),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                const CircleAvatar(
                  backgroundColor: Colors.white,
                  radius: 30,
                  child: Icon(Icons.person, size: 36, color: AppColors.primary),
                ),
                const SizedBox(height: 12),
                Text(auth.user?.displayName ?? '',
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                Text(auth.user?.phone ?? '',
                  style: TextStyle(color: Colors.white.withOpacity(0.8))),
              ],
            ),
          ),
          ListTile(
            leading: const Icon(Icons.account_balance_wallet),
            title: Text(l.creditBalance),
            onTap: () { Navigator.pop(context); context.push('/driver/credit'); },
          ),
          ListTile(
            leading: const Icon(Icons.history),
            title: Text(l.history),
            onTap: () { Navigator.pop(context); context.push('/history'); },
          ),
          ListTile(
            leading: const Icon(Icons.person),
            title: Text(l.profile),
            onTap: () { Navigator.pop(context); context.push('/profile'); },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout, color: AppColors.error),
            title: Text(l.get('logout'), style: const TextStyle(color: AppColors.error)),
            onTap: () {
              Navigator.pop(context);
              auth.logout();
              context.go('/auth/login');
            },
          ),
        ],
      ),
    );
  }
}
