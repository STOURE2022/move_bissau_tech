from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('commissions', '0004_alter_credittransaction_tx_type'),
    ]

    operations = [
        # Supprimer les anciens index (ignore si n'existent pas)
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    "DROP INDEX IF EXISTS withdrawals_status_idx;",
                    migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "DROP INDEX IF EXISTS withdrawals_driver_idx;",
                    migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "DROP INDEX IF EXISTS withdrawals_status_ddef8f_idx;",
                    migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "DROP INDEX IF EXISTS withdrawals_driver__f5d7f8_idx;",
                    migrations.RunSQL.noop,
                ),
            ],
            state_operations=[],
        ),
        # Recréer avec les bons noms
        migrations.AddIndex(
            model_name='withdrawal',
            index=models.Index(fields=['status'], name='withdrawals_status_ddef8f_idx'),
        ),
        migrations.AddIndex(
            model_name='withdrawal',
            index=models.Index(fields=['driver'], name='withdrawals_driver__f5d7f8_idx'),
        ),
    ]
