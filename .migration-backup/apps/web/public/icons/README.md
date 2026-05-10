# 🖼️ PWA Icons — NorthStar

Questa cartella contiene le icone richieste dal `manifest.webmanifest`
generato da `vite-plugin-pwa`.

## File richiesti

| File | Dimensione | Scopo |
|------|-----------|-------|
| `icon-192.png` | 192×192px | Android homescreen, splash screen |
| `icon-512.png` | 512×512px | Android splashscreen full quality |
| `icon-512-maskable.png` | 512×512px | Android adaptive icon (soggetto centrato nel 80% del canvas) |

## Come generarle

1. Parti dal logo NorthStar in SVG o PNG 1024×1024px.
2. Usa [https://maskable.app](https://maskable.app) per creare la versione maskable:
   - Assicurati che il soggetto (logo) stia dentro il cerchio "safe zone" (80% del canvas)
   - Esporta come `icon-512-maskable.png`
3. Usa [https://favicon.io](https://favicon.io) o Squoosh per ridimensionare:
   - 512×512 → `icon-512.png`
   - 192×192 → `icon-192.png`
4. Metti tutti e 3 i file in questa cartella.

## Verifica

Dopo `pnpm build`, apri Chrome DevTools → Application → Manifest.
Devono apparire senza errori “icon not found”.

> Le icone mancanti NON causano errori di build, ma abbassano il
> Lighthouse PWA score. Aggiungile prima del deploy in produzione.
