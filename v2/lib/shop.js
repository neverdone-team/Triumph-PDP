/* ============================================================================
   Triumph prototype — shared shop state
   ----------------------------------------------------------------------------
   One cart, shared by pdp.html → cart.html → checkout.html. The three pages own
   their own layout and copy; everything below is the part they have to agree on:
   what is in the bag, what it costs, and the mini cart that appears on add.

   Storage is localStorage under one key. file:// origins are opaque in some
   browsers and throw on access, so the store falls back through sessionStorage
   to an in-page object — the flow still works inside a single tab either way.
   Serve the folder over http (python3 -m http.server) for the real thing.
   ============================================================================ */
window.Shop = (function () {
  'use strict';

  var KEY = 'triumph.proto.cart.v1';
  /* How much the mini cart shows after an Add (Amelie, 2026-09-10):
       'last' — the original: the line just added, on its own, as a confirmation
       'all'  — the whole bag, that line first, scrollable
     Opened from the basket icon it is always the whole bag, in both modes. */
  var MINI_KEY = 'triumph.proto.miniMode';
  /* Who the shopper is, shared across the pages: 'guest' or 'member' (signed in). The bag
     sets it so the checkout can skip its gate — a signed-in customer has an address and a
     card on file and has nothing to fill in (Amelie, 2026-09-11). */
  var ACCOUNT_KEY = 'triumph.proto.account';
  /* What the mini cart offers alongside the bag (Amelie, 2026-09-16):
       'off'   — the original: lines, shipping, two buttons
       'row'   — ONE matching product on a single line above the shipping note
       'tiles' — up to three, as small packshots in a strip that scrolls sideways
     Two versions rather than one because the trade is real: a row costs ~100px and can
     only ever offer one thing; the strip costs ~190px of a card that is capped at 560
     and offers three. Neither adds a control — there is no size to choose here, so both
     are doors to the product page. */
  var SET_KEY = 'triumph.proto.miniSet';
  var SET_MODES = { off: 1, row: 1, tiles: 1 };
  var FREE_AT = 130;      // free-shipping threshold, € — matches cart + checkout
  var SHIP_STD = 4.99;
  var VAT = 0.19;

  /* ---------------- storage ---------------- */
  var mem = null;
  function backing() {
    try { var s = window.localStorage; s.setItem('__t', '1'); s.removeItem('__t'); return s; } catch (e) {}
    try { var t = window.sessionStorage; t.setItem('__t', '1'); t.removeItem('__t'); return t; } catch (e) {}
    return null;
  }
  var store = backing();

  function blank() { return { lines: [], member: false, voucher: null }; }

  function read() {
    if (!store) return mem || (mem = blank());
    try {
      var raw = store.getItem(KEY);
      if (!raw) return blank();
      var v = JSON.parse(raw);
      return (v && Array.isArray(v.lines)) ? v : blank();
    } catch (e) { return blank(); }
  }

  function write(state) {
    if (!store) { mem = state; }
    else { try { store.setItem(KEY, JSON.stringify(state)); } catch (e) { mem = state; } }
    emit();
    return state;
  }

  /* ---------------- listeners ---------------- */
  var subs = [];
  function emit() {
    var s = read();
    subs.forEach(function (fn) { try { fn(s); } catch (e) {} });
    paintBadges(count(s));
  }
  function onChange(fn) { subs.push(fn); return fn; }

  /* ---------------- money ---------------- */
  // English + €: symbol first, point decimal. One formatter for all three pages.
  function money(n) { return '€' + (Math.round(n * 100) / 100).toFixed(2); }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------------- lines ----------------
     A line is one sellable variant:
       { sku, name, series, colour, size, unit, member, qty, img, swatch, stock }
     `member` is the MyTriumph price when the article has one, otherwise null.
     `stock` is { level: 'ok' | 'low', text } and is display-only.
  --------------------------------------- */
  function add(line, qty) {
    var s = read();
    var n = Math.max(1, qty || 1);
    var hit = s.lines.filter(function (l) { return l.sku === line.sku; })[0];
    if (hit) hit.qty = Math.min(9, hit.qty + n);
    else s.lines.push(Object.assign({}, line, { qty: Math.min(9, n) }));
    write(s);
    return hit || s.lines[s.lines.length - 1];
  }

  function setQty(sku, qty) {
    var s = read();
    s.lines.forEach(function (l) { if (l.sku === sku) l.qty = Math.max(1, Math.min(9, qty)); });
    return write(s);
  }

  function bump(sku, delta) {
    var s = read();
    var hit = s.lines.filter(function (l) { return l.sku === sku; })[0];
    if (hit) hit.qty = Math.max(1, Math.min(9, hit.qty + delta));
    return write(s);
  }

  /* Changing the size re-keys the line, because the sku IS the variant. If the bag already
     holds that variant the two lines merge rather than sitting there as duplicates. */
  function setSize(sku, size) {
    var s = read();
    var line = s.lines.filter(function (l) { return l.sku === sku; })[0];
    if (!line || line.size === size) return s;
    var nextSku = sku.replace(/-[^-]+$/, '') + '-' + String(size).toLowerCase().replace(/\s+/g, '');
    var twin = s.lines.filter(function (l) { return l.sku === nextSku && l !== line; })[0];
    if (twin) {
      twin.qty = Math.min(9, twin.qty + line.qty);
      s.lines = s.lines.filter(function (l) { return l !== line; });
    } else {
      line.size = size;
      line.sku = nextSku;
    }
    return write(s);
  }

  /* Colour is part of the variant too, so it re-keys the line the same way a size change
     does — the colour slug is the middle of `series-name-colour-size`. */
  function setColour(sku, colour) {
    var s = read();
    var line = s.lines.filter(function (l) { return l.sku === sku; })[0];
    if (!line || line.colour === colour) return s;
    var slug = String(colour).toLowerCase().replace(/\s+/g, '-');
    var parts = sku.split('-');
    var nextSku = parts.length > 2
      ? parts.slice(0, -2).join('-') + '-' + slug + '-' + parts[parts.length - 1]
      : sku + '-' + slug;
    var twin = s.lines.filter(function (l) { return l.sku === nextSku && l !== line; })[0];
    if (twin) {
      twin.qty = Math.min(9, twin.qty + line.qty);
      s.lines = s.lines.filter(function (l) { return l !== line; });
    } else {
      line.colour = colour;
      line.sku = nextSku;
    }
    return write(s);
  }

  /* remove() keeps the line and its position so the page can offer an undo — deleting is
     the one destructive act in the bag and it has to be reversible (Amelie, 2026-09-10) */
  var lastRemoved = null;
  function remove(sku) {
    var s = read();
    var i = -1;
    s.lines.forEach(function (l, n) { if (l.sku === sku) i = n; });
    if (i >= 0) lastRemoved = { line: JSON.parse(JSON.stringify(s.lines[i])), at: i };
    s.lines = s.lines.filter(function (l) { return l.sku !== sku; });
    return write(s);
  }
  function undoRemove() {
    if (!lastRemoved) return null;
    var s = read();
    var at = Math.min(lastRemoved.at, s.lines.length);
    s.lines.splice(at, 0, lastRemoved.line);
    var name = lastRemoved.line.name;
    lastRemoved = null;
    write(s);
    return name;
  }

  function clear() { return write(blank()); }

  function setMember(on) { var s = read(); s.member = !!on; return write(s); }
  function setVoucher(code) { var s = read(); s.voucher = code || null; return write(s); }

  function count(s) {
    s = s || read();
    return s.lines.reduce(function (t, l) { return t + l.qty; }, 0);
  }

  /* ---------------- totals ----------------
     `charged` is what the customer actually pays for the line: the member price
     when they are a member and the article has one, otherwise the standard price.
     The cart page still SHOWS both, side by side and never struck through — that
     is a display rule, not a pricing one, so it lives in the page, not here.
  --------------------------------------- */
  function charged(line, member) {
    return (member && line.member) ? line.member : line.unit;
  }

  function totals(opts) {
    opts = opts || {};
    var s = read();
    var member = (opts.member != null) ? opts.member : s.member;
    var shipKind = opts.ship || 'std';

    var sub = s.lines.reduce(function (t, l) { return t + charged(l, member) * l.qty; }, 0);
    var listSub = s.lines.reduce(function (t, l) { return t + l.unit * l.qty; }, 0);
    var discount = s.voucher ? Math.round(sub * 10) / 100 : 0;
    var base = sub - discount;
    var freeShip = member || base >= FREE_AT;

    var shipCost;
    if (shipKind === 'express') shipCost = 9.99;
    else if (shipKind === 'pickup' || shipKind === 'mytriumph') shipCost = 0;
    else shipCost = freeShip ? 0 : SHIP_STD;

    var total = base + shipCost;
    return {
      lines: s.lines, member: member, voucher: s.voucher,
      count: count(s), sub: sub, listSub: listSub, discount: discount,
      base: base, freeShip: freeShip, shipCost: shipCost, total: total,
      vat: total - total / (1 + VAT),
      gap: Math.max(0, FREE_AT - base), freeAt: FREE_AT
    };
  }

  /* ============================================================================
     COMPLETE YOUR SET
     What goes with what. It lives here rather than on the bag page because the mini
     cart offers it too, and two catalogues would drift apart the way the shipping
     figures used to (Amelie, 2026-09-16).
     ============================================================================ */
  var SET_CATALOGUE = [
    { kind:'brief', series:'Amourette', name:'String', colour:'Black', size:'M',
      sku:'amourette-string-black-m', price:22.95, member:19.95, img:'./Assets/10215855-0004_1.webp' },
    { kind:'brief', series:'Amourette', name:'Tai', colour:'Black', size:'M',
      sku:'amourette-tai-black-m', price:24.95, member:19.95, img:'./Assets/ck-brief.webp' },
    { kind:'brief', series:'Aura Spotlight', name:'Maxi Brief', colour:'Black', size:'M',
      sku:'aura-spotlight-maxi-black-m', price:24.95, member:21.95, img:'./Assets/10207997-0004_1.webp' },
    { kind:'brief', series:'Aura Spotlight', name:'Tanga', colour:'Black', size:'M',
      sku:'aura-spotlight-tanga-black-m', price:22.95, member:19.95, img:'./Assets/10208024-0004_1.webp' },
    { kind:'brief', series:'Aura Spotlight', name:'Maxi Brief', colour:'Creamy Dream', size:'M',
      sku:'aura-spotlight-maxi-creamy-m', price:24.95, member:21.95, img:'./Assets/10207997-6720_1.webp' },
    { kind:'bra', series:'Aura Spotlight', name:'Aura Spotlight Bra', colour:'Black', size:'75B',
      sku:'aura-spotlight-bra-black-75b', price:54.95, member:49.45, img:'./Assets/10208018-0004_1.webp' },
    { kind:'bra', series:'Aura Spotlight', name:'Aura Spotlight Bra', colour:'Creamy Dream', size:'75B',
      sku:'aura-spotlight-bra-creamy-75b', price:54.95, member:49.45, img:'./Assets/10208018-6720_1.webp' },
    { kind:'bra', series:'Amourette', name:'Charm Balconette', colour:'White', size:'75B',
      sku:'amourette-charm-white-75b', price:59.95, member:53.95, img:'./Assets/10214770-0003_1.webp' },
    { kind:'bra', series:'Amourette', name:'Minimizer Bra', colour:'Black', size:'75B',
      sku:'amourette-minimizer-black-75b', price:59.95, member:53.95, img:'./Assets/ck-bra.webp' },
    { kind:'bra', series:'Body Make-Up', name:'Soft Bra', colour:'White', size:'75B',
      sku:'body-make-up-soft-white-75b', price:49.95, member:44.95, img:'./Assets/10210668-0003_1.webp' }
  ];

  /* A bra is named as one, or sized as one (75C). Everything else is a brief. Good
     enough for a prototype, and it never has to ask a server what a product is. */
  function kindOf(l) {
    var name = (l && l.name) || '', size = String((l && l.size) || '');
    return (/\b(bra|bralette)\b/i.test(name) || /^\d{2,3}\s?[A-K]{1,2}$/i.test(size))
      ? 'bra' : 'brief';
  }
  function baseSku(v) { return String(v || '').replace(/-[^-]+$/, ''); }

  /* Which half of the set is missing, and what it is missing FROM. The anchor is the
     line the suggestion is matched to, so the offer can name it rather than float. */
  function matchSet(limit) {
    var lines = read().lines;
    if (!lines.length) return null;
    var hasBra = false, hasBrief = false, i;
    for (i = 0; i < lines.length; i++) {
      if (kindOf(lines[i]) === 'bra') hasBra = true; else hasBrief = true;
    }
    /* with both halves already in the bag the briefs are the small, easy addition —
       nobody buys a second bra to go with the bra they have just chosen */
    var want = hasBra ? 'brief' : 'bra';
    var anchor = lines.filter(function (l) { return kindOf(l) !== want; })[0];
    if (!anchor) return null;
    var owned = {};
    lines.forEach(function (l) { owned[baseSku(l.sku)] = true; });
    var pool = SET_CATALOGUE.filter(function (p) {
      return p.kind === want && !owned[baseSku(p.sku)];
    });
    var same = pool.filter(function (p) { return p.series === anchor.series; });
    var rest = pool.filter(function (p) { return p.series !== anchor.series; });
    return { want: want, anchor: anchor, cards: same.concat(rest).slice(0, limit || 3) };
  }

  /* A second strip on the bag answers a different question: not "what goes with this"
     but "what else is selling". So it is not matched to the bag at all — it is a fixed
     popularity order, filtered against what is already in the bag and against whatever
     the set strip is showing, because the same product twice on one page is worse than
     no second strip (Amelie, 2026-09-17). */
  var POPULAR = [
    'aura-spotlight-bra-black-75b',
    'amourette-charm-white-75b',
    'amourette-tai-black-m',
    'body-make-up-soft-white-75b',
    'aura-spotlight-tanga-black-m',
    'amourette-string-black-m'
  ];
  function alsoBought(exclude, limit) {
    var n = limit || 3, taken = {}, out = [];
    read().lines.forEach(function (l) { taken[baseSku(l.sku)] = true; });
    (exclude || []).forEach(function (sku) { taken[baseSku(sku)] = true; });
    function push(p) {
      if (!p || out.length >= n || taken[baseSku(p.sku)]) return;
      taken[baseSku(p.sku)] = true;
      out.push(p);
    }
    POPULAR.forEach(function (sku) {
      push(SET_CATALOGUE.filter(function (c) { return c.sku === sku; })[0]);
    });
    SET_CATALOGUE.forEach(push);   // the catalogue is small; top up rather than show two
    return out;
  }

  /* ---------------- header badge ---------------- */
  function paintBadges(n) {
    var nodes = document.querySelectorAll('[data-cart-count]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = n;
      nodes[i].hidden = false;                       // the badge shows a 0 rather than vanishing
      nodes[i].setAttribute('data-empty', String(n === 0));
    }
  }

  /* ============================================================================
     MINI CART
     A modal card hung under the basket icon, not a side sheet: adding something is a
     confirmation, not a place to work, so it stays next to the control that opens it
     and keeps the page behind it visible. Built here so the PDP, the PLP and anything
     added later get the same one.
     ============================================================================ */
  var mc = null;

  function build() {
    if (mc) return mc;
    var root = document.createElement('div');
    root.className = 'mc';
    root.setAttribute('data-open', 'false');
    root.innerHTML =
      '<div class="mc__scrim" data-mc-close></div>' +
      '<div class="mc__panel" role="dialog" aria-modal="false" aria-label="Shopping bag">' +
        '<span class="mc__grab" aria-hidden="true"></span>' +
        '<header class="mc__head">' +
          '<span class="mc__headline">' +
            '<svg class="mc__tick" viewBox="0 0 20 20" aria-hidden="true">' +
              '<circle cx="10" cy="10" r="9"/><path d="M6 10.4l2.8 2.8L14.2 7"/></svg>' +
            '<span class="mc__title" data-mc-title>Added to your bag</span>' +
          '</span>' +
          '<button class="mc__x" type="button" aria-label="Close" data-mc-close>' +
            '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>' +
          '</button>' +
        '</header>' +
        '<div class="mc__body" data-mc-body></div>' +
        '<div class="mc__set" data-mc-set hidden></div>' +
        '<div class="mc__foot">' +
          '<a class="mc__btn" href="./cart.html">View bag&nbsp;&middot;&nbsp;<span data-mc-count>0</span></a>' +
          '<a class="mc__btn mc__btn--primary" href="./checkout.html">Checkout</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);
    mc = root;

    root.addEventListener('click', function (e) { if (e.target.closest('[data-mc-close]')) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.getAttribute('data-open') === 'true') close();
    });
    // click anywhere else dismisses it — it is a dropdown, not a blocking dialog
    document.addEventListener('mousedown', function (e) {
      if (root.getAttribute('data-open') !== 'true') return;
      if (root.contains(e.target)) return;
      if (anchorEl && anchorEl.contains(e.target)) return;
      close();
    });
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);

    root.addEventListener('mouseenter', function () { overCard = true; cancelLeave(); });
    root.addEventListener('mouseleave', function () {
      overCard = false;
      if (canHover() && hoverOpened) leaveSoon();   // a card opened by an Add stays put
    });
    return root;
  }

  function lineHTML(l) {
    var img = l.img ? '<img src="' + l.img + '" alt="" />' : '';
    return '' +
      '<div class="mc__li" data-sku="' + l.sku + '">' +
        '<span class="mc__thumb">' + img + '</span>' +
        '<span class="mc__info">' +
          /* collection first in normal caps and Light, then the product in caps and
             Regular — the same shape the bag and the rail use (Amelie, 2026-09-11) */
          (l.series ? '<span class="mc__series">' + l.series + '</span>' : '') +
          /* the count sits after the name here too, so every list in the flow reads the
             same way (Amelie, 2026-09-14) */
          '<span class="mc__name">' + l.name +
            (l.qty > 1 ? ' (' + l.qty + ')' : '') + '</span>' +
          (l.colour ? '<span class="mc__meta">Colour: ' + l.colour + '</span>' : '') +
          (l.size ? '<span class="mc__meta">Size: ' + l.size + '</span>' : '') +
          '<span class="mc__num">' + money(l.unit * l.qty) + '</span>' +
        '</span>' +
      '</div>';
  }

  var onlySku = null;          // set when the sheet opens straight after an add

  function account() {
    try { return localStorage.getItem(ACCOUNT_KEY) === 'member' ? 'member' : 'guest'; }
    catch (e) { return 'guest'; }
  }
  function setAccount(kind) {
    try { localStorage.setItem(ACCOUNT_KEY, kind === 'member' ? 'member' : 'guest'); } catch (e) {}
    emit();
  }

  function miniMode() {
    try { return localStorage.getItem(MINI_KEY) === 'all' ? 'all' : 'last'; } catch (e) { return 'last'; }
  }
  function setMiniMode(m) {
    try { localStorage.setItem(MINI_KEY, m === 'all' ? 'all' : 'last'); } catch (e) {}
    if (mc && mc.getAttribute('data-open') === 'true') paintMini();
  }

  function miniSet() {
    try {
      var v = localStorage.getItem(SET_KEY);
      if (v === 'on') v = 'row';          // the first cut had two modes, not three
      return SET_MODES[v] ? v : 'off';
    } catch (e) { return 'off'; }
  }
  function setMiniSet(m) {
    if (m === 'on') m = 'row';
    if (!SET_MODES[m]) m = 'off';
    try { localStorage.setItem(SET_KEY, m); } catch (e) {}
    if (mc && mc.getAttribute('data-open') === 'true') paintMini();
  }
  /* ?mini=tiles on any page that carries the mini cart, because the switcher lives on the
     bag and the mini cart is seen from the PDP (Amelie, 2026-09-16) */
  (function () {
    var m = (String(location.search).match(/[?&]mini=(off|row|tiles|on)/i) || [])[1];
    if (m) setMiniSet(m.toLowerCase());
  })();

  var MC_GO = '<svg viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
    '<path d="M4.5 3L8 6l-3.5 3" stroke="currentColor" stroke-width="1"/></svg>';

  /* No size, no quantity, no add button in either version: the mini cart is a
     confirmation, not a place to work, and a size has to be chosen on the product page —
     so every card here is a door, the way the bag's own strip opens quick shop. */
  function paintSet() {
    var box = mc && mc.querySelector('[data-mc-set]');
    if (!box) return;
    var mode = miniSet();
    var m = mode === 'off' ? null : matchSet(mode === 'tiles' ? 3 : 1);
    if (!m || !m.cards.length) { box.hidden = true; box.innerHTML = ''; box.className = 'mc__set'; return; }
    box.hidden = false;
    box.className = 'mc__set' + (mode === 'tiles' ? ' mc__set--tiles' : '');

    var head = '<span class="mc__set-h">' +
      (m.want === 'brief' ? 'Goes with your ' : 'Completes your ') + esc(m.anchor.name) +
      '</span>';

    if (mode === 'tiles') {
      box.innerHTML = head +
        '<div class="mc__tiles">' + m.cards.map(function (p) {
          return '<a class="mc__tile" href="./pdp.html">' +
            '<span class="mc__tile-img"><img src="' + esc(p.img) + '" alt="" loading="lazy" /></span>' +
            '<span class="mc__tile-nm">' + esc(p.name) + '</span>' +
            '<span class="mc__tile-pr">' + money(p.price) + '</span>' +
          '</a>';
        }).join('') + '</div>';
      return;
    }

    var p = m.cards[0];
    box.innerHTML = head +
      '<a class="mc__set-row" href="./pdp.html">' +
        '<span class="mc__set-thumb"><img src="' + esc(p.img) + '" alt="" /></span>' +
        '<span class="mc__set-info">' +
          '<span class="mc__set-series">' + esc(p.series) + '</span>' +
          '<span class="mc__set-name">' + esc(p.name) + '</span>' +
        '</span>' +
        '<span class="mc__set-pr">' + money(p.price) + '</span>' +
        '<span class="mc__set-go">' + MC_GO + '</span>' +
      '</a>';
  }

  function paintMini() {
    if (!mc) return;
    var t = totals();
    var body = mc.querySelector('[data-mc-body]');
    /* Opened from the basket it is always the whole bag. Opened by an Add it depends on
       the mode: 'last' confirms that one line, 'all' lists the bag with it on top. */
    var shown = t.lines;
    if (onlySku) {
      var hit = t.lines.filter(function (l) { return l.sku === onlySku; });
      if (hit.length) {
        shown = miniMode() === 'all'
          ? hit.concat(t.lines.filter(function (l) { return l.sku !== onlySku; }))
          : hit;
      }
    }
    body.innerHTML = shown.length
      ? shown.map(lineHTML).join('')
      : '<p class="mc__empty">Your bag is empty.</p>';
    mc.querySelector('[data-mc-count]').textContent = t.count;
    paintSet();

    /* No delivery line of any kind here (Amelie, 2026-09-17). Both halves of it were
       wrong for a confirmation card: the gap priced the thing just added against a
       threshold nobody asked about, with no way to act on it from here, and the free
       state was a promise made where nothing had been decided. Delivery belongs to the
       bag, which has the progress bar, and to the checkout, which has the method. */
    place();
  }

  var anchorEl = null;
  var SHEET = '(max-width:599.98px)';

  /* the basket icon in the header — #cartBtn on the PLP and PDP, .hd__bag on the bag
     page, and nothing at all on the checkout's slim header, which falls back to the
     top right corner */
  function anchor() {
    var badge = document.querySelector('[data-cart-count]');
    var el = badge && (badge.closest('button, a') || badge.parentElement);
    return el || null;
  }

  /* Position the card under the basket icon. Below 600 the stylesheet owns the sheet's
     geometry, so every inline value written here has to be cleared on the way down —
     a resize from desktop to phone runs through this same function. */
  function place() {
    if (!mc) return;
    var panel = mc.querySelector('.mc__panel');
    if (!panel) return;

    if (window.matchMedia(SHEET).matches) {
      panel.style.top = panel.style.left = panel.style.width = panel.style.maxHeight = '';
      return;
    }

    var w = Math.min(400, window.innerWidth - 24);
    var top, right;
    anchorEl = anchor();
    if (anchorEl) {
      var r = anchorEl.getBoundingClientRect();
      top = r.bottom + 10;
      right = r.right;                     // the card's right edge tracks the icon's
    } else {
      top = 16;
      right = window.innerWidth - 24;
    }
    var left = Math.min(Math.max(12, right - w), window.innerWidth - w - 12);

    panel.style.width = w + 'px';
    panel.style.left = Math.round(left) + 'px';
    panel.style.top = Math.round(top) + 'px';
    // never let the card run off the bottom, and never let a long bag make a card as
    // tall as the window — the line list scrolls inside it either way
    /* The strip of recommendations needs the height the 560 cap would otherwise take
       away — squeezed against it, the flexible part of the card is the line list, so the
       very line being confirmed is what gets clipped (Amelie, 2026-09-16). */
    var cap = mc.querySelector('.mc__set--tiles') ? 630 : 560;
    panel.style.maxHeight = Math.max(220, Math.min(cap, window.innerHeight - top - 16)) + 'px';
  }

  /* ---------------- hover on desktop ----------------
     These listeners are bound at load, NOT inside build(): build only runs on the first
     open, so binding them there meant hovering a page whose card had never been opened
     did nothing at all. `(hover:hover) and (pointer:fine)` keeps a touch device out even
     when its window is wide — a tap on a hover-bound element fires mouseenter too, and
     the card would open behind the tap. */
  function canHover() {
    return window.matchMedia('(hover:hover) and (pointer:fine)').matches
        && !window.matchMedia(SHEET).matches;
  }
  var overCard = false, leaveT = null;
  function cancelLeave() { if (leaveT) { clearTimeout(leaveT); leaveT = null; } }
  function leaveSoon() {                        // a grace period to travel icon → card
    cancelLeave();
    leaveT = setTimeout(function () { if (!overCard) close(); }, 220);
  }
  document.addEventListener('mouseover', function (e) {
    if (!canHover()) return;
    var a = anchor();
    if (a && (e.target === a || a.contains(e.target))) { cancelLeave(); open({ hover: true }); }
  });
  document.addEventListener('mouseout', function (e) {
    if (!canHover()) return;
    var a = anchor();
    if (!a || !(e.target === a || a.contains(e.target))) return;
    if (mc && mc.contains(e.relatedTarget)) return;
    leaveSoon();
  });

  var hoverOpened = false;
  function open(opts) {
    opts = opts || {};
    var fresh = !mc;                 // was the sheet built by this very call?
    build();
    hoverOpened = !!opts.hover;
    onlySku = opts.only || null;
    mc.querySelector('[data-mc-title]').textContent = opts.title || 'Added to your bag';
    // fill it BEFORE opening, so the panel rises at its final height instead of
    // growing under the animation — and anchor it before it is visible
    paintMini();
    place();
    /* On the first open of a page load the panel has just been appended, so the browser
       has never resolved its closed state (transform:translateY(100%)) — with no start
       value the transition has nothing to run from and the sheet snaps in. Forcing one
       layout read flushes that state, and the slide then plays on every open. */
    if (fresh) void mc.offsetHeight;
    mc.setAttribute('data-open', 'true');
    // preventScroll: focusing the close button inside a panel that is still translated
    // down makes the browser scroll the page to chase it. A hover never takes focus —
    // the pointer is still on the icon and the customer has not asked for the keyboard.
    if (!opts.hover) {
      var x = mc.querySelector('.mc__x'); if (x) x.focus({ preventScroll: true });
    }
  }

  function close() {
    if (!mc) return;
    mc.setAttribute('data-open', 'false');
  }

  onChange(function () { if (mc && mc.getAttribute('data-open') === 'true') paintMini(); });

  /* paint the header badge as soon as the DOM is there */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { paintBadges(count()); });
  } else {
    paintBadges(count());
  }

  /* another tab changed the cart */
  window.addEventListener('storage', function (e) { if (e.key === KEY) emit(); });

  return {
    add: add, setQty: setQty, bump: bump, remove: remove, clear: clear, setSize: setSize,
    setColour: setColour, undoRemove: undoRemove,
    read: read, count: count, totals: totals, charged: charged,
    setMember: setMember, setVoucher: setVoucher,
    money: money, onChange: onChange, refresh: emit,
    openMini: open, closeMini: close,
    miniMode: miniMode, setMiniMode: setMiniMode,
    miniSet: miniSet, setMiniSet: setMiniSet,
    matchSet: matchSet, alsoBought: alsoBought, kindOf: kindOf, SET_CATALOGUE: SET_CATALOGUE,
    account: account, setAccount: setAccount,
    FREE_AT: FREE_AT, SHIP_STD: SHIP_STD
  };
})();
