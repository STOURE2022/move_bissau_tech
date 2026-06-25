/// Point d'entrée de l'application MoveBissau.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'config/routes.dart';
import 'core/api/api_client.dart';
import 'core/providers/auth_provider.dart';
import 'core/providers/driver_provider.dart';
import 'core/providers/ride_provider.dart';
import 'core/theme/app_theme.dart';
import 'i18n/app_localizations.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final apiClient = ApiClient();

  runApp(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: apiClient),
        ChangeNotifierProvider(create: (_) => AuthProvider(apiClient)),
        ChangeNotifierProvider(create: (_) => RideProvider(apiClient)),
        ChangeNotifierProvider(create: (_) => DriverProvider(apiClient)),
      ],
      child: const MoveBissauApp(),
    ),
  );
}

class MoveBissauApp extends StatelessWidget {
  const MoveBissauApp({super.key});

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final router = createRouter(authProvider);

    // Déterminer la locale à partir du profil utilisateur
    final userLang = authProvider.user?.preferredLang ?? 'fr';
    final locale = Locale(userLang);

    return MaterialApp.router(
      title: 'MoveBissau',
      theme: AppTheme.lightTheme,
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
      ],
    );
  }
}
