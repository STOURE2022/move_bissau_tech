/// Écran de gestion du crédit commission — solde, rechargement, historique.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api_client.dart';
import '../../core/providers/driver_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../i18n/app_localizations.dart';
import '../../models/driver_models.dart';

class CreditScreen extends StatefulWidget {
  const CreditScreen({super.key});

  @override
  State<CreditScreen> createState() => _CreditScreenState();
}

class _CreditScreenState extends State<CreditScreen> {
  List<CreditTransaction> _transactions = [];
  bool _loadingTx = true;

  @override
  void initState() {
    super.initState();
    context.read<DriverProvider>().loadCredit();
    _loadTransactions();
  }

  Future<void> _loadTransactions() async {
    try {
      final api = context.read<ApiClient>();
      final response = await api.get('/commissions/transactions');
      setState(() {
        _transactions = (response.data as List)
            .map((t) => CreditTransaction.fromJson(t))
            .toList();
        _loadingTx = false;
      });
    } catch (_) {
      setState(() => _loadingTx = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final driver = context.watch<DriverProvider>();
    final credit = driver.credit;
    final l = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(l.creditBalance)),
      body: Column(
        children: [
          // Solde
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(32),
            color: AppColors.primary,
            child: Column(
              children: [
                const Text('Solde actuel', style: TextStyle(color: Colors.white70)),
                const SizedBox(height: 8),
                Text(
                  '${credit?.balance ?? 0} F CFA',
                  style: const TextStyle(
                    fontSize: 40, fontWeight: FontWeight.bold, color: Colors.white,
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => _showTopupDialog(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.primary,
                  ),
                  child: Text(l.recharge),
                ),
              ],
            ),
          ),

          // Stats
          if (credit != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  _creditStat('Rechargé', '${credit.totalTopups} F', AppColors.success),
                  const SizedBox(width: 8),
                  _creditStat('Commissions', '${credit.totalCommissions} F', AppColors.warning),
                ],
              ),
            ),

          // Historique
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text('Historique', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ),

          Expanded(
            child: _loadingTx
                ? const Center(child: CircularProgressIndicator())
                : _transactions.isEmpty
                    ? const Center(child: Text('Aucune transaction'))
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _transactions.length,
                        itemBuilder: (_, i) => _buildTxItem(_transactions[i]),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _creditStat(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(label, style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _buildTxItem(CreditTransaction tx) {
    final isCredit = tx.isCredit;
    final icon = switch (tx.txType) {
      'topup' => Icons.add_circle,
      'commission' => Icons.remove_circle,
      'cancellation_fee' => Icons.cancel,
      'refund' => Icons.replay,
      _ => Icons.swap_horiz,
    };
    final color = isCredit ? AppColors.success : AppColors.error;

    return ListTile(
      leading: Icon(icon, color: color),
      title: Text(tx.description, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(
        '${tx.createdAt.day}/${tx.createdAt.month}/${tx.createdAt.year} ${tx.createdAt.hour}:${tx.createdAt.minute.toString().padLeft(2, '0')}',
        style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
      ),
      trailing: Text(
        '${isCredit ? '+' : ''}${tx.amount} F',
        style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 16),
      ),
    );
  }

  void _showTopupDialog(BuildContext context) {
    final amountCtrl = TextEditingController(text: '5000');
    final phoneCtrl = TextEditingController();
    String method = 'orange_money';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => StatefulBuilder(
        builder: (context, setModalState) => Padding(
          padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(context).viewInsets.bottom + 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Recharger le crédit', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 20),

              // Montant
              TextField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                decoration: const InputDecoration(
                  labelText: 'Montant (F CFA)',
                  suffixText: 'F CFA',
                ),
              ),
              const SizedBox(height: 12),

              // Raccourcis montant
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [1000, 2000, 5000, 10000].map((amount) {
                  return GestureDetector(
                    onTap: () {
                      amountCtrl.text = amount.toString();
                      setModalState(() {});
                    },
                    child: Chip(label: Text('$amount F')),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),

              // Méthode
              Row(
                children: [
                  Expanded(
                    child: RadioListTile<String>(
                      title: const Text('Orange Money', style: TextStyle(fontSize: 14)),
                      value: 'orange_money',
                      groupValue: method,
                      onChanged: (v) => setModalState(() => method = v!),
                      dense: true,
                    ),
                  ),
                  Expanded(
                    child: RadioListTile<String>(
                      title: const Text('Moov Money', style: TextStyle(fontSize: 14)),
                      value: 'moov_money',
                      groupValue: method,
                      onChanged: (v) => setModalState(() => method = v!),
                      dense: true,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Téléphone
              TextField(
                controller: phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Numéro de téléphone',
                  hintText: '+245 XX XXX XXXX',
                  prefixIcon: Icon(Icons.phone),
                ),
              ),
              const SizedBox(height: 20),

              // Bouton
              ElevatedButton(
                onPressed: () async {
                  final amount = int.tryParse(amountCtrl.text);
                  if (amount == null || amount < 500 || phoneCtrl.text.isEmpty) return;

                  Navigator.pop(context);
                  final success = await context.read<DriverProvider>().topupCredit(
                    amount, method, phoneCtrl.text.trim(),
                  );

                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content: Text(success ? 'Rechargement réussi !' : 'Échec du rechargement'),
                      backgroundColor: success ? AppColors.success : AppColors.error,
                    ));
                    _loadTransactions();
                  }
                },
                child: Text('Recharger ${amountCtrl.text} F CFA'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
