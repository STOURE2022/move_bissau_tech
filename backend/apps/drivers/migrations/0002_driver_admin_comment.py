from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('drivers', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='driver',
            name='admin_comment',
            field=models.TextField(blank=True, verbose_name='Commentaire admin'),
        ),
    ]
