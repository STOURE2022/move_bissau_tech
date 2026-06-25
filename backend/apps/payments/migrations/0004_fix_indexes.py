from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0003_refund_reference'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    "DROP INDEX IF EXISTS refunds_status_idx;",
                    migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "DROP INDEX IF EXISTS refunds_reason_idx;",
                    migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "DROP INDEX IF EXISTS refunds_status_2569d8_idx;",
                    migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "DROP INDEX IF EXISTS refunds_reason_824f43_idx;",
                    migrations.RunSQL.noop,
                ),
            ],
            state_operations=[],
        ),
        migrations.AddIndex(
            model_name='refund',
            index=models.Index(fields=['status'], name='refunds_status_2569d8_idx'),
        ),
        migrations.AddIndex(
            model_name='refund',
            index=models.Index(fields=['reason'], name='refunds_reason_824f43_idx'),
        ),
    ]
