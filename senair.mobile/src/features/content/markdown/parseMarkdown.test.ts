import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from './parseMarkdown';

describe('parseMarkdown', () => {
  it('reconnaît titres, paragraphes et listes', () => {
    const blocks = parseMarkdown('## Titre\n\nUne phrase\nsur deux lignes.\n\n- un\n- **deux**');
    expect(blocks).toEqual([
      { type: 'heading', level: 2, spans: [{ text: 'Titre', bold: false }] },
      { type: 'paragraph', spans: [{ text: 'Une phrase sur deux lignes.', bold: false }] },
      { type: 'list', items: [[{ text: 'un', bold: false }], [{ text: 'deux', bold: true }]] },
    ]);
  });

  it('traite le HTML comme du texte brut', () => {
    const blocks = parseMarkdown('<script>alert(1)</script>');
    expect(blocks).toEqual([{ type: 'paragraph', spans: [{ text: '<script>alert(1)</script>', bold: false }] }]);
  });

  it('gère le gras et le gras non fermé', () => {
    expect(parseInline('a **b** c')).toEqual([
      { text: 'a ', bold: false },
      { text: 'b', bold: true },
      { text: ' c', bold: false },
    ]);
    expect(parseInline('a **b')).toEqual([{ text: 'a **b', bold: false }]);
  });

  it('ne garde que le texte des liens', () => {
    expect(parseInline('voir [OMS](https://who.int)')).toEqual([{ text: 'voir OMS', bold: false }]);
  });

  it('mappe ### et plus en niveau 3', () => {
    expect(parseMarkdown('### Sous-titre')[0]).toMatchObject({ type: 'heading', level: 3 });
  });
});
