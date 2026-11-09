/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DesignTokens } from '@senair/core';

const css = readFileSync(fileURLToPath(new URL('../styles/tokens.css', import.meta.url)), 'utf8');

function colorsOf(record: Readonly<Record<string, string | readonly string[]>>): string[] {
  return Object.values(record).flatMap((value) => (typeof value === 'string' ? [value] : [...value]));
}

describe('tokens.css', () => {
  it.each(colorsOf(DesignTokens.PALETTE))('reprend la couleur de palette %s', (color) => {
    expect(css).toContain(`: ${color};`);
  });

  it.each(colorsOf(DesignTokens.COLORS))('reprend la couleur de rôle %s', (color) => {
    expect(css).toContain(color);
  });

  it('reprend les rayons, la police et les ombres', () => {
    for (const [name, value] of Object.entries(DesignTokens.RADIUS)) expect(css).toContain(`--radius-${name}: ${value}px;`);
    expect(css).toContain(DesignTokens.FONT.family);
    expect(css).toContain(DesignTokens.SHADOW.card);
    expect(css).toContain(DesignTokens.SHADOW.raised);
  });
});

describe('tailles de texte', () => {
  it.each(Object.entries(DesignTokens.FONT.sizes))('reprend --text-%s', (name, value) => {
    expect(css).toContain(`--text-${name}: ${value}px;`);
  });
});
