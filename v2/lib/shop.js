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

  function remove(sku) {
    var s = read();
    s.lines = s.lines.filter(function (l) { return l.sku !== sku; });
    return write(s);
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
        '<p class="mc__ship" data-mc-ship></p>' +
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
    return root;
  }

  function lineHTML(l) {
    var img = l.img ? '<img src="' + l.img + '" alt="" />' : '';
    return '' +
      '<div class="mc__li" data-sku="' + l.sku + '">' +
        '<span class="mc__thumb">' + img + '</span>' +
        '<span class="mc__info">' +
          '<span class="mc__name">' + l.name + '</span>' +
          (l.series ? '<span class="mc__meta">' + l.series + '</span>' : '') +
          (l.colour ? '<span class="mc__meta">Colour: ' + l.colour + '</span>' : '') +
          (l.size ? '<span class="mc__meta">Size: ' + l.size + '</span>' : '') +
          (l.qty > 1 ? '<span class="mc__meta">Quantity: ' + l.qty + '</span>' : '') +
          '<span class="mc__num">' + money(l.unit * l.qty) + '</span>' +
        '</span>' +
      '</div>';
  }

  var onlySku = null;          // set when the sheet opens straight after an add

  function paintMini() {
    if (!mc) return;
    var t = totals();
    var body = mc.querySelector('[data-mc-body]');
    // Opened by an Add, the sheet is a confirmation of that one line. Opened from the
    // basket it is the bag, so it lists everything.
    var shown = t.lines;
    if (onlySku) {
      var hit = t.lines.filter(function (l) { return l.sku === onlySku; });
      if (hit.length) shown = hit;
    }
    body.innerHTML = shown.length
      ? shown.map(lineHTML).join('')
      : '<p class="mc__empty">Your bag is empty.</p>';
    mc.querySelector('[data-mc-count]').textContent = t.count;

    var ship = mc.querySelector('[data-mc-ship]');
    if (!t.lines.length) { ship.hidden = true; }
    else {
      ship.hidden = false;
      ship.textContent = t.gap > 0
        ? money(t.gap) + ' away from free shipping.'
        : 'Your order ships free.';
      ship.setAttribute('data-free', String(t.gap === 0));
    }
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
    // never let the card run off the bottom; its line list scrolls instead
    panel.style.maxHeight = Math.max(220, window.innerHeight - top - 16) + 'px';
  }

  function open(opts) {
    opts = opts || {};
    var fresh = !mc;                 // was the sheet built by this very call?
    build();
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
    // down makes the browser scroll the page to chase it
    var x = mc.querySelector('.mc__x'); if (x) x.focus({ preventScroll: true });
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
    read: read, count: count, totals: totals, charged: charged,
    setMember: setMember, setVoucher: setVoucher,
    money: money, onChange: onChange, refresh: emit,
    openMini: open, closeMini: close,
    FREE_AT: FREE_AT, SHIP_STD: SHIP_STD
  };
})();
