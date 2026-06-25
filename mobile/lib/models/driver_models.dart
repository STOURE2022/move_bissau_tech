/// Modèles pour le chauffeur et le crédit commission.

class DriverProfile {
  final String id;
  final String userId;
  final String userName;
  final String vehicleType;
  final bool isVerified;
  final bool isOnline;
  final String verificationStatus;
  final double averageRating;
  final int totalRides;
  final int creditBalance;

  DriverProfile({
    required this.id,
    required this.userId,
    this.userName = '',
    required this.vehicleType,
    this.isVerified = false,
    this.isOnline = false,
    this.verificationStatus = 'pending',
    this.averageRating = 0,
    this.totalRides = 0,
    this.creditBalance = 0,
  });

  factory DriverProfile.fromJson(Map<String, dynamic> json) {
    return DriverProfile(
      id: json['id'],
      userId: json['user_id'],
      userName: json['user_name'] ?? '',
      vehicleType: json['vehicle_type'],
      isVerified: json['is_verified'] ?? false,
      isOnline: json['is_online'] ?? false,
      verificationStatus: json['verification_status'] ?? 'pending',
      averageRating: (json['average_rating'] as num?)?.toDouble() ?? 0,
      totalRides: json['total_rides'] ?? 0,
      creditBalance: json['credit_balance'] ?? 0,
    );
  }
}

class CommissionCredit {
  final int balance;
  final int totalTopups;
  final int totalCommissions;
  final bool hasSufficientCredit;

  CommissionCredit({
    this.balance = 0,
    this.totalTopups = 0,
    this.totalCommissions = 0,
    this.hasSufficientCredit = false,
  });

  factory CommissionCredit.fromJson(Map<String, dynamic> json) {
    return CommissionCredit(
      balance: json['balance'] ?? 0,
      totalTopups: json['total_topups'] ?? 0,
      totalCommissions: json['total_commissions'] ?? 0,
      hasSufficientCredit: json['has_sufficient_credit'] ?? false,
    );
  }
}

class CreditTransaction {
  final String id;
  final String txType;
  final int amount;
  final int balanceBefore;
  final int balanceAfter;
  final String description;
  final DateTime createdAt;

  CreditTransaction({
    required this.id,
    required this.txType,
    required this.amount,
    required this.balanceBefore,
    required this.balanceAfter,
    this.description = '',
    required this.createdAt,
  });

  factory CreditTransaction.fromJson(Map<String, dynamic> json) {
    return CreditTransaction(
      id: json['id'],
      txType: json['tx_type'],
      amount: json['amount'],
      balanceBefore: json['balance_before'],
      balanceAfter: json['balance_after'],
      description: json['description'] ?? '',
      createdAt: DateTime.parse(json['created_at']),
    );
  }

  bool get isCredit => amount > 0;
}
