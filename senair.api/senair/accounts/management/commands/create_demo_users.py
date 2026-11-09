"""Comptes de démonstration (un par rôle), alignés sur le mode démo du front. Réservé au mode DEBUG."""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from senair.accounts.management.enrollment import write_enrollment
from senair.accounts.models import User
from senair.accounts.services import enroll_mfa
from senair.network.models import Zone

DEMO_PASSWORD = "Demo2026!"  # identique à MOCK_PASSWORD (packages/core)
DEMO_USERS = (
    ("citoyen@senair.sn", "Awa Ndiaye", User.Role.CITIZEN, ["centre-ville"]),
    ("autorite@senair.sn", "Dr Mamadou Sarr", User.Role.AUTHORITY, []),
    ("admin@senair.sn", "Fatou Diop", User.Role.ADMIN, []),
)


class Command(BaseCommand):
    help = "Crée ou réinitialise les comptes de démonstration citoyen, autorité et administrateur (DEBUG uniquement)."

    def add_arguments(self, parser):
        parser.add_argument("--password", default=DEMO_PASSWORD, help=f"Mot de passe commun (par défaut : {DEMO_PASSWORD}).")
        parser.add_argument(
            "--reset-mfa", action="store_true", help="Régénère les secrets TOTP (les entrées déjà scannées cessent de fonctionner)."
        )
        parser.add_argument("--no-qr", action="store_true", help="N'affiche pas les QR codes.")

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Commande refusée : les comptes de démonstration ne sont créés qu'en mode DEBUG.")
        now = timezone.now()
        for email, full_name, role, zone_ids in DEMO_USERS:
            user = User.objects.filter(email=email).first() or User(email=email)
            user.full_name = full_name
            user.role = role
            user.status = User.Status.ACTIVE
            user.terms_accepted_at = user.terms_accepted_at or now
            user.failed_login_count = 0
            user.locked_until = None
            user.set_password(options["password"])
            user.save()
            if zone_ids and not user.zones.exists():
                user.zones.set(Zone.objects.filter(id__in=zone_ids))
            self.stdout.write(self.style.MIGRATE_HEADING(f"{role:<10} {email}"))
            if user.requires_mfa:
                existing = None if options["reset_mfa"] else user.get_mfa_secret()
                secret = existing or enroll_mfa(user)
                if existing:
                    self.stdout.write("  Secret inchangé : si ce compte est déjà dans Google Authenticator, rien à refaire.")
                else:
                    self.stdout.write("  Nouveau secret : scannez ce QR code avec Google Authenticator.")
                write_enrollment(self.stdout, user, secret, qr=not options["no_qr"])
        self.stdout.write(self.style.SUCCESS(f"Comptes de démonstration prêts (mot de passe : {options['password']})."))
