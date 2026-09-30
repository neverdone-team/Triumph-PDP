/* ============================================================================
   OFFERS — the loyalty vouchers, the discount code and every message about them
   Draft for the loyalty manager's feedback (2026-09-25). Shared by the bag (which is
   where the 3-step checkout takes its codes) and the one-page checkout's summary, so
   the two can never word or order things differently.

   The rules live in lib/shop.js (Shop.apply); this file only draws them:
   · [data-promo-rows]   the applied promotions, as summary rows under the subtotal
   · [data-offers-meta]  "1 of 2 offers used" and the seasonal-sale note
   · [data-loyalty-cards] one voucher card per MyTriumph voucher not yet applied
   · the code field's own supporting text — .field__err for an error, .field__hint for
     "applied" and "this will remove X — continue?" (Amelie: no new message styles,
     the text field's error and info messages only)
   · the same two components under a voucher card, which has no field of its own
   · [data-offer-status] a hint under the summary rows: removed / voucher applied
   ============================================================================ */
window.Offers = (function () {
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var eur = Shop.money;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var CROWN = '<svg class="offer-crown" width="14" height="12" viewBox="0 0 23 20" fill="none" aria-hidden="true"><path d="M22.3766 5.22624L15.5607 16.0549L15.7389 0L15.6142 6.93399e-09L11.2574 15.8444L6.89607 4.92073e-07L6.77135 4.99014e-07L6.94954 16.0549L0.133636 5.22624H0L4.41919 19.7137L8.77602 16.7804L13.7342 16.7804L18.091 19.7137L22.5103 5.22624H22.3766Z" fill="currentColor"/></svg>';

  var slots = {};          // key → { kind: 'error' | 'choice' | 'ok', msg, res }
  var status = null, statusTimer = null;

  function offLabel(def) { return def.pct ? def.pct + '% reduction' : eur(def.off).replace('.00', '') + ' reduction'; }

  /* The applied rows are kept, one element per promotion, so their figures can roll the
     way the live bag's code row always has: a new row rolls in from −€0.00 and a changed
     amount rolls to the new one (Amelie, 2026-09-29). `roll` is the page's own. */
  function dcodeHTML(p) {
    return '<span class="dcode__line">' +
        '<span class="t-body-m">' + (p.type === 'loyalty' ? CROWN : '') + esc(p.name) + '</span>' +
        '<span class="muted t-body-s">' + esc(p.note) + '</span>' +
        '<button class="t-link-s dcode__x" type="button" data-offer-remove="' + p.type + ':' + esc(p.id) + '">remove</button>' +
      '</span>' +
      (p.blocked ? noteHTML('blocked', { kind: 'ok', msg: p.blocked }).replace('<div', '<span').replace('</div>', '</span>') : '');
  }
  function syncRows(host, t, roll) {
    var had = {};
    $$('.trow[data-promo]', host).forEach(function (n) { had[n.dataset.promo] = n; });
    t.promos.forEach(function (p) {
      var key = p.type + ':' + p.id, n = had[key], price;
      if (n) { delete had[key]; price = n.querySelector('.t-price'); }
      else {
        n = document.createElement('div');
        n.dataset.promo = key;
        n.innerHTML = '<span class="dcode"></span><span class="t-price"></span>';
        price = n.querySelector('.t-price');
        price.textContent = '−' + eur(0); price.dataset.fig = price.textContent;   // rolls in from zero
      }
      n.className = 'trow trow--code' + (p.blocked ? ' is-blocked' : '');
      n.querySelector('.dcode').innerHTML = dcodeHTML(p);
      var fig = p.blocked ? eur(0) : '−' + eur(p.amount);
      /* only a changed figure is handed on: the page renders twice per change, and a
         second call with the same figure would stop the roll mid-way */
      if (price.dataset.fig !== fig) { if (roll) roll(price, fig); else { price.textContent = fig; price.dataset.fig = fig; } }
      host.appendChild(n);                       // in the order the promotions were applied
    });
    Object.keys(had).forEach(function (k) { had[k].remove(); });
  }

  /* A clash names what it clashes with and offers the one action; nothing applied is
     dropped until the customer takes it (loyalty feedback, 2026-09-29). Shown in the
     field's red error text like any other problem, its link in black (Amelie). */
  function short(o) { return o.type === 'loyalty' ? Shop.LOYALTY[o.id].name : o.id; }
  function list(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  /* One short sentence and one action — no savings explained (Amelie, 2026-09-29) */
  function choiceText(r) {
    var olds = list(r.drop.map(function (o) { return o.type === 'loyalty' ? 'your ' + short(o) : o.id; }));
    return r.reason === 'limit' ? 'Only ' + Shop.PROMO_MAX + ' offers per order.'
      : r.reason === 'code' ? 'One discount code per order.'
      : "Can't be combined with " + olds + '.';
  }
  /* one action only: keeping what is applied is doing nothing (Amelie, 2026-09-29) */
  function choiceLinks(key, r) {
    /* black, the summary's "remove" link (Amelie, 2026-09-29) */
    return '<button class="t-link-s dcode__x" type="button" data-offer-yes="' + esc(key) + '">Use ' + esc(r.name) + ' instead</button>';
  }
  /* the message text itself — an error or a hint, and for a choice its two answers */
  function msgInner(key, sl) {
    if (sl.kind !== 'choice') return esc(sl.msg);
    return esc(choiceText(sl.res)) + '<span class="offer-choice">' + choiceLinks(key, sl.res) + '</span>';
  }
  /* under a card: the text field's supporting text, on a field with no input */
  function noteHTML(key, sl) {
    if (!sl) return '';
    /* a clash is shown as an error too, in red (Amelie, 2026-09-29); its link stays black */
    var err = sl.kind === 'error' || sl.kind === 'choice';
    return '<div class="field field--note' + (err ? ' is-error' : '') + '">' +
      '<span class="' + (err ? 'field__err' : 'field__hint') + '" id="offer-note-' + esc(key.replace(':', '-')) + '" role="' + (err || sl.kind === 'choice' ? 'alert' : 'status') + '">' +
      msgInner(key, sl) + '</span></div>';
  }
  function slotHTML(key) { return noteHTML(key, slots[key]); }

  function cardsHTML(t) {
    if (!t.loyaltyOffered || t.count === 0) return '';
    return Object.keys(Shop.LOYALTY).map(function (id) {
      var v = Shop.LOYALTY[id];
      var on = t.promos.some(function (p) { return p.type === 'loyalty' && p.id === id; });
      if (on) return slotHTML('loyalty:' + id);   // applied: it is a summary row now
      /* the minimum spend is its own line: wrapped after "·" it left the dot or "€40"
         hanging (Amelie, 2026-09-29) */
      var terms = esc('Valid until ' + v.until) + (v.min ? '<br>' + esc('Min. spend ' + eur(v.min).replace('.00', '')) : '');
      var describe = slots['loyalty:' + id] ? ' aria-describedby="offer-note-loyalty-' + id + '"' : '';
      /* the ticket (Amelie, 2026-09-29, a coupon reference): the crown on its own stub,
         then the reduction, the name, the dates, and Redeem as a text link */
      if (cardStyle() === 'ticket') {
        var amount = v.pct ? v.pct + '%' : eur(v.off).replace('.00', '');
        return '<div class="ticket">' +
            '<span class="ticket__stub">' + CROWN.replace('offer-crown', 'ticket__crown').replace('width="14" height="12"', 'width="22" height="19"') + '</span>' +
            '<span class="ticket__main">' +
              '<span class="ticket__amt">' + esc(amount) + '</span>' +
              '<span class="ticket__name t-body-s">' + esc(v.name) + '</span>' +
              '<span class="ticket__terms t-body-s">' + terms + '</span>' +
            '</span>' +
            '<span class="ticket__act"><button class="t-link-s dcode__x ticket__redeem" type="button" data-offer-redeem="' + id + '"' + describe + '>Redeem</button></span>' +
          '</div>' + slotHTML('loyalty:' + id);
      }
      return '<div class="reward" data-on="false">' +
          '<div class="reward__main">' +
            /* the crown says MyTriumph, so the words don't (Amelie, 2026-09-29) */
            '<span class="reward__eyebrow t-title-xs">' + CROWN.replace('offer-crown', 'reward__crown') + esc(v.name) + '</span>' +
            '<span class="reward__amt"><span class="reward__num t-price">' + offLabel(v) + '</span></span>' +
            '<span class="reward__terms t-body-s">' + terms + '</span>' +
          '</div>' +
          '<div class="reward__act">' +
            '<button class="reward__btn" type="button" data-offer-redeem="' + id + '"' + describe + '>Redeem</button>' +
          '</div>' +
        '</div>' + slotHTML('loyalty:' + id);
    }).join('');
  }

  function metaText(t) {
    /* no "n of 2 offers used" counter (Amelie, 2026-09-29: more to read than it helps);
       the rule sits in the code field's hint and a clash names itself */
    /* nor the seasonal-sale sentence (Amelie, 2026-09-29): the line stays empty */
    return '';
  }

  function ruleText(t) {
    return 'Up to ' + t.promoMax + ' offers per order.' +
      (t.loyaltyOffered ? " Some discount codes can't be combined with MyTriumph vouchers." : '');
  }

  /* which voucher card is drawn — a prototype switch (Amelie, 2026-09-29) */
  var CARD_KEY = 'triumph.proto.voucherCard';
  function cardStyle() { try { return localStorage.getItem(CARD_KEY) === 'strip' ? 'strip' : 'ticket'; } catch (e) { return 'ticket'; } }

  /* opened once for a member with vouchers to use; after that the section is the customer's */
  var autoOpened = false;

  var pageRoll = null;
  function render(t, roll) {
    if (roll) pageRoll = roll;
    t = t || Shop.totals();
    $$('[data-promo-rows]').forEach(function (n) { syncRows(n, t, pageRoll); });
    /* The MyTriumph vouchers live inside the collapsible code section, under the field
       (Amelie, 2026-09-29), and its header names them when there are some to use. */
    $$('[data-loyalty-cards]').forEach(function (n) { n.innerHTML = cardsHTML(t); });
    $$('[data-offer-card]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.offerCard === cardStyle())); });
    var toUse = t.loyaltyOffered && t.count > 0 && Object.keys(Shop.LOYALTY).some(function (id) {
      return !t.promos.some(function (p) { return p.type === 'loyalty' && p.id === id; });
    });
    $$('[data-acc-label]').forEach(function (n) {
      n.textContent = toUse ? 'Vouchers, gift card or discount code' : 'Gift card or discount code';
    });
    /* In the bag, a signed-in member with vouchers to use finds the section open: they should
       see what they have. It opens once — closing it, or applying a code (which folds it), is the
       customer's call and is not undone on the next render. Signing out resets it. */
    /* only a section marked data-auto-open does (the bag's); in the checkout it always starts
       collapsed (Amelie, 2026-09-30) */
    var accEl = document.getElementById('voucherAcc');
    if (toUse && !autoOpened && accEl && accEl.hasAttribute('data-auto-open')) { autoOpened = true; setTimeout(openSection, 0); }
    if (!t.loyaltyOffered) autoOpened = false;
    var meta = metaText(t);
    $$('[data-offers-meta]').forEach(function (n) { n.textContent = meta; n.hidden = !meta; });
    $$('[data-offer-status]').forEach(function (n) {
      n.innerHTML = status ? noteHTML('status', { kind: 'ok', msg: status }) : '';
      n.hidden = !status;
    });
    /* the code's messages are the code field's own error and hint */
    var codeField = document.getElementById('voucher');
    if (codeField) {
      var f = codeField.closest('.field'), sl = slots.code;
      var red = !!(sl && (sl.kind === 'error' || sl.kind === 'choice'));
      f.classList.toggle('is-error', red);
      var err = f.querySelector('.field__err'), hint = f.querySelector('.field__hint');
      if (err) err.innerHTML = red ? msgInner('code', sl) : '';
      /* nothing under the field by default — only when something goes wrong (Amelie,
         2026-09-29; the "Up to 2 offers per order…" rule line is gone) */
      if (hint) hint.innerHTML = '';
    }
    var codes = t.promos.filter(function (p) { return p.type === 'code'; }).length;
    $$('[data-voucher-count]').forEach(function (n) { n.textContent = codes ? ' (' + codes + ')' : ''; });
    /* prototype panel */
    var r = Shop.rules();
    $$('[data-offer-rule]').forEach(function (b) {
      var kv = b.dataset.offerRule.split(':');
      b.setAttribute('aria-pressed', String(String(r[kv[0]]) === kv[1]));
    });
  }

  function say(msg) {
    status = msg;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { status = null; render(); }, 4000);
  }

  /* one answer from Shop.apply, drawn where the customer is looking */
  function handle(res, key) {
    /* success says nothing: the new summary row is the confirmation (Amelie, 2026-09-29 —
       only show something when there is a problem) */
    if (res.ok) { delete slots[key]; status = null; if (key === 'code') foldCodeField(); }
    else if (res.choice) { slots[key] = { kind: 'choice', res: res }; status = null; }
    else { slots[key] = { kind: 'error', msg: res.msg }; status = null; }
    /* one message at a time: a stale "applied" elsewhere goes when something new is said */
    Object.keys(slots).forEach(function (k) { if (k !== key && slots[k].kind === 'ok') delete slots[k]; });
    render();
    return !!res.ok;
  }

  /* the page calls this from its Apply button; true means the code is on */
  function applyCode(value) {
    Object.keys(slots).forEach(function (k) { if (slots[k].kind === 'choice') delete slots[k]; });
    var ok = handle(Shop.apply({ type: 'code', id: value }), 'code');
    if (ok) { var f = document.getElementById('voucher'); if (f) f.value = ''; }
    return ok;
  }

  /* a code that went on folds its field away: the new summary row says it is applied,
     and the header carries the count (Amelie, 2026-09-29) */
  /* Opening the section brings its rows in the way every checkout row arrives: rowReveal
     (.rvl), staggered 55ms — the field first, then each voucher (Amelie, 2026-09-29). */
  var REDUCED = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function revealSection() {
    var acc = document.getElementById('voucherAcc');
    if (!acc || acc.dataset.open !== 'true' || REDUCED.matches) return;
    $$('.acc__inner > .voucher, [data-loyalty-cards] > .ticket, [data-loyalty-cards] > .reward', acc).forEach(function (n, i) {
      n.style.setProperty('--i', i);
      n.classList.remove('rvl'); void n.offsetWidth; n.classList.add('rvl');
    });
  }
  function openSection() {
    var acc = document.getElementById('voucherAcc'), b = document.getElementById('voucherToggle');
    var was = acc && acc.dataset.open === 'true';
    if (acc) acc.dataset.open = 'true';
    if (b) b.setAttribute('aria-expanded', 'true');
    if (!was) { render(); revealSection(); }
  }
  function foldCodeField() {
    var acc = document.getElementById('voucherAcc'), b = document.getElementById('voucherToggle');
    if (acc) acc.dataset.open = 'false';
    if (b) b.setAttribute('aria-expanded', 'false');
  }

  function openCodeField(value) {
    var acc = document.getElementById('voucherAcc'), f = document.getElementById('voucher');
    if (acc && acc.dataset.open !== 'true') openSection();
    if (f) { f.value = value || ''; f.focus(); }
    delete slots.code; render();
  }

  /* Prototype presets: the loyalty manager's four combinations, one press each. They
     press the page's own panel buttons for account and pricing, so the page's state and
     its panel stay in step. */
  function press(sel) { var b = document.querySelector(sel); if (b) b.click(); }
  var PRESETS = {
    none:   { sale: false, promos: [] },
    wb:     { sale: false, promos: [{ type: 'loyalty', id: 'welcome' }, { type: 'loyalty', id: 'birthday' }] },
    wc:     { sale: false, promos: [{ type: 'loyalty', id: 'welcome' }, { type: 'code', id: 'SUMMER15' }] },
    bc:     { sale: false, promos: [{ type: 'loyalty', id: 'birthday' }, { type: 'code', id: 'SUMMER15' }] },
    swc:    { sale: true,  promos: [{ type: 'loyalty', id: 'welcome' }, { type: 'code', id: 'SUMMER15' }] }
  };
  function preset(name) {
    var p = PRESETS[name]; if (!p) return;
    if (name !== 'none') {
      press('[data-account-set="member"], [data-acct-set="member"]');
      press('[data-member-set="true"]');
    }
    press('[data-sale-set="' + (p.sale ? 'on' : 'off') + '"]');
    slots = {}; status = null;
    Shop.setRules({ vv: true, loyaltyDown: false });
    Shop.setPromos(p.promos);
  }

  document.addEventListener('click', function (e) {
    var b;
    /* the page's own toggle has flipped data-open by the time this runs */
    if (e.target.closest('#voucherToggle')) { revealSection(); return; }
    if ((b = e.target.closest('[data-offer-redeem]'))) {
      var id = b.dataset.offerRedeem;
      Object.keys(slots).forEach(function (k) { if (slots[k].kind === 'choice') delete slots[k]; });
      handle(Shop.apply({ type: 'loyalty', id: id }), 'loyalty:' + id);
    } else if ((b = e.target.closest('[data-offer-remove]'))) {
      var kv = b.dataset.offerRemove.split(':');
      slots = {}; status = null;
      Shop.removePromo(kv[0], kv[1]);   // the row going is the confirmation
    } else if ((b = e.target.closest('[data-offer-yes]'))) {
      var key = b.dataset.offerYes, s = slots[key];
      if (s && s.res) { var ok = handle(Shop.apply(s.res.p, { drop: s.res.drop }), key);
        if (ok && key === 'code') { var f = document.getElementById('voucher'); if (f) f.value = ''; } }
    } else if ((b = e.target.closest('[data-offer-no]'))) {
      delete slots[b.dataset.offerNo]; render();
    } else if ((b = e.target.closest('[data-offer-preset]'))) {
      preset(b.dataset.offerPreset);
    } else if ((b = e.target.closest('[data-offer-try]'))) {
      openCodeField(b.dataset.offerTry);
    } else if ((b = e.target.closest('[data-offer-card]'))) {
      try { localStorage.setItem(CARD_KEY, b.dataset.offerCard); } catch (err) {}
      render();
    } else if ((b = e.target.closest('[data-offer-rule]'))) {
      var r = b.dataset.offerRule.split(':'), patch = {};
      patch[r[0]] = r[1] === 'true';
      slots = {}; Shop.setRules(patch);
    }
  });
  /* typing again takes the error away — it was about the last code, not this one */
  document.addEventListener('input', function (e) {
    if (e.target.id === 'voucher' && slots.code) { delete slots.code; render(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.id === 'voucher' && e.key === 'Enter') {
      e.preventDefault();
      var btn = document.getElementById('voucherBtn'); if (btn) btn.click();
    }
  });

  return { render: render, applyCode: applyCode, preset: preset };
})();
