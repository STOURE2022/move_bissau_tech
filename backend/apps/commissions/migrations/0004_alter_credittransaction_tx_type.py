from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('commissions', '0003_withdrawal_reference'),
    ]

    operations = [
        migrations.AlterField(
            model_name='credittransaction',
            name='tx_type',
            field=models.CharField(
                choices=[
                    ('topup', 'Rechargement'),
                    ('commission', 'Commission course'),
                    ('refund', 'Remboursement'),
                    ('adjustment', 'Ajustement admin'),
                    ('cancellation_fee', "Frais d'annulation"),
                    ('withdrawal_hold', 'Retrait en attente'),
                    ('withdrawal_release', 'Retrait annulé (recrédité)'),
                    ('withdrawal_completed', 'Retrait effectué'),
                ],
                max_length=20,
            ),
        ),
    ]
