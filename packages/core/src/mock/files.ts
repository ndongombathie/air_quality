/**
 * Fabrique de vrais fichiers pour le mode démonstration (rapports et exports téléchargeables).
 * En production, ces fichiers sont produits par le backend et servis par URL signée.
 */

export type FileFormat = 'csv' | 'json' | 'pdf';

const MIME: Record<FileFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  json: 'application/json;charset=utf-8',
  pdf: 'application/pdf',
};

type Cell = string | number | null | undefined;

export function toCsv(header: readonly string[], rows: readonly (readonly Cell[])[]): string {
  const escape = (value: Cell) => {
    if (value == null) return '';
    const text = String(value);
    return /[",;\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  // BOM UTF-8 : Excel ouvre correctement les accents.
  return '﻿' + [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n') + '\r\n';
}

/** Ramène un texte à Latin-1 (encodage WinAnsi des polices PDF standard). */
function latin1(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080))
    .replace(/ | /g, ' ')
    .replace(/[^\x00-\xFF]/g, '?');
}

const pdfText = (text: string) => latin1(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export interface PdfLine {
  text: string;
  size?: number;
  bold?: boolean;
  gapBefore?: number;
}

/** PDF minimal mais valide (A4, Helvetica, pagination automatique). */
export function toPdf(lines: readonly PdfLine[]): Uint8Array {
  const pageHeight = 842;
  const margin = 56;
  const pages: string[] = [];
  let ops: string[] = [];
  let y = pageHeight - margin;
  for (const line of lines) {
    const size = line.size ?? 11;
    y -= (line.gapBefore ?? 0) + size * 1.45;
    if (y < margin) {
      pages.push(ops.join('\n'));
      ops = [];
      y = pageHeight - margin - size * 1.45;
    }
    ops.push(`BT /${line.bold ? 'F2' : 'F1'} ${size} Tf ${margin} ${y.toFixed(1)} Td (${pdfText(line.text)}) Tj ET`);
  }
  pages.push(ops.join('\n'));

  const objects: string[] = [];
  // push renvoie la nouvelle longueur, soit le numéro (base 1) de l'objet ajouté.
  const add = (body: string) => objects.push(body);
  const catalog = add('');
  const pagesObj = add('');
  const fontRegular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids: number[] = [];
  for (const content of pages) {
    const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    kids.push(
      add(
        `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 ${pageHeight}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${stream} 0 R >>`,
      ),
    );
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}

/** URL téléchargeable : `blob:` dans un navigateur, `data:` en repli (environnements sans createObjectURL). */
export function toDownloadUrl(content: string | Uint8Array, format: FileFormat): string {
  const mime = MIME[format];
  const canBlob = typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  if (canBlob) return URL.createObjectURL(new Blob([content as BlobPart], { type: mime }));
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${mime};base64,${btoa(binary)}`;
}
