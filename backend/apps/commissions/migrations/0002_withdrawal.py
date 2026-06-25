from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('commissions', '0001_initial'),
        ('drivers', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='credittransaction',
            name='tx_type',
            field=models.CharField(choices=[('topup', 'Rechargement'), ('commission', 'Commission course'), ('refund', 'Remboursement'), ('adjustment', 'Ajustement admin'), ('cancellation_fee', "Frais d'annulation"), ('withdrawal_hold', 'Retrait en attente'), ('withdrawal_release', 'Retrait annulé (recrédité)'), ('withdrawal_completed', 'Retrait effectué')], max_length=20, verbose_name='Type'),
        ),
        migrations.CreateModel(
            name='Withdrawal',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('amount', models.PositiveIntegerField(verbose_name='Montant (XOF)')),
                ('status', models.CharField(choices=[('pending', 'En attente'), ('approved', 'Approuvé'), ('processing', 'En cours'), ('completed', 'Effectué'), ('rejected', 'Rejeté')], default='pending', max_length=20)),
                ('withdrawal_method', models.CharField(choices=[('orange_money', 'Orange Money'), ('moov_money', 'Moov Money')], max_length=20)),
                ('phone', models.CharField(max_length=20, verbose_name='Numéro de destination')),
                ('provider_tx_id', models.CharField(blank=True, max_length=100)),
                ('admin_note', models.TextField(blank=True)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('driver', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='withdrawals', to='drivers.driver')),
                ('processed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='withdrawals_processed', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Retrait',
                'db_table': 'withdrawals',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['status'], name='withdrawals_status_idx'),
                    models.Index(fields=['driver'], name='withdrawals_driver_idx'),
                ],
            },
        ),
    ]
