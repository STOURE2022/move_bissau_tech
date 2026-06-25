/// Écran profil utilisateur.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../i18n/app_localizations.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final l = AppLocalizations.of(context);

    if (user == null) return const SizedBox();

    return Scaffold(
      appBar: AppBar(title: Text(l.profile)),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          // Avatar
          Center(
            child: CircleAvatar(
              radius: 50,
              backgroundColor: AppColors.primary.withOpacity(0.1),
              child: Text(
                user.firstName.isNotEmpty ? user.firstName[0].toUpperCase() : '?',
                style: const TextStyle(fontSize: 40, color: AppColors.primary),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text('${user.firstName} ${user.lastName}',
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          ),
          Center(
            child: Text(user.phone, style: TextStyle(color: AppColors.textSecondary)),
          ),
          Center(
            child: Chip(
              label: Text(user.isDriver ? l.driver : l.passenger),
              backgroundColor: AppColors.primary.withOpacity(0.1),
              labelStyle: const TextStyle(color: AppColors.primary),
            ),
          ),
          const SizedBox(height: 32),

          // Langue
          Card(
            child: ListTile(
              leading: const Icon(Icons.language),
              title: Text(l.get('language')),
              subtitle: Text(_langName(user.preferredLang)),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => _showLanguagePicker(context, auth),
            ),
          ),
          const SizedBox(height: 8),

          // Historique
          Card(
            child: ListTile(
              leading: const Icon(Icons.history),
              title: Text(l.history),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/history'),
            ),
          ),
          const SizedBox(height: 32),

          // Déconnexion
          OutlinedButton.icon(
            onPressed: () {
              auth.logout();
              context.go('/auth/login');
            },
            icon: const Icon(Icons.logout, color: AppColors.error),
            label: Text(l.get('logout'), style: const TextStyle(color: AppColors.error)),
            style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.error)),
          ),
        ],
      ),
    );
  }

  String _langName(String code) {
    return switch (code) {
      'fr' => 'Français',
      'pt' => 'Português',
      'gcr' => 'Kriol',
      _ => code,
    };
  }

  void _showLanguagePicker(BuildContext context, AuthProvider auth) {
    showModalBottomSheet(
      context: context,
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            title: const Text('Français'),
            onTap: () { Navigator.pop(context); auth.changeLanguage('fr'); },
          ),
          ListTile(
            title: const Text('Português'),
            onTap: () { Navigator.pop(context); auth.changeLanguage('pt'); },
          ),
          ListTile(
            title: const Text('Kriol'),
            onTap: () { Navigator.pop(context); auth.changeLanguage('gcr'); },
          ),
        ],
      ),
    );
  }
}
