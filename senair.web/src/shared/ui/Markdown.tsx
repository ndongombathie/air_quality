import ReactMarkdown, { type Components } from 'react-markdown';
import { safeExternalUrl, safeMediaUrl } from '../lib/labels';

/**
 * Rendu Markdown sûr : HTML brut ignoré (`skipHtml`, pas de rehype-raw),
 * liens externes en `noopener noreferrer`, images HTTPS uniquement.
 */
const components: Components = {
  a: ({ href, children }) => {
    if (href?.startsWith('/') || href?.startsWith('#')) return <a href={href}>{children}</a>;
    const safe = safeExternalUrl(href);
    if (!safe) return <span>{children}</span>;
    return (
      <a href={safe} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  img: ({ src, alt }) => {
    const safe = typeof src === 'string' ? safeMediaUrl(src) : null;
    return safe ? <img src={safe} alt={alt ?? ''} loading="lazy" referrerPolicy="no-referrer" /> : null;
  },
};

export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose">
      <ReactMarkdown skipHtml components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
