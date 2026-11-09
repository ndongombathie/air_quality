"""Affichage d'un enrôlement TOTP dans le terminal : QR code à scanner, clé à saisir, URI otpauth://."""

import io

import segno

from senair.accounts.models import User
from senair.accounts.services import provisioning_uri


def write_enrollment(stdout, user: User, secret: str, *, qr: bool = True) -> None:
    uri = provisioning_uri(user, secret)
    if qr:
        buffer = io.StringIO()
        segno.make(uri, error="m").terminal(out=buffer, compact=True)
        stdout.write(buffer.getvalue(), ending="")
    key = " ".join(secret[i : i + 4] for i in range(0, len(secret), 4))
    stdout.write(f"  Clé à saisir : {key}  (compte {user.email}, basé sur l'heure)")
    stdout.write(f"  {uri}")
