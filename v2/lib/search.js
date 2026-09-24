/* ============================================================================
   Triumph prototype — search overlay
   ----------------------------------------------------------------------------
   The Nike pattern (nike.com/de, measured 2026-09-22) rebuilt in Triumph's
   design system. Drop two lines into any page that has a <header> with the
   standard nav:

       <link rel="stylesheet" href="./lib/search.css" />
       <script src="./lib/search.js" defer></script>

   It finds the resting search pill in the header, grows it into the open field
   IN PLACE on the right, fades the nav and the utilities away, and opens the
   sheet underneath in the flow so the page is pushed down rather than covered.

   The sheet reads right to left: the words — suggestions, then the last
   searches — hang in a column under the field, and the products fill the width
   to their left. There is no CANCEL; the × inside the field clears the query,
   and closes the search once there is nothing left to clear.

   TWO LAYOUTS live in here, and the default is the second:

     nike  — the resting pill MORPHS into a field on the right of the row, the
             nav and the utilities fade out from under it, and the words hang
             in two columns beneath the field with the photographs beside them.

     apple — nothing travels at all. The header is left exactly as it is and
             the sheet drops out from under it with the field already inside,
             centred, set at 28px on no ground: a heading you can type into.
             Under it, one column — suggestions, the last searches, the last
             viewed products — and behind it the page is BLURRED rather than
             dimmed, from the sheet's lower edge down. (apple.com, 2026-09-23.)

   SIX RESTING CONTROLS — fill · label · outline · rule · glyph · wide.
   TriumphSearch.control('outline') swaps the one in the nav; the classes are
   in search.css and can be set on any .search directly.

   Options — window.TriumphSearch.set({ ... }) or data-* on <body>:
     layout   : 'apple' (default) | 'nike'
     backdrop : 'blur'    (default — the page behind steps out of focus)
                'overlay' (the sheet floats over a lightly dimmed page)
                'scrim'   (overlay, and the page behind is dimmed properly)
                'push'    (Nike's — the page slides down under it; Nike layout
                           only, since the Apple sheet never moves the header)
     weight   : 'typed'  (default, Nike) | 'completion' (the A/B/C round's call)
     trending : true     — the "Last viewed" products in the no-query state
     control  : one of the six above; null leaves the page's own .search alone
   ============================================================================ */
