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

## Connected shop flow (`/v2/`)

The PLP, PDP, bag and checkout are one prototype: a single bag, shared by every page.

```
/v2/plp.html  →  /v2/pdp.html  →  mini cart  →  /v2/cart.html  →  /v2/checkout.html  →  order confirmed
```

Pick an underbust and a cup size, press **Add to Cart**, and a **bottom sheet** comes up with the
line you just added, how far the order is from free shipping, and the two ways out
(View bag · n / Checkout). Opened from the basket icon instead, it lists the whole bag. The header bag count follows you across all four pages,
quantities can be changed anywhere, **Place order** shows a confirmation and empties the bag.
Everything is in English and prices in €.

The bag page's **Complete your order** is a row of compact product cards — small packshot, name,
series, colour · size, and the price with a **+** to its right.

The checkout runs in **two modes**, switched from the prototype panel bottom-right:

- **One page** — every section stacked, one Place order at the foot.
- **3 steps** — the same sections, three at a time. **1 Sign in** is the live site's login gate
  rebuilt as one narrow column: *Customer login* (email, password, forgotten-password, Sign in),
  then **or** → *New here?* with **Create an account** and **Continue as guest** side by side, then
  **or** → Google / Facebook. The step carries no express row and no summary rail — neither belongs
  to a decision that has not been made yet. Choosing **Create an account** opens the registration
  form in place rather than leaving checkout. **2 Delivery** is address and delivery
  method — plus the email field when the customer came through as a guest.
  **3 Payment**, after which a **review page** — no tab of its own, the indicator stays on
  Payment — lists the contact, address, delivery method and payment read straight off the
  live form, each with an Edit link back to its step. Nothing is charged until Place order
  there. Completed steps in the indicator are clickable to go back; on mobile the sticky bar
  carries the step's call to action (and stands down on step 1, where the gate has its own).

  Two things the live registration asks for are deliberately gone: the second *confirm your email*
  field, and a date of birth pre-filled to 01 January 2008. The delivery address is not in the
  registration form either — it is step 2, and asking twice is what makes the live flow long.

Nothing is duplicated between the modes: every section carries `data-step` and the mode only
decides how many are on screen. The chosen mode persists in `localStorage`.

| File | What it owns |
| --- | --- |
| `v2/lib/shop.js` | The bag itself — lines, quantities, membership, voucher, totals, the free-shipping threshold, the header badge, and the mini-cart sheet |
| `v2/lib/shop.css` | Mini-cart styling, self-contained so it can be dropped onto any page |
| `v2/pdp.html` | Product, size validation, add-to-cart, "complete your set" tiles |
| `v2/cart.html` | Bag page — renders the shared lines, cross-sell, voucher, MyTriumph |
| `v2/checkout.html` | Checkout in both modes — renders the same lines in the summary rail and places the order |

State lives in `localStorage` under `triumph.proto.cart.v1`. It works opened straight from
disk in Chrome; if a browser blocks storage on `file://`, serve the folder instead
(`python3 -m http.server` from the repo root, then `/v2/pdp.html`) — the code falls back to
`sessionStorage` and then to memory, so the flow degrades to a single tab rather than breaking.

Both `cart.html` and `checkout.html` keep their prototype state switcher (bottom-right, with a
**Hide** button). **Sample bag** fills the bag with the two Amourette demo lines so the design
can be reviewed without walking the flow; **Empty** clears it.

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
