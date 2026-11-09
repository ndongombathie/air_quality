/**
 * Mini-analyseur Markdown SÛR (sous-ensemble) pour les articles.
 * Supporté : titres `#`/`##`/`###`, paragraphes, listes `-`/`*`, **gras**, liens `[texte](url)` (texte seul).
 * Tout le reste, HTML compris, est conservé comme TEXTE brut, jamais interprété.
 */
export interface InlineSpan {
  text: string;
  bold: boolean;
}

export type MarkdownBlock =
  | { type: 'heading'; level: 2 | 3; spans: InlineSpan[] }
  | { type: 'paragraph'; spans: InlineSpan[] }
  | { type: 'list'; items: InlineSpan[][] };

const HEADING = /^(#{1,6})\s+(.*)$/;
const LIST_ITEM = /^\s*[-*]\s+(.*)$/;
const LINK = /\[([^\]]*)\]\([^)]*\)/g;

export function parseInline(source: string): InlineSpan[] {
  const text = source.replace(LINK, '$1');
  const spans: InlineSpan[] = [];
  const parts = text.split('**');
  // Nombre impair de `**` : le dernier n'est pas fermé → on le restitue tel quel.
  const unclosed = parts.length % 2 === 0;
  parts.forEach((part, index) => {
    const isLast = index === parts.length - 1;
    let bold = index % 2 === 1;
    let value = part;
    if (unclosed && isLast && bold) {
      bold = false;
      value = `**${part}`;
    }
    if (!value) return;
    const previous = spans[spans.length - 1];
    if (previous && previous.bold === bold) previous.text += value;
    else spans.push({ text: value, bold });
  });
  return spans;
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: InlineSpan[][] | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', spans: parseInline(paragraph.join(' ')) });
    paragraph = [];
  };
  const flushList = () => {
    if (list?.length) blocks.push({ type: 'list', items: list });
    list = null;
  };

  for (const rawLine of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const hashes = heading[1]?.length ?? 2;
      blocks.push({ type: 'heading', level: hashes <= 2 ? 2 : 3, spans: parseInline(heading[2] ?? '') });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      flushParagraph();
      list ??= [];
      list.push(parseInline(item[1] ?? ''));
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return blocks;
}
