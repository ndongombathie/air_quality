"""Fichiers téléchargeables (rapports, exports) : CSV compatible Excel et PDF minimal sans dépendance."""

import csv
import io
import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

Cell = str | int | float | None


def to_csv(header: Sequence[str], rows: Iterable[Sequence[Cell]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(header)
    for row in rows:
        writer.writerow(["" if cell is None else cell for cell in row])
    # BOM UTF-8 : Excel ouvre correctement les accents.
    return ("﻿" + buffer.getvalue()).encode("utf-8")


@dataclass(frozen=True)
class PdfLine:
    text: str
    size: float = 11
    bold: bool = False
    gap_before: float = 0


_SUBSCRIPTS = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")


def _latin1(text: str) -> str:
    """Polices PDF standard (WinAnsi) : on ramène le texte à Latin-1."""
    text = text.translate(_SUBSCRIPTS)
    text = re.sub("[‘’]", "'", text)
    text = re.sub("[“”]", '"', text)
    text = re.sub("[–—]", "-", text).replace("…", "...").replace(" ", " ").replace(" ", " ")
    return text.encode("latin-1", "replace").decode("latin-1")


def _escape(text: str) -> str:
    return _latin1(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def to_pdf(lines: Sequence[PdfLine]) -> bytes:
    """PDF A4 valide (Helvetica), pagination automatique. Même rendu que le mode démonstration du front."""
    page_height, margin = 842, 56
    pages: list[str] = []
    ops: list[str] = []
    y = page_height - margin
    for line in lines:
        y -= line.gap_before + line.size * 1.45
        if y < margin:
            pages.append("\n".join(ops))
            ops = []
            y = page_height - margin - line.size * 1.45
        font = "F2" if line.bold else "F1"
        ops.append(f"BT /{font} {line.size:g} Tf {margin} {y:.1f} Td ({_escape(line.text)}) Tj ET")
    pages.append("\n".join(ops))

    objects: list[str] = []

    def add(body: str) -> int:
        objects.append(body)
        return len(objects)  # numéro (base 1) de l'objet ajouté

    catalog = add("")
    pages_obj = add("")
    regular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
    kids = []
    for content in pages:
        stream = add(f"<< /Length {len(content.encode('latin-1'))} >>\nstream\n{content}\nendstream")
        kids.append(
            add(
                f"<< /Type /Page /Parent {pages_obj} 0 R /MediaBox [0 0 595 {page_height}] "
                f"/Resources << /Font << /F1 {regular} 0 R /F2 {bold} 0 R >> >> /Contents {stream} 0 R >>"
            )
        )
    objects[catalog - 1] = f"<< /Type /Catalog /Pages {pages_obj} 0 R >>"
    objects[pages_obj - 1] = f"<< /Type /Pages /Kids [{' '.join(f'{k} 0 R' for k in kids)}] /Count {len(kids)} >>"

    out = "%PDF-1.4\n"
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out.encode("latin-1")))
        out += f"{number} 0 obj\n{body}\nendobj\n"
    xref = len(out.encode("latin-1"))
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n" + "".join(f"{o:010d} 00000 n \n" for o in offsets)
    out += f"trailer\n<< /Size {len(objects) + 1} /Root {catalog} 0 R >>\nstartxref\n{xref}\n%%EOF\n"
    return out.encode("latin-1")


CONTENT_TYPES = {"csv": "text/csv; charset=utf-8", "json": "application/json; charset=utf-8", "pdf": "application/pdf"}
