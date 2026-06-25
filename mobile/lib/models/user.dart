/// Modèle utilisateur.
class User {
  final String id;
  final String phone;
  final bool phoneVerified;
  final String role;
  final String firstName;
  final String lastName;
  final String preferredLang;
  final String? avatarUrl;
  final int cancellationDebt;
  final bool hasUnpaidCancellation;

  User({
    required this.id,
    required this.phone,
    this.phoneVerified = false,
    this.role = 'passenger',
    this.firstName = '',
    this.lastName = '',
    this.preferredLang = 'fr',
    this.avatarUrl,
    this.cancellationDebt = 0,
    this.hasUnpaidCancellation = false,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      phone: json['phone'],
      phoneVerified: json['phone_verified'] ?? false,
      role: json['role'] ?? 'passenger',
      firstName: json['first_name'] ?? '',
      lastName: json['last_name'] ?? '',
      preferredLang: json['preferred_lang'] ?? 'fr',
      avatarUrl: json['avatar_url'],
      cancellationDebt: json['cancellation_debt'] ?? 0,
      hasUnpaidCancellation: json['has_unpaid_cancellation'] ?? false,
    );
  }

  bool get isDriver => role == 'driver';
  bool get isPassenger => role == 'passenger';
  bool get isProfileComplete => firstName.isNotEmpty && lastName.isNotEmpty;
  String get displayName => '$firstName ${lastName.isNotEmpty ? lastName[0] : ''}.';
}