window.TriumphSearch = (function () {
  'use strict';

  /* ---------------------------------------------------------------- data ---
     Real Triumph series so the completions behave like the live index does:
     "amour" has to reach Amourette, which is the query the Figma round used. */
  var PHOTO = function (n) { return './Assets/plp/products/prod' + String(n).padStart(2, '0') + '.jpg'; };

  var PRODUCTS = [
    { name: 'Amourette 300 Underwired Bra', series: 'Amourette 300',      cat: 'Bras',      price: 59.95, member: 53.95, ph: PHOTO(1),  kw: 'lace wired padded', cl: 4 },
    { name: 'Amourette 300 Brief',          series: 'Amourette 300',      cat: 'Knickers',  price: 24.95, member: 22.45, ph: PHOTO(2),  kw: 'lace knicker', cl: 5 },
    { name: 'Amourette Charm Balconette',   series: 'Amourette Charm',    cat: 'Bras',      price: 62.00, member: 55.80, ph: PHOTO(5),  kw: 'lace balcony', cl: 3, nw: true },
    { name: 'Amourette Spotlight Bra',      series: 'Amourette Spotlight',cat: 'Bras',      price: 64.95, was: 79.95,    ph: PHOTO(8),  kw: 'lace sheer', cl: 2 },
    { name: 'Amourette Charm Shorty',       series: 'Amourette Charm',    cat: 'Knickers',  price: 27.95, member: 25.15, ph: PHOTO(6),  kw: 'lace short', cl: 5 },
    { name: 'Doreen Non-Wired Bra',         series: 'Doreen',             cat: 'Bras',      price: 52.00, member: 46.80, ph: PHOTO(10), kw: 'cotton support full cup unwired', cl: 3 },
    { name: 'Doreen Cotton Maxi',           series: 'Doreen',             cat: 'Knickers',  price: 22.00, ph: PHOTO(16),                kw: 'cotton high waist', cl: 4 },
    { name: 'True Shape Sensation Bra',     series: 'True Shape Sensation', cat: 'Shapewear', price: 54.95, member: 49.45, ph: PHOTO(9), kw: 'smooth seamless shaping', cl: 2, nw: true },
    { name: 'True Shape Sensation Bodysuit', series: 'True Shape Sensation', cat: 'Shapewear', price: 89.00, ph: PHOTO(4),              kw: 'body shaping smooth', cl: 3 },
    { name: 'Body Make-up Soft Touch Bra',  series: 'Body Make-up',       cat: 'Bras',      price: 49.95, member: 44.95, ph: PHOTO(11), kw: 't-shirt seamless smooth padded', cl: 5 },
    { name: 'Body Make-up Essentials Brief',series: 'Body Make-up',       cat: 'Knickers',  price: 19.95, ph: PHOTO(7),                 kw: 'seamless invisible', cl: 4 },
    { name: 'Fit Smart Underwired Bra',     series: 'Fit Smart',          cat: 'Bras',      price: 57.00, ph: PHOTO(14), kw: 'wired everyday', cl: 5 },
    { name: 'Florale Lace Bralette',        series: 'Florale',            cat: 'Bras',      price: 44.95, member: 40.45, ph: PHOTO(20), kw: 'lace bralette soft', cl: 3 },
    { name: 'Florale Lace Brief',           series: 'Florale',            cat: 'Knickers',  price: 21.95, ph: PHOTO(15),                kw: 'lace', cl: 2 },
    { name: 'Triumph Essential Minimizer',  series: 'Essential Minimizer',cat: 'Bras',      price: 46.00, was: 58.00,    ph: PHOTO(13), kw: 'minimiser full cup', cl: 5 },
    { name: 'Triaction Sports Bra Extreme', series: 'Triaction',          cat: 'Activewear',price: 44.95, ph: PHOTO(17), kw: 'sport sports running high impact', cl: 3 },
    { name: 'Triaction Seamfree Sports Bra',series: 'Triaction',          cat: 'Activewear',price: 38.50, member: 34.65, ph: PHOTO(3),  kw: 'sport sports yoga light', cl: 4 },
    { name: 'Summer Mix & Match Bikini Top',series: 'Summer Mix & Match', cat: 'Swimwear',  price: 49.95, ph: PHOTO(18), kw: 'swim bikini beach', cl: 2 },
    { name: 'Summer Mix & Match Bikini Brief', series: 'Summer Mix & Match', cat: 'Swimwear', price: 34.95, ph: PHOTO(19), kw: 'swim bikini beach', cl: 3 },
    { name: 'Nightdress Lounge Satin',      series: 'Night & Lounge',     cat: 'Nightwear', price: 69.00, member: 62.10, ph: PHOTO(21), kw: 'pyjama sleep satin nightie', cl: 3 }
  ];

  /* The query index. Completions are what the shop wants people to land on, so
     they are curated rather than derived — the live engine works the same way. */
  var TERMS = [
    'amourette 300', 'amourette charm', 'amourette spotlight', 'amourette brief',
    'doreen bra', 'doreen cotton maxi',
    'true shape sensation', 'shapewear bodysuit', 'shaping brief',
    'body make-up bra', 'body make-up brief',
    'florale lace bralette', 'fit smart bra',
    'minimizer bra', 't-shirt bra', 'sports bra', 'seamless bra', 'strapless bra',
    'lace bra', 'nursing bra', 'bikini top', 'swimwear', 'nightdress',
    'gift card', 'sale', 'size guide', 'my order'
  ];

  var POPULAR = ['amourette 300', 'doreen', 'sports bra', 't-shirt bra', 'shapewear', 'swimwear', 'sale', 'gift card'];

  var CROWN = '<svg viewBox="0 0 23 20" aria-hidden="true"><path d="M22.3766 5.22624L15.5607 16.0549L15.7389 0L15.6142 0L11.2574 15.8444L6.89607 0L6.77135 0L6.94954 16.0549L0.133636 5.22624H0L4.41919 19.7137L8.77602 16.7804L13.7342 16.7804L18.091 19.7137L22.5103 5.22624H22.3766Z"/></svg>';

  /* --------------------------------------------------------------- config ---*/
  /* layout  : 'apple' (default) — nothing travels, the field is the sheet's
                first line, centred and set large, and the page behind blurs.
              'nike'  — the original: the header's pill morphs into a field on
                the right and the words hang under it in two columns.
     control : which of the six resting builds the header carries. null leaves
               the host page's own .search exactly as it wrote it. */
  var opts = { layout: 'apple', backdrop: 'blur', weight: 'typed', trending: true, control: 'label' };
  var CONTROLS = {
    fill:    'Search',
    label:   'Search',
    outline: 'Search',
    rule:    'Search',
    glyph:   '',
    wide:    'What are you looking for?'
  };
  var RECENT_KEY = 'triumph.proto.search.recent';

  /* ---------------------------------------------------------------- utils ---*/
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function money(n) {
    if (window.Shop && typeof window.Shop.money === 'function') return window.Shop.money(n);
    return '€' + (Math.round(n * 100) / 100).toFixed(2);
  }
  function recent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { return []; }
  }
  function remember(term) {
    var list = recent().filter(function (t) { return t.toLowerCase() !== term.toLowerCase(); });
    list.unshift(term);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6))); } catch (e) {}
  }
  function forget() { try { localStorage.removeItem(RECENT_KEY); } catch (e) {} }

  /* --------------------------------------------------------------- search ---
     Prefix matches rank above word-start matches, which rank above anything
     else the string happens to contain — the order a shopper expects when a
     four-letter stem is meant to reach one series. */
  function score(hay, q) {
    hay = hay.toLowerCase();
    if (hay.indexOf(q) === 0) return 3;
    if (new RegExp('\\b' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(hay)) return 2;
    if (hay.indexOf(q) > -1) return 1;
    return 0;
  }
  function matchProducts(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    var words = q.split(/\s+/);
    return PRODUCTS.map(function (p) {
      var total = 0;
      for (var i = 0; i < words.length; i++) {
        var s = Math.max(score(p.series, words[i]) * 2, score(p.name, words[i]), score(p.cat, words[i]), score(p.kw, words[i]));
        if (!s) return null;                      /* every word has to land */
        total += s;
      }
      return { p: p, s: total };
    }).filter(Boolean).sort(function (a, b) { return b.s - a.s; }).map(function (r) { return r.p; });
  }
  function matchTerms(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    return TERMS.map(function (t) { return { t: t, s: score(t, q) }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return b.s - a.s || a.t.length - b.t.length; })
      .slice(0, 6).map(function (r) { return r.t; });
  }

  /* Two-tone completion: <b> is what was typed, <i> is what the shop is
     offering on top of it. Which half carries the weight is a CSS decision
     (data-weight), so both readings can be compared on the same query. */
  function twoTone(term, q) {
    var i = term.toLowerCase().indexOf(q.trim().toLowerCase());
    if (i < 0) return '<i>' + esc(term) + '</i>';
    var end = i + q.trim().length;
    return (i ? '<i>' + esc(term.slice(0, i)) + '</i>' : '') +
           '<b>' + esc(term.slice(i, end)) + '</b>' +
           (end < term.length ? '<i>' + esc(term.slice(end)) + '</i>' : '');
  }

  /* ------------------------------------------------------------- markup ---*/
  /* The DS Product Card, Context=Recommendation (93:217 → 260:1312/1344/1379):
     photo 1:1.316, one badge bottom-left, then title over price. That context
     carries no colour variations at all, which is why there is no "+ n colors"
     line here — the PLP tile has one, this one must not. */
  function tile(p) {
    var price;
    if (p.was) {
      price = '<span class="ts__tile-prices"><span class="now">' + money(p.price) + '</span>' +
              '<span class="was">' + money(p.was) + '</span></span>' +
              '<span class="ts__tile-low">Last lowest price: ' + money(p.was * 0.82) + '</span>';
    } else if (p.member) {
      price = '<span class="now">' + money(p.price) + '</span>' +
              '<span class="mem">Member price ' + money(p.member) + CROWN + '</span>';
    } else {
      price = '<span class="now">' + money(p.price) + '</span>';
    }
    var badge = p.was ? '<span class="ts__badge ts__badge--sale">Sale</span>'
              : (p.nw ? '<span class="ts__badge">New</span>' : '');
    return '' +
      '<a class="ts__tile" href="./pdp.html">' +
        '<span class="ts__tile-ph"><img src="' + esc(p.ph) + '" alt="' + esc(p.name) + '" loading="lazy" />' + badge + '</span>' +
        '<span class="ts__tile-info">' +
          '<span class="ts__tile-name">' + esc(p.name) + '</span>' +
          '<span class="ts__tile-pr">' + price + '</span>' +
        '</span>' +
      '</a>';
  }
  /* Apple prefixes its quick links with an arrow. Taken off (Amelie,
     2026-09-23) — the rows are terms, not destinations, and the underline on
     hover says everything the arrow did. The <span> stays: it is what carries
     the underline, so the hover never reaches the row's own padding. */
  function termRows(list, q) {
    return '<div class="ts__sugs" role="listbox" aria-label="Search suggestions">' + list.map(function (t) {
      return '<button type="button" class="ts__sug" role="option" aria-selected="false" data-term="' + esc(t) + '">' +
        '<span class="ts__sug-t">' + (q ? twoTone(t, q) : esc(t)) + '</span></button>';
    }).join('') + '</div>';
  }
  /* Terms are rows, not chips — the same row whether it is a completion, a
     popular term or something searched last week. */
  function rows(list, q) {
    return '<div class="ts__sugs" role="listbox" aria-label="Search suggestions">' + list.map(function (t) {
      return '<button type="button" class="ts__sug" role="option" aria-selected="false" data-term="' + esc(t) + '">' +
        (q ? twoTone(t, q) : esc(t)) + '</button>';
    }).join('') + '</div>';
  }

  /* =========================================================== the widget ===*/
  function mount(host) {
    var header = host || document.querySelector('header');
    if (!header || header.querySelector('.ts')) return null;

    var nav = header.querySelector('.nav') || header.firstElementChild;
    var pill = header.querySelector('.search') || header.querySelector('[data-search-trigger]');

    /* read the options the page declared before anything is drawn */
    var d = document.body.dataset;
    /* ?search=nike|apple works on any page that carries the overlay, so a link
       out of the PLP's panel still shows the right round on the PDP — which has
       no panel of its own. The attribute wins over the query string only when
       the query string is absent. */
    if (d.searchLayout) opts.layout = d.searchLayout;
    try {
      var qLayout = new URLSearchParams(location.search).get('search');
      if (qLayout === 'nike' || qLayout === 'apple') opts.layout = qLayout;
    } catch (e) {}
    if (opts.layout === 'nike' && opts.backdrop === 'blur') opts.backdrop = 'overlay';
    if (d.searchBackdrop) opts.backdrop = d.searchBackdrop;
    if (d.searchWeight) opts.weight = d.searchWeight;
    if (d.searchTrending) opts.trending = d.searchTrending !== 'false';
    if (d.searchControl) opts.control = d.searchControl;

    var root = document.createElement('div');
    root.className = 'ts';
    root.dataset.open = 'false';
    root.dataset.query = 'false';
    root.dataset.weight = opts.weight;
    root.dataset.layout = opts.layout;
    root.dataset.backdrop = opts.backdrop;
    root.dataset.mode = (opts.backdrop === 'push' ? 'push' : 'overlay');
    root.dataset.scrim = String(opts.backdrop === 'scrim');
    root.innerHTML = '' +
      '<div class="ts__scrim" aria-hidden="true"></div>' +
      '<div class="ts__bar">' +
        '<div class="ts__field" role="search">' +
          /* DS Icon / Search 81:13 — the dev team's own glyph, stroked at the
             icon/stroke-weight ratio */
          '<svg class="ts__glyph" viewBox="0 0 16 16" aria-hidden="true">' +
            '<path d="M9.83 9.83L15.35 15.35M11.4 6.025C11.4 8.99361 8.99361 11.4 6.025 11.4C3.05639 11.4 0.65 8.99361 0.65 6.025C0.65 3.05639 3.05639 0.65 6.025 0.65C8.99361 0.65 11.4 3.05639 11.4 6.025Z" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '<input class="ts__input" type="search" autocomplete="off" autocapitalize="none" spellcheck="false" ' +
                 'placeholder="Search" aria-label="Search Triumph" role="combobox" aria-expanded="false" aria-controls="ts-panel" />' +
          '<button type="button" class="ts__clear" aria-label="Clear search">' +
            '<svg viewBox="0 0 13 13"><path d="M.5.5l12 12M12.5.5l-12 12"/></svg>' +
          '</button>' +
        '</div>' +
        /* mobile only: the takeover has no page around it to click away on, so
           it carries the way out beside the field */
        '<button type="button" class="ts__cancel">Cancel</button>' +
      '</div>' +
      /* the sheet is the measured box: in the Apple layout it holds the field
         as well as the content, and the panel animates to its height */
      '<div class="ts__panel" id="ts-panel"><div class="ts__sheet">' +
        '<div class="ts__head"></div><div class="ts__inner"></div>' +
      '</div></div>';

    header.classList.add('ts-host');
    header.appendChild(root);

    var bar    = root.querySelector('.ts__bar');
    var field  = root.querySelector('.ts__field');
    var input  = root.querySelector('.ts__input');
    var clear  = root.querySelector('.ts__clear');
    var cancel = root.querySelector('.ts__cancel');
    var panel  = root.querySelector('.ts__panel');
    var sheet  = root.querySelector('.ts__sheet');
    var head   = root.querySelector('.ts__head');
    var inner  = root.querySelector('.ts__inner');
    var scrim  = root.querySelector('.ts__scrim');

    var open = false, kind = '', cursor = -1, sugs = [], lastFocus = null;
    /* The row's content height, measured once at rest: everything else about
       the open row is derived from it, because the nav's own padding is still
       mid-transition on the frame the open runs. */
    var navContentH = (function () {
      if (!nav) return 32;
      var c = getComputedStyle(nav);
      return nav.offsetHeight - (parseFloat(c.paddingTop) || 0) - (parseFloat(c.paddingBottom) || 0);
    })();
    var baseHeaderH = (getComputedStyle(document.documentElement).getPropertyValue('--header-h') || '').trim();
    /* Below LG the DS header is the compact bar and the search is a full-screen
       takeover — the live site switches builds at 992, and so does this. */
    var phone = function () { return window.matchMedia('(max-width: 991.98px)').matches; };
    /* The Apple layout has no bar and no morph at all, so every piece of
       geometry below short-circuits on it. */
    var apple = function () { return opts.layout === 'apple'; };

    /* The field is one element in two homes: in the bar, laid over the header
       row (Nike), or as the first line of the sheet (Apple). Moving it rather
       than drawing it twice is what keeps the caret, the value and the
       listeners alive when the layout is switched under it. */
    function applyLayout() {
      root.dataset.layout = opts.layout;
      /* Apple names the site in the field — "Auf apple.com suchen". It is what
         stops a bare line of 28px type reading as a heading, and it is the only
         place the domain is worth saying. */
      input.placeholder = apple() ? 'Search triumph.com' : 'Search';
      var home = apple() ? head : bar;
      home.appendChild(field);
      home.appendChild(cancel);
      /* the morph writes real geometry; the Apple field must have none */
      field.style.left = field.style.top = field.style.width = field.style.height = '';
      document.body.classList.toggle('ts-apple', apple());
      if (!apple()) { sizeBar(); place(open ? openBox() : pillBox(), false); }
    }

    /* ------------------------------------------------------ geometry ---
       The morph runs on real left/top/width/height so the 1px border never
       distorts. Both boxes are measured in the bar's own coordinates. */
    function pillBox() {
      var b = bar.getBoundingClientRect();
      if (!pill) return { left: b.width / 2 - 80, top: b.height / 2 - 16, width: 160, height: 32 };
      var r = pill.getBoundingClientRect();
      return { left: r.left - b.left, top: r.top - b.top, width: r.width, height: r.height };
    }
    /* The open field keeps the pill's side of the row: its right edge lands on
       the page's own right padding, so it grows leftwards out of the utilities
       instead of travelling to the middle. */
    function openBox() {
      var b = bar.getBoundingClientRect();
      var cs = getComputedStyle(root);
      var pad = parseFloat(cs.getPropertyValue('--ts-pad')) || 24;
      var h = parseFloat(cs.getPropertyValue('--ts-field-h')) || 52;
      var max = parseFloat(cs.getPropertyValue('--ts-field-max')) || 460;
      /* The right edge is the host row's CONTENT edge, not the viewport's: both
         the nav and the sheet are capped at 2400 and centred, so past that
         width the field would otherwise sit 80px right of the column it heads. */
      var host = nav || bar;
      var hr = host.getBoundingClientRect();
      var right = (hr.right - (parseFloat(getComputedStyle(host).paddingRight) || pad)) - b.left;
      var logo = header.querySelector('.logo');
      var logoR = (logo && window.innerWidth >= 992) ? logo.getBoundingClientRect().right - b.left : 0;
      var leftLimit = logoR ? logoR + 48 : (hr.left - b.left) + pad;
      var width = Math.max(240, Math.min(max, right - leftLimit));
      /* 36 above the field, the same as above the logo — not centred in the
         row, because the field is 52 tall and the logo is 20 */
      var rowPad = parseFloat(cs.getPropertyValue('--ts-row-pad')) || 36;
      return { left: right - width, top: rowPad, width: width, height: h };
    }
    function place(box, animate) {
      if (apple()) return;
      if (!animate) { field.style.transition = 'none'; }
      field.style.left = box.left + 'px';
      field.style.top = box.top + 'px';
      field.style.width = box.width + 'px';
      field.style.height = box.height + 'px';
      if (!animate) { void field.offsetWidth; field.style.transition = ''; }
    }
    function sizeBar() {
      if (apple()) return;                         /* there is no bar to size */
      if (phone() && open) return;                 /* the phone bar owns its height */
      /* Open, the row carries 36 above and below its contents — the same air
         the logo has — so it grows from 80 to 104. Computed, not measured: the
         nav's padding is still mid-transition on the frame this runs. */
      var cs0 = getComputedStyle(root);
      var rowPad = parseFloat(cs0.getPropertyValue('--ts-row-pad')) || 36;
      var fh = parseFloat(cs0.getPropertyValue('--ts-field-h')) || 52;
      /* Pushing, the row really is 36 + content + 36. Overlaying, the row stays
         the height it was — the extra air below the field belongs to the sheet
         drawn over the page, so nothing in the flow moves at all. */
      bar.style.height = (open && !phone()
        ? (opts.backdrop === 'push' ? navContentH + rowPad * 2 : rowPad * 2 + fh)
        : (nav ? nav.offsetHeight : 80)) + 'px';
      /* the column of words under the field is exactly as wide as the field */
      root.style.setProperty('--ts-rail', Math.round(openBox().width) + 'px');
    }
    /* The sheet cannot animate to `auto`, so its height is written from the
       content's measured box every time the content changes. */
    function sizePanel() {
      /* --- Apple: the sheet hangs off the header's own lower edge, and its
         height is the field plus the content. The header itself never moves,
         so --header-h is only ever the row it already was. --- */
      if (apple()) {
        var navA = nav ? nav.offsetHeight : 80;
        if (phone() && open) { panel.style.height = ''; panel.style.top = ''; return; }
        root.style.setProperty('--ts-top', (navA + 40) + 'px');
        var hA = open ? sheet.offsetHeight : 0;
        panel.style.height = hA + 'px';
        panel.style.top = navA + 'px';
        scrim.style.top = (navA + hA) + 'px';
        if (baseHeaderH) {
          document.documentElement.style.setProperty('--header-h', open ? navA + 'px' : baseHeaderH);
        }
        return;
      }
      if (phone() && open) { panel.style.height = ''; return; }
      var push = (opts.backdrop === 'push');
      var rowH = bar.offsetHeight || 80;
      /* Where the sheet hangs from: the resting search control's own lower edge
         plus the header's bottom padding. On the inline header that is the row
         (78); on the stacked one it is the top row, and the sheet covers the nav
         row beneath it rather than pushing past it. */
      var navH = nav ? nav.offsetHeight : 80;
      if (pill && !phone()) {
        var pr = pill.getBoundingClientRect(), hr = header.getBoundingClientRect();
        navH = Math.round(pr.bottom - hr.top + 20);
      }
      /* The overlay starts at the row's own lower edge and carries the field's
         overhang in its top padding, so the 36 above the field and the 36 below
         it are both kept without the page moving a pixel. */
      if (!push && !phone()) {
        var cs1 = getComputedStyle(root);
        var rp = parseFloat(cs1.getPropertyValue('--ts-row-pad')) || 36;
        var fh2 = parseFloat(cs1.getPropertyValue('--ts-field-h')) || 52;
        inner.style.paddingTop = (rp + Math.max(0, rp + fh2 - navH)) + 'px';
      } else {
        inner.style.paddingTop = '';
      }
      var h = open ? inner.offsetHeight : 0;
      panel.style.height = h + 'px';
      /* the phone takeover owns its own layout — the sheet is the screen */
      panel.style.top = (push || phone() ? '' : navH + 'px');
      /* the scrim, when it is asked for, hangs off the sheet's lower edge */
      scrim.style.top = ((push ? rowH : navH) + h) + 'px';
      /* The host pages hang their own sticky chrome off --header-h (the PLP's
         results bar does). Pushing makes the header taller, so the token has to
         follow or that bar sticks underneath the sheet and is clipped. An
         overlay leaves the page alone, so only the taller row counts. */
      if (baseHeaderH) {
        document.documentElement.style.setProperty('--header-h',
          open ? (push ? rowH + h : navH) + 'px' : baseHeaderH);
      }
    }

    /* -------------------------------------------------------- rendering ---*/
    function render() {
      var q = input.value.trim();
      root.dataset.query = String(!!q);
      /* TWO states, not three (Amelie, 2026-09-24). The sheet no longer passes
         judgement on a query: there is no "No results" verdict in the overlay,
         because a verdict is a dead end in a box that cannot hold the way out
         of it. The sheet only ever completes; the verdict, the field to correct
         the query in, the suggestions and something to look at instead all live
         on the results page. */
      var next = !q ? 'empty' : 'results';
      var fresh = next !== kind;
      kind = next;

      if (next === 'empty') inner.innerHTML = apple() ? appleEmpty() : viewEmpty();
      else inner.innerHTML = apple() ? appleResults(q) : viewResults(q);

      sugs = [].slice.call(inner.querySelectorAll('.ts__sug'));
      cursor = -1;
      inner.querySelectorAll('.ts__block').forEach(function (b, i) { b.style.setProperty('--i', i); });
      /* stagger only when the state itself changes — restaging on every
         keystroke makes the panel flicker */
      if (!fresh) inner.classList.add('ts--nostagger'); else inner.classList.remove('ts--nostagger');
      /* and the sheet resizes quickly between keystrokes, slowly on the open */
      root.classList.toggle('ts--quick', !fresh && open);
      requestAnimationFrame(function () {
        inner.querySelectorAll('.ts__block').forEach(function (b) { b.classList.add('is-in'); });
        sizePanel();
      });
      sizePanel();
    }

    /* ------------------------------------------------------- Apple views ---
       One column, top to bottom: what people search for, what THIS person
       searched for, and what they last looked at. The words come before the
       photographs in every state — Apple's order, and the right one: a list of
       words is read in a glance and a row of photographs is not. */
    function appleEmpty() {
      var rec = recent();
      var out = '';
      out += '<section class="ts__block"><span class="ts__h">Popular searches</span>' +
             termRows(POPULAR.slice(0, 5)) + '</section>';
      if (rec.length) {
        /* No Clear control beside the heading (Amelie, 2026-09-23, restating the
           09-22 ruling): the heading and the rows, nothing else. The list is
           still in TriumphSearch, so a row-level ✕ can come back if it is ever
           wanted. */
        out += '<section class="ts__block"><span class="ts__h">Last searches</span>' +
               termRows(rec.slice(0, 3)) + '</section>';
      }
      if (opts.trending) {
        out += '<section class="ts__block"><span class="ts__h">Last viewed</span>' +
               '<div class="ts__grid">' + PRODUCTS.slice(0, 4).map(tile).join('') + '</div></section>';
      }
      return '<div class="ts__cols">' + out + '</div>';
    }

    function appleResults(q) {
      var terms = matchTerms(q);
      var hits = matchProducts(q);
      var out = '';
      /* With no completion to offer, the one row IS the query, and calling it a
         suggestion would be the sheet suggesting the shopper's own typing back
         at them. It is labelled for what it does instead: run this search. */
      out += '<section class="ts__block">' +
             '<span class="ts__h">' + (terms.length ? 'Suggestions' : 'Search for') + '</span>' +
             termRows(terms.length ? terms : [q], q) + '</section>';
      if (hits.length) {
        out += '<section class="ts__block"><span class="ts__h">Products</span>' +
               '<div class="ts__grid">' + hits.slice(0, 4).map(tile).join('') + '</div></section>';
      } else {
        /* Nothing under this name — and the sheet still says nothing about it.
           It offers the popular terms the way it does at rest, and Enter takes
           the query to the page, which is where being told counts. */
        out += '<section class="ts__block"><span class="ts__h">Popular searches</span>' +
               termRows(POPULAR.slice(0, 5)) + '</section>';
      }
      return '<div class="ts__cols">' + out + '</div>';
    }

    function viewEmpty() {
      var rec = recent();
      var left = '<section class="ts__block"><span class="ts__h">Last viewed</span>' +
        '<div class="ts__grid">' + PRODUCTS.slice(0, 4).map(tile).join('') + '</div></section>';
      if (!opts.trending) left = '';
      var rail = '<div class="ts__rail' + (rec.length ? ' ts__rail--split' : '') + '">' +
        '<section class="ts__block"><span class="ts__h">Popular searches</span>' + rows(POPULAR.slice(0, 6)) + '</section>' +
        (rec.length
          ? '<section class="ts__block"><span class="ts__h">Last searches</span>' + rows(rec) + '</section>'
          : '') +
        '</div>';
      return '<div class="ts__cols">' + left + rail + '</div>';
    }

    function viewResults(q) {
      var terms = matchTerms(q);
      var hits = matchProducts(q);
      var rec = recent();
      /* the images keep a heading in both states — without one the row reads as
         a band of photographs rather than an answer to what was typed */
      var left = '<section class="ts__block">' +
        '<span class="ts__h">' + (hits.length ? 'Products' : 'Popular right now') + '</span>' +
        '<div class="ts__grid">' + (hits.length ? hits : PRODUCTS.slice(0, 4)).slice(0, 4).map(tile).join('') + '</div>' +
        '</section>';
      var rail = '<div class="ts__rail' + (rec.length ? ' ts__rail--split' : '') + '">' +
        '<section class="ts__block"><span class="ts__h">Top suggestions</span>' + rows(terms.length ? terms : [q], q) + '</section>' +
        (rec.length
          ? '<section class="ts__block"><span class="ts__h">Last searches</span>' + rows(rec.slice(0, 5)) + '</section>'
          : '') +
        '</div>';
      return '<div class="ts__cols">' + left + rail + '</div>';
    }

    /* ----------------------------------------------------------- open ---*/
    function show() {
      if (open) return;
      /* the host measures its own --header-h on load, possibly after this
         mounted, so the value to restore is read at the last moment */
      baseHeaderH = (getComputedStyle(document.documentElement).getPropertyValue('--header-h') || '').trim();
      sizeBar();
      place(pillBox(), false);            /* start on the pill… */
      open = true;
      lastFocus = document.activeElement;
      root.dataset.open = 'true';
      input.setAttribute('aria-expanded', 'true');
      document.body.classList.add('ts-searching');
      document.body.classList.toggle('ts-push', opts.backdrop === 'push' && !apple());
      sizeBar();                        /* the row grows to 36 + field + 36 */
      if (phone()) document.body.style.overflow = 'hidden';
      render();
      requestAnimationFrame(function () {
        place(openBox(), true);           /* …and travel to the row */
        sizePanel();
      });
      /* Apple gets the caret straight away — there is no travel to wait out. */
      setTimeout(function () { input.focus({ preventScroll: true }); }, apple() ? 0 : 60);
    }

    function hide() {
      if (!open) return;
      open = false;
      root.dataset.open = 'false';
      input.setAttribute('aria-expanded', 'false');
      input.blur();
      document.body.classList.remove('ts-searching');
      document.body.classList.remove('ts-push');
      document.body.style.overflow = '';
      sizeBar();
      sizePanel();                     /* height 0, scrim parked, --header-h restored */
      place(pillBox(), true);
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
      /* Nike's CANCEL sits exactly where the basket icon is, and the mini cart
         opens on hover — so closing from there dropped the bag open under the
         pointer. The utilities stay dead until the pointer actually moves
         again. Apple never covers them, so it never needs this. */
      if (!apple()) document.body.classList.add('ts-justclosed');
      var release = function () {
        document.body.classList.remove('ts-justclosed');
        document.removeEventListener('mousemove', release);
      };
      document.addEventListener('mousemove', release);
      window.setTimeout(release, 1200);
      window.setTimeout(function () {
        if (!open) { input.value = ''; root.dataset.query = 'false'; kind = ''; inner.innerHTML = ''; }
      }, 360);
    }

    /* Enter, or a click on a suggestion, leaves the sheet for the results page —
       a search anyone can bookmark or send on, which is what the sheet cannot be. */
    function submit(term) {
      term = (term || input.value).trim();
      if (!term) return;
      remember(term);
      window.location.href = resultsUrl(term);
    }

    /* --------------------------------------------------------- wiring ---*/
    if (pill) {
      /* the resting pill is a live input on these pages — take the click and
         the focus before it can put a caret in a 32px box */
      /* Apple leaves the control in the header while the sheet is up, so it has
         to be the way back out as well as the way in. */
      pill.addEventListener('mousedown', function (e) { e.preventDefault(); open ? hide() : show(); });
      var pi = pill.querySelector('input');
      if (pi) {
        pi.setAttribute('readonly', 'readonly');
        pi.setAttribute('tabindex', '-1');
        pi.addEventListener('focus', show);
      }
      pill.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open ? hide() : show(); }
      });
    }
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-search-open]');
      if (t) { e.preventDefault(); show(); }
    });

    scrim.addEventListener('click', hide);
    cancel.addEventListener('click', hide);
    /* one control doing the two jobs CANCEL and × used to split between them */
    clear.addEventListener('click', function () {
      if (input.value) { input.value = ''; render(); input.focus({ preventScroll: true }); }
      else hide();
    });

    var tick = null;
    input.addEventListener('input', function () {
      window.clearTimeout(tick);
      tick = window.setTimeout(render, 70);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); input.value ? (input.value = '', render()) : hide(); return; }
      if (e.key === 'Enter') { e.preventDefault(); submit(cursor > -1 && sugs[cursor] ? sugs[cursor].dataset.term : ''); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      if (!sugs.length) return;
      e.preventDefault();
      cursor += (e.key === 'ArrowDown' ? 1 : -1);
      if (cursor < -1) cursor = sugs.length - 1;
      if (cursor >= sugs.length) cursor = -1;
      sugs.forEach(function (s, i) { s.setAttribute('aria-selected', String(i === cursor)); });
    });

    inner.addEventListener('click', function (e) {
      var term = e.target.closest('[data-term]');
      if (term) { submit(term.dataset.term); return; }
    });

    document.addEventListener('keydown', function (e) {
      if (!open && (e.key === '/' || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)))) {
        var tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault(); show();
      } else if (open && e.key === 'Escape') { hide(); }
    });

    /* a click anywhere on the page behind closes it, the way a dropdown does */
    document.addEventListener('mousedown', function (e) {
      if (!open || phone()) return;
      if (root.contains(e.target) || (pill && pill.contains(e.target))) return;
      hide();
    });

    var rs = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(rs);
      rs = window.setTimeout(function () {
        sizeBar();
        place(open ? openBox() : pillBox(), false);
        sizePanel();
      }, 80);
    });

    /* --------------------------------------------------- the resting build ---
       Six ways for the header to carry the search. The class goes on the
       control itself so a specimen board can set all six at once; the body
       attribute is only there for the one rule that needs the row around it
       (wide, which has to take the utilities' spare width). */
    function control(name) {
      if (!CONTROLS.hasOwnProperty(name)) return opts.control;
      opts.control = name;
      document.body.dataset.searchControl = name;
      if (pill) {
        Object.keys(CONTROLS).forEach(function (k) { pill.classList.toggle('search--' + k, k === name); });
        var i = pill.querySelector('input');
        if (i) i.placeholder = CONTROLS[name];
      }
      navContentH = (function () {
        if (!nav) return 32;
        var c = getComputedStyle(nav);
        return nav.offsetHeight - (parseFloat(c.paddingTop) || 0) - (parseFloat(c.paddingBottom) || 0);
      })();
      sizeBar();
      place(open ? openBox() : pillBox(), false);
      sizePanel();
      return name;
    }

    applyLayout();
    if (opts.control) control(opts.control);
    sizeBar();
    place(pillBox(), false);

    return {
      open: show,
      close: hide,
      control: control,
      controls: Object.keys(CONTROLS),
      set: function (next) {
        var was = opts.layout;
        Object.keys(next || {}).forEach(function (k) { opts[k] = next[k]; });
        root.dataset.weight = opts.weight;
        root.dataset.backdrop = opts.backdrop;
        root.dataset.mode = (opts.backdrop === 'push' ? 'push' : 'overlay');
        root.dataset.scrim = String(opts.backdrop === 'scrim');
        if (next && next.control) control(next.control);
        if (opts.layout !== was) applyLayout();
        if (open) {
          document.body.classList.toggle('ts-push', opts.backdrop === 'push' && !apple());
          sizeBar(); place(openBox(), true); render(); sizePanel();
        }
        return opts;
      },
      options: opts,
      products: PRODUCTS
    };
  }

  /* Where a submitted query goes. One definition, so the sheet, the suggestion
     rows and any page that wants to link to results all agree. */
  function resultsUrl(q) { return './search-results.html?q=' + encodeURIComponent(q); }

  var api = {
    mount: mount, products: PRODUCTS, terms: TERMS, popular: POPULAR,
    match: matchProducts, suggest: matchTerms, resultsUrl: resultsUrl,
    /* the results page runs a search of its own now, so the recent list has to
       be writable from outside the sheet or the two would disagree */
    remember: remember, recent: recent, forget: forget
  };
  function boot() {
    var w = mount();
    if (w) {
      api.open = w.open; api.close = w.close; api.set = w.set;
      api.control = w.control; api.controls = w.controls; api.options = w.options;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return api;
})();
