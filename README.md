# Triumph PDP

Static HTML/CSS/JS prototype of a Triumph product-detail page, built from the Figma design at `Triumph - New Design` (node 95-7957). Desktop-only, 1440px target.

## Live

Published via GitHub Pages: <https://neverdone-team.github.io/Triumph-PDP/>

## Prototypes

| File | URL |
| --- | --- |
| Product Detail Page (with v1 / v2 toggle) | `/` (`index.html`) |
| **New CX prototype** — 6 PDP concept directions | `/v2/pdp-concepts.html` |
| Aura Spotlight landing | `/aura-landing.html` |
| Reviews — desktop | `/reviews-desktop.html` |
| Reviews — mobile | `/reviews-mobile.html` |

## New CX prototype

`/v2/pdp-concepts.html` — six PDP directions interpreting the Customer Experience
workshop debrief (promotion-led → desire-led). Switch with the **V1–V6** pill at the
bottom-left, the **1–6** keys, or `?v=3` in the URL.

| | Direction | Distinctive move |
| --- | --- | --- |
| V1 | Editorial story | Statement band → alternating benefit blocks → oversized wear-test stat → texture macros → numbered scene stories |
| V2 | Annotated detail | Tappable hotspots on the bra, numbered support system, coverage/support/lift meters, 4-layer cutaway, drag-to-compare |
| V3 | In motion | Video hero, "what happens when she moves" clips, in-image shoppable scene |
| V4 | Community-led | "How others are wearing it" leads, review-derived meters, "find someone shaped like you" fit notes |
| V5 | Guided & interactive | 95%-wrong-size band up front, need tabs instead of technical types, skin-tone matcher |
| V6 | Square panels | Master & Dynamic pattern — staircase of half-width square image/text tiles, centred statement bands, centred proof stat |

Every direction covers the four PDP asks from the report: benefit communication through
imagery, an influencer "as worn" section, skin-tone visualisation, and a
"made to be seen" styled-with-an-outfit module. The size link is reframed everywhere as
*"95% of women wear the wrong size — let us find you the right one."*

Imagery in `/v2/Assets/unsplash/` is licensed stock standing in for a real shoot. Three
modules need original photography before they actually work:

- **Drag-to-compare** (V2, V5) — one model, one top, two bras, identical light.
- **Motion tiles** (V3) — real footage; they are stills standing in for loops.
- **Nudes Compared / skin tones** (all) — the comparison only reads if every tone is the
  same framing, pose and light. The stock stand-ins vary in crop and pose, so the row
  currently demonstrates the layout rather than the comparison.

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
