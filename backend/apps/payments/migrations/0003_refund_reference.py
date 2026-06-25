import random
import string
from django.db import migrations, models


def generate_references(apps, schema_editor):
    Refund = apps.get_model('payments', 'Refund')
    for refund in Refund.objects.filter(reference=''):
        refund.reference = 'RF-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        refund.save(update_fields=['reference'])


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0002_refund'),
    ]

    operations = [
        migrations.AddField(
            model_name='refund',
            name='reference',
            field=models.CharField(default='', help_text='Généré automatiquement : RF-XXXXXX', max_length=20, verbose_name='N° de référence'),
            preserve_default=False,
        ),
        migrations.RunPython(generate_references, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='refund',
            name='reference',
            field=models.CharField(help_text='Généré automatiquement : RF-XXXXXX', max_length=20, unique=True, verbose_name='N° de référence'),
        ),
    ]
