from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0001_initial'),
        ('rides', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Refund',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('amount', models.PositiveIntegerField(verbose_name='Montant remboursé (XOF)')),
                ('reason', models.CharField(choices=[('driver_noshow', 'Chauffeur absent'), ('driver_cancelled', 'Annulé par le chauffeur'), ('dispute', 'Litige passager'), ('admin_decision', 'Décision admin')], max_length=20)),
                ('status', models.CharField(choices=[('pending', 'En attente'), ('approved', 'Approuvé'), ('processed', 'Traité'), ('rejected', 'Rejeté')], default='pending', max_length=20)),
                ('refund_method', models.CharField(choices=[('mobile_money', 'Mobile Money'), ('cash', 'Espèces (manuel)')], default='cash', max_length=20)),
                ('admin_note', models.TextField(blank=True)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('provider_tx_id', models.CharField(blank=True, max_length=100)),
                ('payment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='refunds', to='payments.payment')),
                ('ride', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='refunds', to='rides.ride')),
                ('passenger', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='refunds', to=settings.AUTH_USER_MODEL)),
                ('processed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='refunds_processed', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Remboursement',
                'db_table': 'refunds',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['status'], name='refunds_status_idx'),
                    models.Index(fields=['reason'], name='refunds_reason_idx'),
                ],
            },
        ),
    ]
