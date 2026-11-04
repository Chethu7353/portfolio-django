from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("contact", "0002_remove_contact_created_at")]

    operations = [
        migrations.AddField(
            model_name="contact",
            name="subject",
            field=models.CharField(blank=True, max_length=160),
        ),
    ]
