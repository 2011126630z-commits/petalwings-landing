# Petalwings — flower-viewing landing page (v2, rebuilt from the reference)

A single-page landing site that mirrors the reference mockup structure, with the
subject changed to **flower viewing**:
rounded hero image card + left step rail + floating "Know More" card →
Follow / partner wordmark strip → Popular Destination carousel (image, title,
location, blue star-rating pill) → Journey To The Blooms Made Simple! three-step
cards (blue card floating in the middle) → Unleash Wanderlust promo + 20% OFF
bar → light footer.

Pure **HTML + CSS + JS**. No runtime dependencies, no external network requests.
Double-click `index.html` — it works from `file://`.

All **English comments** live next to the tricky parts: hero card layering,
gradient veil, headline line masks, carousel math/drag/snap, focus trap,
scroll locking, responsive fallback rules and more.

## Preview

```powershell
# Option 1: just double-click index.html (file:// works, no fetch / modules)

# Option 2: local static server
python -m http.server 5173
# then open http://127.0.0.1:5173/
```

## Commands

```powershell
npm test          # static checks: asset refs, image sizes, anchors, ids, CSS/JS syntax, no external deps
npm run check:ui  # real-browser smoke test: lightbox, keyboard paging, carousel + drag, mobile menu
npm run shots     # headless Edge/Chrome + CDP: 5 page screenshots + 3 interaction states
```

Screenshots are written to `shots/`.

## Reference mapping

| Reference mockup | This page |
| --- | --- |
| UIXSHUVO / ABOUT TOUR PACKAGE CONTACT / Book Trip | Petalwings / TOURS JOURNEY OFFER CONTACT / Book Trip |
| Rounded sky photo + "Experience The Magic Of Flight!" | Rounded white-lily photo + "Experience The Magic Of Bloom!" |
| Left 1-2-3 vertical step dots | Same position, active first dot |
| Bottom-right Know More card (3 thumbs + Awesome Places) | Same card: Blooming Places / Discover The World One Petal At A Time. |
| Follow + airbnb / Booking.com / trivago / Expedia | Follow + Kew Gardens / RHS / teamLab / Bloom & Wild |
| Popular Destination cards (Forest Wild Life, NRT Indonesia, ★ 4.5) | 6-card carousel (White Silk Gardenia, Kyoto Japan, ★ 4.9 …) |
| Journey To The Skies Made Simple! three-step cards | Journey To The Blooms Made Simple!, left grey / middle blue / right grey |
| UNLEASH WANDERLUST WITH SKYWINGS + 20% OFF + CTA | Same structure, copy and photos replaced |
| Plane / island photography | The supplied lily, camellia and pressed-flower photos (plus 3 4:5 card crops) |

## Hard parts and where the comments are

- **Rounded image + overlapping card**: hero container stays `overflow: visible`,
  while the image and veil each own the border-radius. See the comments around
  `.hero__img` / `.hero__shade` / `.know-card` in `css/style.css`.
- **White photo on paper background**: layered left-side gradient plus a barely
  visible cool-blue tint to read as "a framed piece of sky".
- **Headline line masks**: the `overflow: hidden` box for the rise animation is
  enlarged with padding + negative margin so descenders (`g`, `y`, `p`) are not
  clipped while the line spacing stays identical.
- **Carousel width math**: `calc((100% - var(--card-gap) * 2) / 3)`, and the JS
  paging step is measured from the DOM so changing the layout does not require
  touching JS.
- **Drag-to-scroll**: Pointer Events with a 6px threshold, `setPointerCapture`,
  click suppression after a drag, and scroll-snap toggled off while dragging.
- **Lightbox**: focus trap, Escape / arrow keys, body scroll lock, neighbour
  preloading, focus restored to the trigger.
- **Mobile layout traps**: the hero must switch from flex to block on narrow
  screens, and the in-flow Know More card needs `z-index` because the hero image
  is absolutely positioned (otherwise the card is painted underneath).
- **Fallbacks**: `prefers-reduced-motion`, no-JS, `?no-anim=1` (stable
  screenshots) and `?shot=1` (lazy images become eager).

## File structure

```
petalwings/
├─ index.html            page structure + inline SVG sprite (English comments)
├─ css/style.css         design tokens, components, responsive, fallbacks (~1900 lines)
├─ js/main.js            7 interaction modules, no dependencies (~560 lines)
├─ assets/
│  ├─ favicon.svg
│  └─ img/               8 flower photos (7 originals + 3 4:5 card crops)
├─ scripts/              CDP screenshots + interaction smoke test (dev only)
├─ test/page.test.mjs    node:test static checks
├─ package.json
└─ shots/                5 page screenshots + 3 interaction states
```

## Browser support

Modern browsers (Chrome / Edge / Firefox / Safari 16+). System fonts only
(Segoe UI / PingFang / Microsoft YaHei), so no Google Fonts dependency and it
loads fine on mainland China networks. `backdrop-filter`, `aspect-ratio` and
`100svh` all have acceptable fallbacks.
