# Triumph PDP

Static HTML/CSS/JS prototype of a Triumph product-detail page, built from the Figma design at `Triumph - New Design` (node 95-7957). Desktop-only, 1440px target.

## Live

Published via GitHub Pages: <https://neverdone-team.github.io/Triumph-PDP/>

## Prototypes

| File | URL |
| --- | --- |
| Product Detail Page (with v1 / v2 toggle) | `/` (`index.html`) |
| Aura Spotlight landing | `/aura-landing.html` |
| Reviews — desktop | `/reviews-desktop.html` |
| Reviews — mobile | `/reviews-mobile.html` |

## PDP variants

The PDP includes both drafts behind a fixed toggle at the bottom-left of the screen (`Variante 1` / `Variante 2`):

- **v1** — inline size grids on the buybox.
- **v2** — no inline size grids. The CTA reads **Größe wählen**; clicking opens a right-side sheet (480px) with a 4×8 grid of all combined sizes and a 40% dark backdrop.

## Scroll behavior

The right-hand buybox uses plain `position: sticky` (the same rule Calvin Klein / Li-vy use). The gallery scrolls past while the buybox stays pinned; both reach the bottom together once the gallery is fully scrolled.

## Stack

- Plain HTML / CSS / JS, no build step
- Alliance No.1 Light + Regular (local `@font-face`)
- Static product imagery in `/Assets`
