#!/usr/bin/env node
/**
 * Génère toutes les déclinaisons du logo SEN AIR à partir d'une source unique :
 *   senair.mobile/assets/logo/senair-mark.svg  (symbole vectorisé depuis logoPNG.png, voir trace-mark.py)
 *
 * Sorties :
 *   packages/core/src/design/logoMark.ts   données du symbole pour les composants React (web et mobile)
 *   senair.web/public/                     favicon.svg, icônes PWA, apple-touch-icon
 *   senair.mobile/assets/                  icône, icône adaptative Android, écran de démarrage, favicon
 *
 * Usage : npm run brand   (ImageMagick 7 requis : commande `magick`)
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const at = (...parts) => join(root, ...parts);

/* Couleurs du logo (identiques à packages/core/src/design/tokens.ts). */
const LOGO_INK = '#212121';
const WHITE = '#FFFFFF';
const SKY50 = '#F3FBFF';
const FONT_DIR = at('node_modules/@expo-google-fonts/manrope');
const FONT_BOLD = join(FONT_DIR, '800ExtraBold/Manrope_800ExtraBold.ttf');
const FONT_LIGHT = join(FONT_DIR, '300Light/Manrope_300Light.ttf');

const source = readFileSync(at('senair.mobile/assets/logo/senair-mark.svg'), 'utf8');
const viewBox = /viewBox="([^"]+)"/.exec(source)?.[1];
const paths = [...source.matchAll(/<path fill="([^"]+)"[^>]*\sd="([^"]+)"/g)].map(([, fill, d]) => ({ fill, d }));
if (!viewBox || paths.length === 0) throw new Error('senair-mark.svg illisible');

/* 1. Données du symbole pour le code. */
writeFileSync(
  at('packages/core/src/design/logoMark.ts'),
  `/**
 * Symbole du logo SEN AIR (triangle et « S »), vectorisé depuis senair.mobile/assets/logo/logoPNG.png.
 * Fichier généré par scripts/brand/generate.mjs : ne pas modifier à la main.
 */
export const LOGO_MARK = {
  viewBox: '${viewBox}',
  paths: [
${paths.map((p) => `    { fill: '${p.fill}', d: '${p.d}' },`).join('\n')}
  ],
} as const;
`,
);

/* 2. Favicon vectoriel du web (viewBox carré pour un rendu centré). */
const [vx, vy, vw, vh] = viewBox.split(/\s+/).map(Number);
const side = Math.max(vw, vh) * 1.08;
const squareViewBox = `${(vx + vw / 2 - side / 2).toFixed(2)} ${(vy + vh / 2 - side / 2).toFixed(2)} ${side.toFixed(2)} ${side.toFixed(2)}`;
const squareSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${squareViewBox}">\n${paths
  .map((p) => `  <path fill="${p.fill}" fill-rule="evenodd" d="${p.d}"/>`)
  .join('\n')}\n</svg>\n`;
writeFileSync(at('senair.web/public/favicon.svg'), squareSvg);

/* 3. Images matricielles. */
const tmp = mkdtempSync(join(tmpdir(), 'senair-brand-'));
const magick = (...args) => execFileSync('magick', args, { stdio: 'inherit' });
const markPng = join(tmp, 'mark.png');
const markBlack = join(tmp, 'mark-black.png');
writeFileSync(join(tmp, 'mark.svg'), squareSvg);
magick('-background', 'none', '-density', '1600', join(tmp, 'mark.svg'), '-resize', '2048x2048', markPng);
magick(markPng, '-fill', '#000000', '-colorize', '100', markBlack);

/** Carré `size` px, fond `bg` (ou transparent), symbole occupant `ratio` du côté. */
function square(out, size, ratio, bg = 'none', mark = markPng) {
  const inner = Math.round(size * ratio);
  magick('-size', `${size}x${size}`, `xc:${bg}`, '(', mark, '-resize', `${inner}x${inner}`, ')', '-gravity', 'center', '-composite', out);
}

/** Logo complet : symbole au-dessus du mot « SEN AIR » (SEN en gras, AIR en léger incliné, comme le logo d'origine). */
function lockup(out, width) {
  // -trim laisse un décalage de canevas : +repage le remet à zéro avant chaque assemblage.
  const markSize = Math.round(width * 0.62);
  const pt = Math.round(width * 0.17);
  const sen = join(tmp, 'sen.png');
  const air = join(tmp, 'air.png');
  const word = join(tmp, 'word.png');
  magick('-background', 'none', '-fill', LOGO_INK, '-font', FONT_BOLD, '-pointsize', String(pt), 'label:SEN', '-trim', '+repage', sen);
  magick('-background', 'none', '-fill', LOGO_INK, '-font', FONT_LIGHT, '-pointsize', String(pt), 'label:AIR', '-shear', '12x0', '-trim', '+repage', air);
  magick(sen, '(', '-size', `${Math.round(pt * 0.28)}x1`, 'xc:none', ')', air, '-background', 'none', '-gravity', 'south', '+append', '+repage', word);
  magick(
    '(', markPng, '-resize', `${markSize}x${markSize}`, ')',
    '(', '-size', `1x${Math.round(width * 0.07)}`, 'xc:none', ')',
    word, '-background', 'none', '-gravity', 'center', '-append', '+repage',
    '-bordercolor', 'none', '-border', String(Math.round(width * 0.08)),
    '-resize', `${width}x${width}`, '-gravity', 'center', '-extent', `${width}x${width}`, '+repage',
    out,
  );
}

// Web (PWA)
square(at('senair.web/public/pwa-192x192.png'), 192, 0.74, WHITE);
square(at('senair.web/public/pwa-512x512.png'), 512, 0.74, WHITE);
square(at('senair.web/public/maskable-512x512.png'), 512, 0.56, WHITE);
square(at('senair.web/public/apple-touch-icon.png'), 180, 0.72, WHITE);
lockup(at('senair.web/public/senair-logo.png'), 512);

// Mobile (Expo)
square(at('senair.mobile/assets/icon.png'), 1024, 0.7, WHITE);
square(at('senair.mobile/assets/android-icon-foreground.png'), 1024, 0.5);
square(at('senair.mobile/assets/android-icon-background.png'), 1024, 0, SKY50);
square(at('senair.mobile/assets/android-icon-monochrome.png'), 1024, 0.5, 'none', markBlack);
square(at('senair.mobile/assets/favicon.png'), 48, 0.9);
lockup(at('senair.mobile/assets/splash-icon.png'), 1024);
lockup(at('senair.mobile/assets/logo/senair-logo.png'), 512);

rmSync(tmp, { recursive: true, force: true });
console.log('Logo SEN AIR généré : core, web, mobile.');
