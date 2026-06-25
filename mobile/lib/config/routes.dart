/// Configuration du routeur de l'application.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/providers/auth_provider.dart';
import '../screens/auth/splash_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/otp_screen.dart';
import '../screens/auth/complete_profile_screen.dart';
import '../screens/passenger/passenger_home_screen.dart';
import '../screens/passenger/ride_request_screen.dart';
import '../screens/passenger/offers_screen.dart';
import '../screens/passenger/ride_tracking_screen.dart';
import '../screens/passenger/payment_screen.dart';
import '../screens/driver/driver_home_screen.dart';
import '../screens/driver/ride_request_detail_screen.dart';
import '../screens/driver/driver_ride_screen.dart';
import '../screens/driver/credit_screen.dart';
import '../screens/common/profile_screen.dart';
import '../screens/common/history_screen.dart';
import '../screens/common/rating_screen.dart';

GoRouter createRouter(AuthProvider authProvider) {
  return GoRouter(
    refreshListenable: authProvider,
    initialLocation: '/',
    redirect: (context, state) {
      final isLoggedIn = authProvider.isAuthenticated;
      final isProfileComplete = authProvider.isProfileComplete;
      final isOnAuthPage = state.matchedLocation.startsWith('/auth');
      final isSplash = state.matchedLocation == '/';

      if (isSplash) return null;

      if (!isLoggedIn && !isOnAuthPage) return '/auth/login';
      if (isLoggedIn && !isProfileComplete && state.matchedLocation != '/auth/complete-profile') {
        return '/auth/complete-profile';
      }
      if (isLoggedIn && isProfileComplete && isOnAuthPage) {
        return authProvider.isDriver ? '/driver' : '/passenger';
      }

      return null;
    },
    routes: [
      // Splash
      GoRoute(path: '/', builder: (_, __) => const SplashScreen()),

      // Auth
      GoRoute(path: '/auth/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/auth/otp', builder: (_, state) => OtpScreen(phone: state.extra as String)),
      GoRoute(path: '/auth/complete-profile', builder: (_, __) => const CompleteProfileScreen()),

      // Passager
      GoRoute(path: '/passenger', builder: (_, __) => const PassengerHomeScreen()),
      GoRoute(path: '/passenger/request', builder: (_, __) => const RideRequestScreen()),
      GoRoute(
        path: '/passenger/offers/:requestId',
        builder: (_, state) => OffersScreen(requestId: state.pathParameters['requestId']!),
      ),
      GoRoute(
        path: '/passenger/tracking/:rideId',
        builder: (_, state) => RideTrackingScreen(rideId: state.pathParameters['rideId']!),
      ),
      GoRoute(
        path: '/passenger/payment/:rideId',
        builder: (_, state) => PaymentScreen(rideId: state.pathParameters['rideId']!),
      ),

      // Chauffeur
      GoRoute(path: '/driver', builder: (_, __) => const DriverHomeScreen()),
      GoRoute(
        path: '/driver/request/:requestId',
        builder: (_, state) => RideRequestDetailScreen(requestId: state.pathParameters['requestId']!),
      ),
      GoRoute(
        path: '/driver/ride/:rideId',
        builder: (_, state) => DriverRideScreen(rideId: state.pathParameters['rideId']!),
      ),
      GoRoute(path: '/driver/credit', builder: (_, __) => const CreditScreen()),

      // Commun
      GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
      GoRoute(path: '/history', builder: (_, __) => const HistoryScreen()),
      GoRoute(
        path: '/rating/:rideId',
        builder: (_, state) => RatingScreen(rideId: state.pathParameters['rideId']!),
      ),
    ],
  );
}
