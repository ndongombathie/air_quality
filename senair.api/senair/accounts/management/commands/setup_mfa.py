"""Configure (ou régénère) le secret TOTP d'un compte et affiche l'URI otpauth:// à scanner."""

from django.core.management.base import BaseCommand, CommandError

from senair.accounts.management.enrollment import write_enrollment
from senair.accounts.models import User
from senair.accounts.services import enroll_mfa


class Command(BaseCommand):
    help = "Génère un secret TOTP chiffré pour un compte et affiche l'URI otpauth:// (à scanner dans une application d'authentification)."

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("--no-qr", action="store_true", help="N'affiche pas le QR code.")

    def handle(self, *args, **options):
        user = User.objects.filter(email__iexact=options["email"].strip()).first()
        if user is None:
            raise CommandError(f"Aucun compte pour {options['email']}.")
        secret = enroll_mfa(user)
        write_enrollment(self.stdout, user, secret, qr=not options["no_qr"])
        self.stdout.write(self.style.SUCCESS("Double authentification configurée. L'ancien secret éventuel ne fonctionne plus."))
