/// Écran des offres reçues — le passager voit les propositions des chauffeurs.
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/providers/ride_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../i18n/app_localizations.dart';
import '../../models/ride.dart';

class OffersScreen extends StatelessWidget {
  final String requestId;
  const OffersScreen({super.key, required this.requestId});

  @override
  Widget build(BuildContext context) {
    final ride = context.watch<RideProvider>();
    final offers = ride.offers;
    final l = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l.offersReceived),
        actions: [
          TextButton(
            onPressed: () async {
              await ride.cancelRequest(requestId);
              if (context.mounted) context.pop();
            },
            child: Text(l.cancel, style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: Column(
        children: [
          // En-tête : info demande
          Container(
            color: AppColors.primary.withOpacity(0.05),
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const Icon(Icons.search, color: AppColors.primary),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        ride.currentRequest != null
                            ? '${ride.currentRequest!.proposedPrice} F CFA'
                            : '',
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        '${ride.currentRequest?.notifiedCount ?? 0} chauffeurs notifiés',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Liste des offres
          Expanded(
            child: offers.isEmpty
                ? _buildWaiting(l)
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: offers.length,
                    itemBuilder: (context, index) => _buildOfferCard(context, offers[index], l),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildWaiting(AppLocalizations l) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(
            width: 60, height: 60,
            child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 3),
          ),
          const SizedBox(height: 24),
          Text(l.waitingOffers, style: const TextStyle(fontSize: 18)),
          const SizedBox(height: 8),
          Text(
            'Les chauffeurs proches sont en train de répondre...',
            style: TextStyle(color: AppColors.textSecondary),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildOfferCard(BuildContext context, RideOffer offer, AppLocalizations l) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              children: [
                // Photo du chauffeur (icône véhicule en secours)
                CircleAvatar(
                  backgroundColor: AppColors.primary.withOpacity(0.1),
                  radius: 24,
                  backgroundImage: offer.driverAvatar.isNotEmpty
                      ? CachedNetworkImageProvider(offer.driverAvatar)
                      : null,
                  child: offer.driverAvatar.isEmpty
                      ? Icon(
                          offer.driverVehicleType == 'moto'
                              ? Icons.motorcycle
                              : Icons.directions_car,
                          color: AppColors.primary,
                        )
                      : null,
                ),
                const SizedBox(width: 12),

                // Info chauffeur
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(offer.driverName,
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          if (offer.driverRating != null) ...[
                            Icon(Icons.star, size: 16, color: AppColors.secondary),
                            Text(' ${offer.driverRating!.toStringAsFixed(1)}',
                              style: const TextStyle(fontWeight: FontWeight.w600)),
                            const SizedBox(width: 12),
                          ],
                          Icon(Icons.navigation, size: 14, color: AppColors.textSecondary),
                          Text(' ${offer.distanceKm.toStringAsFixed(1)} ${l.km}',
                            style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                          const SizedBox(width: 8),
                          Icon(Icons.access_time, size: 14, color: AppColors.textSecondary),
                          Text(' ${offer.etaMinutes} ${l.min}',
                            style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                        ],
                      ),
                      if (offer.driverTotalRides > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            '${offer.driverTotalRides} ${l.get("rides").toLowerCase()}',
                            style: TextStyle(
                                color: AppColors.textSecondary, fontSize: 12),
                          ),
                        ),
                      if (offer.driverVehicleInfo.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Row(
                            children: [
                              if (offer.driverVehiclePhoto.isNotEmpty) ...[
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(6),
                                  child: CachedNetworkImage(
                                    imageUrl: offer.driverVehiclePhoto,
                                    width: 40,
                                    height: 30,
                                    fit: BoxFit.cover,
                                    errorWidget: (_, __, ___) =>
                                        const SizedBox.shrink(),
                                  ),
                                ),
                                const SizedBox(width: 6),
                              ],
                              Expanded(
                                child: Text(offer.driverVehicleInfo,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                      color: AppColors.textSecondary,
                                      fontSize: 12)),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),

                // Prix
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('${offer.offeredPrice}',
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.primary)),
                    const Text('F CFA', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    if (offer.isCounterOffer)
                      Container(
                        margin: const EdgeInsets.only(top: 4),
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.warning.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(l.counterOffer,
                          style: const TextStyle(fontSize: 10, color: AppColors.warning)),
                      ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Bouton accepter
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => _acceptOffer(context, offer),
                child: Text(l.accept),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _acceptOffer(BuildContext context, RideOffer offer) async {
    final rideProvider = context.read<RideProvider>();
    final ride = await rideProvider.acceptOffer(requestId, offer.id);

    if (ride != null && context.mounted) {
      context.go('/passenger/tracking/${ride.id}');
    }
  }
}
