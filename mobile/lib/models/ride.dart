/// Modèles pour les courses, demandes et offres.
import 'package:latlong2/latlong.dart';

class PriceEstimate {
  final int distanceM;
  final double distanceKm;
  final int suggestedPrice;
  final int minPrice;
  final int maxPrice;

  PriceEstimate({
    required this.distanceM,
    required this.distanceKm,
    required this.suggestedPrice,
    required this.minPrice,
    required this.maxPrice,
  });

  factory PriceEstimate.fromJson(Map<String, dynamic> json) {
    return PriceEstimate(
      distanceM: json['distance_m'],
      distanceKm: (json['distance_km'] as num).toDouble(),
      suggestedPrice: json['suggested_price'],
      minPrice: json['min_price'],
      maxPrice: json['max_price'],
    );
  }
}

class RideRequest {
  final String id;
  final String pickupAddress;
  final String dropoffAddress;
  final int estimatedDistanceM;
  final int suggestedPrice;
  final int proposedPrice;
  final String vehicleType;
  final String status;
  final int notifiedCount;
  final DateTime expiresAt;
  final List<RideOffer> offers;

  RideRequest({
    required this.id,
    this.pickupAddress = '',
    this.dropoffAddress = '',
    required this.estimatedDistanceM,
    required this.suggestedPrice,
    required this.proposedPrice,
    required this.vehicleType,
    required this.status,
    this.notifiedCount = 0,
    required this.expiresAt,
    this.offers = const [],
  });

  factory RideRequest.fromJson(Map<String, dynamic> json) {
    return RideRequest(
      id: json['id'],
      pickupAddress: json['pickup_address'] ?? '',
      dropoffAddress: json['dropoff_address'] ?? '',
      estimatedDistanceM: json['estimated_distance_m'],
      suggestedPrice: json['suggested_price'],
      proposedPrice: json['proposed_price'],
      vehicleType: json['vehicle_type'],
      status: json['status'],
      notifiedCount: json['notified_count'] ?? 0,
      expiresAt: DateTime.parse(json['expires_at']),
      offers: (json['offers'] as List?)
              ?.map((o) => RideOffer.fromJson(o))
              .toList() ??
          [],
    );
  }
}

class RideOffer {
  final String id;
  final int offeredPrice;
  final bool isCounterOffer;
  final int? driverDistanceM;
  final int? estimatedArrivalS;
  final double? driverRating;
  final String driverName;
  final String driverVehicleType;
  final String driverVehicleInfo;
  final String status;
  final DateTime expiresAt;

  RideOffer({
    required this.id,
    required this.offeredPrice,
    this.isCounterOffer = false,
    this.driverDistanceM,
    this.estimatedArrivalS,
    this.driverRating,
    this.driverName = '',
    this.driverVehicleType = '',
    this.driverVehicleInfo = '',
    required this.status,
    required this.expiresAt,
  });

  factory RideOffer.fromJson(Map<String, dynamic> json) {
    return RideOffer(
      id: json['id'],
      offeredPrice: json['offered_price'],
      isCounterOffer: json['is_counter_offer'] ?? false,
      driverDistanceM: json['driver_distance_m'],
      estimatedArrivalS: json['estimated_arrival_s'],
      driverRating: json['driver_rating'] != null
          ? (json['driver_rating'] as num).toDouble()
          : null,
      driverName: json['driver_name'] ?? '',
      driverVehicleType: json['driver_vehicle_type'] ?? '',
      driverVehicleInfo: json['driver_vehicle_info'] ?? '',
      status: json['status'],
      expiresAt: DateTime.parse(json['expires_at']),
    );
  }

  /// Temps d'arrivée estimé en minutes
  int get etaMinutes => (estimatedArrivalS ?? 0) ~/ 60;

  /// Distance en km
  double get distanceKm => (driverDistanceM ?? 0) / 1000;
}

class Ride {
  final String id;
  final String pickupAddress;
  final String dropoffAddress;
  final int agreedPrice;
  final int? actualDistanceM;
  final int? commissionAmount;
  final String vehicleType;
  final String status;
  final String driverName;
  final String? driverPhoneMasked;
  final double? driverRating;
  final Map<String, dynamic>? driverVehicle;
  final String? shareToken;
  final DateTime createdAt;
  final DateTime? completedAt;
  final DateTime? cancelledAt;
  final String? cancelledBy;
  final int cancellationFee;

  Ride({
    required this.id,
    this.pickupAddress = '',
    this.dropoffAddress = '',
    required this.agreedPrice,
    this.actualDistanceM,
    this.commissionAmount,
    required this.vehicleType,
    required this.status,
    this.driverName = '',
    this.driverPhoneMasked,
    this.driverRating,
    this.driverVehicle,
    this.shareToken,
    required this.createdAt,
    this.completedAt,
    this.cancelledAt,
    this.cancelledBy,
    this.cancellationFee = 0,
  });

  factory Ride.fromJson(Map<String, dynamic> json) {
    return Ride(
      id: json['id'],
      pickupAddress: json['pickup_address'] ?? '',
      dropoffAddress: json['dropoff_address'] ?? '',
      agreedPrice: json['agreed_price'],
      actualDistanceM: json['actual_distance_m'],
      commissionAmount: json['commission_amount'],
      vehicleType: json['vehicle_type'],
      status: json['status'],
      driverName: json['driver_name'] ?? '',
      driverPhoneMasked: json['driver_phone_masked'],
      driverRating: json['driver_rating'] != null
          ? (json['driver_rating'] as num).toDouble()
          : null,
      driverVehicle: json['driver_vehicle'],
      shareToken: json['share_token'],
      createdAt: DateTime.parse(json['created_at']),
      completedAt: json['completed_at'] != null
          ? DateTime.parse(json['completed_at'])
          : null,
      cancelledAt: json['cancelled_at'] != null
          ? DateTime.parse(json['cancelled_at'])
          : null,
      cancelledBy: json['cancelled_by'],
      cancellationFee: json['cancellation_fee'] ?? 0,
    );
  }

  bool get isActive => [
        'driver_assigned',
        'driver_en_route',
        'driver_arrived',
        'passenger_onboard'
      ].contains(status);

  bool get isCompleted => status == 'completed';
  bool get isPaid => status == 'paid';
  bool get isCancelled => status == 'cancelled';
}
