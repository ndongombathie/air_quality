import { describe, expect, it } from 'vitest';
import { parseMapMessage, toInjectedScript } from './protocol';

const known = new Set(['89441']);

describe('protocole carte', () => {
  it('accepte uniquement les stations connues', () => {
    expect(parseMapMessage('{"type":"station:select","id":"89441"}', known)).toEqual({ type: 'station:select', id: '89441' });
    expect(parseMapMessage('{"type":"station:select","id":"inconnue"}', known)).toBeNull();
    expect(parseMapMessage('{"type":"station:select","id":42}', known)).toBeNull();
  });

  it('rejette les messages malformés ou inconnus', () => {
    expect(parseMapMessage('pas du json', known)).toBeNull();
    expect(parseMapMessage('{"type":"eval","code":"x"}', known)).toBeNull();
    expect(parseMapMessage('null', known)).toBeNull();
    expect(parseMapMessage('{"type":"ready"}', known)).toEqual({ type: 'ready' });
  });

  it("n'injecte qu'un littéral de chaîne JSON", () => {
    const script = toInjectedScript({
      type: 'stations',
      stations: [{ id: '1', name: '</script><img onerror=x>', latitude: 1, longitude: 2, label: 'N/D', title: "'\"", color: '#000000', textColor: '#FFFFFF' }],
    });
    const literal = script.slice(script.indexOf('(') + 1, script.lastIndexOf(')'));
    const decoded = JSON.parse(JSON.parse(literal) as string) as { stations: { name: string }[] };
    expect(decoded.stations[0]?.name).toBe('</script><img onerror=x>');
  });
});
