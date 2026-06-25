import random
import string
from django.db import migrations, models


def generate_references(apps, schema_editor):
    Withdrawal = apps.get_model('commissions', 'Withdrawal')
    for w in Withdrawal.objects.filter(reference=''):
        w.reference = 'WD-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        w.save(update_fields=['reference'])


class Migration(migrations.Migration):

    dependencies = [
        ('commissions', '0002_withdrawal'),
    ]

    operations = [
        migrations.AddField(
            model_name='withdrawal',
            name='reference',
            field=models.CharField(default='', help_text='Généré automatiquement : WD-XXXXXX', max_length=20, verbose_name='N° de référence'),
            preserve_default=False,
        ),
        migrations.RunPython(generate_references, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='withdrawal',
            name='reference',
            field=models.CharField(help_text='Généré automatiquement : WD-XXXXXX', max_length=20, unique=True, verbose_name='N° de référence'),
        ),
    ]
