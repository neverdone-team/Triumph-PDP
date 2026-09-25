#!/usr/bin/env python3
"""Build DS-constrained copies of the bag, mini cart and checkout.

Reads the pre-DS originals (v2/cart-original.html, v2/checkout-original.html,
v2/lib/shop-original.css) and writes the published pages (v2/cart.html, v2/checkout.html,
v2/lib/shop.css) in which every typographic rule is one of the 21 text styles in
*Design System Triumph* (C4UzkYsFCfJGxKr7BaakLO), every colour is a Brand-collection role,
every padding / margin / gap is a step of the spacing scale and every shadow is one of the
Elevation effect styles. The originals are never touched — edit THOSE, then rebuild; never hand-edit the outputs.
Since 2026-09-24 the DS build is what the live prototype serves (Amelie's call).

    python3 v2/ds-constrained/build.py      # rebuild after the originals change

The rule log goes to v2/ds-constrained/changes.json and is shown on the compare page.
"""
import json, re, pathlib

V2 = pathlib.Path(__file__).resolve().parent.parent
OUT = V2 / 'ds-constrained'

# ---------------------------------------------------------------- the design system
# name: (weight, upper, letter-spacing, desktop size/lh) — responsive sizes live in ds-tokens.css
STYLES = {
    'Display':         (400, True,  '.02em', 32, 38),
    'Title/1':         (400, True,  '.04em', 24, 30),
    'Title/2':         (400, True,  '.04em', 20, 24),
    'Title/3':         (400, True,  '.04em', 16, 20),
    'Title/4':         (400, True,  '.04em', 14, 20),
    'Title/5':         (400, True,  '.04em', 12, 16),
    'Title/6':         (400, True,  '.04em', 11, 14),
    'Body/L':          (400, False, '.04em', 16, 20),
    'Body/M':          (300, False, '.04em', 14, 20),
    'Body/S':          (300, False, '.04em', 12, 16),
    'Body/XS':         (300, False, '.04em', 10, 14),
    'Label/M':         (300, True,  '.04em', 12, 16),
    'Label/S':         (300, True,  '.04em', 10, 12),
    'Label/Emphasis':  (400, False, '.04em', 14, 20),
    'Label/Control':   (300, True,  '.04em', 12, 16),
    'Label/Control L': (400, True,  '.04em', 14, 20),
    'Link':            (300, False, '.04em', 14, 16),
    'Price/L':         (400, False, '0',     14, 16),
    'Price/M':         (400, False, '0',     12, 14),
    'Price/Note':      (300, False, '0',     12, 14),
    'Price/S':         (400, False, '0',     10, 12),
}
def slug(name): return name.lower().replace('/', '-').replace(' ', '-')

# Brand-collection colour roles, resolved (Triumph mode)
ROLES = {
    'text/primary': '#000000', 'text/secondary': '#747474', 'text/on-dark': '#ffffff',
    'text/accent': '#5e2039', 'text/error': '#e40032', 'text/success': '#008000',
    'text/warning': '#936a00', 'text/info': '#0f5e8b',
    'icon/high-contrast': '#000000', 'icon/medium-contrast': '#747474',
    'surface/page': '#f8f3f3', 'surface/raised': '#ffffff', 'surface/muted': '#cecece',
    'surface/hover': '#f1f1f1', 'surface/dark': '#000000', 'surface/sales': '#c1003f',
    'surface/subtle': 'rgba(0,0,0,.05)', 'surface/frosted': 'rgba(255,255,255,.2)',
    'surface/frosted-dark': 'rgba(0,0,0,.4)', 'overlay/scrim': 'rgba(0,0,0,.38)',
    'surface/error': '#f8e6e8', 'surface/success': '#e7f8e6', 'surface/warning': '#f8f7e6',
    'surface/info': '#e6f0f8', 'action/primary': '#000000', 'accent/brand': '#5e2039',
    'border/high-contrast': '#000000', 'border/medium-contrast': '#aeaeae',
    'border/low-contrast': '#cecece', 'border/subtle': '#e0e0e0', 'border/error': '#e40032',
    'border/success': '#008000', 'border/warning': '#936a00', 'border/info': '#0f5e8b',
}
FAMILY = {
    'text':    [r for r in ROLES if r.startswith(('text/', 'icon/', 'accent/'))],
    'surface': [r for r in ROLES if r.startswith(('surface/', 'overlay/', 'action/'))],
    # border/subtle is for dividers only: it is reached through --c-hair, never by snapping a
    # literal, so control outlines (payment tiles, size chips) keep border/low contrast
    'border':  [r for r in ROLES if r.startswith('border/') and r != 'border/subtle'],
}
FAMILY['any'] = [r for r in ROLES if r != 'border/subtle']
# payment-provider marks keep their own colours — they are not the system's to set
BRAND_MARKS = {'#003087', '#009cde', '#0b051d', '#1a1f71', '#eb001b', '#f79e1b',
               '#fbbc05', '#ea4335', '#4285f4', '#34a853', '#ffb3c7', '#17120f'}

SPACING = [0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40, 48, 56, 60, 64, 72, 80, 88, 96, 104, 112, 120]
CONTROLS = [24, 28, 30, 36, 40, 44, 48, 56]

ELEVATION = {   # effect styles
    'Elevation/Popover': '0 8px 20px rgba(0,0,0,.06)',
    'Elevation/Menu':    '0 4px 12px rgba(0,0,0,.08)',
    'Elevation/Control': '0 2px 8px rgba(0,0,0,.18)',
    'Elevation/Overlay': '0 4px 50px rgba(0,0,0,.16)',
}

# ---------------------------------------------------------------- colour maths
def parse_colour(s):
    s = s.strip().lower()
    m = re.fullmatch(r'#([0-9a-f]{3,8})', s)
    if m:
        h = m.group(1)
        if len(h) in (3, 4): h = ''.join(c * 2 for c in h)
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1
        return r, g, b, a
    m = re.fullmatch(r'rgba?\(([^)]*)\)', s)
    if m:
        p = [x.strip() for x in m.group(1).replace('/', ',').split(',')]
        r, g, b = (float(x) for x in p[:3])
        a = float(p[3]) if len(p) > 3 else 1
        return r, g, b, a
    return None

def on_white(c):
    r, g, b, a = c
    return tuple(v * a + 255 * (1 - a) for v in (r, g, b))

def dist(c1, c2):
    # compare as painted on white, plus a penalty for alpha mismatch so a translucent
    # overlay prefers a translucent role
    d = sum((x - y) ** 2 for x, y in zip(on_white(c1), on_white(c2))) ** .5
    return d + abs(c1[3] - c2[3]) * 40

def nearest_role(lit, family):
    c = parse_colour(lit)
    if c is None: return None
    best = min(FAMILY[family], key=lambda r: dist(c, parse_colour(ROLES[r])))
    return best

def family_for(prop, selector=''):
    p = prop.lower()
    if p.startswith('--'):
        n = p
        if re.search(r'hair|edge|border|rule|line', n): return 'border'
        if re.search(r'bg|wash|grey|gray|surface|tint|offwhite|scrim|peppermint|tutu|warning$|info-tint|sales', n): return 'surface'
        if re.search(r'ink|text|on-dark|burgundy|error|green|buddha|cerulean', n): return 'text'
        return 'any'
    if p.startswith(('border', 'outline', 'text-decoration-color', 'column-rule')): return 'border'
    if p.startswith(('background', 'fill')): return 'surface'
    if p in ('color', 'stroke', 'caret-color', 'accent-color'): return 'text'
    return 'any'

def role_var(role): return 'var(--ds-' + role.replace('/', '-') + ')'

COLOUR_RE = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)')

# ---------------------------------------------------------------- typography mapping
PRICE_SEL = re.compile(r'price|__pr\b|-pr\b|__num|num\b|total|grand|amount|__fig|\bfig\b|was\b|__sum-v|instal', re.I)
BTN_SEL = re.compile(r'btn|button|__cta|chip|tab\b|stepnav|sizes', re.I)

def nearest(vals, x, tie_up=True):
    return min(vals, key=lambda v: (abs(v - x), -v if tie_up else v))

def classify(size, weight, upper, ls, underline, selector):
    if underline:
        return 'Link'
    ls0 = ls is not None and re.fullmatch(r'-?0*(\.0+)?(em|px)?|0?\.0[0-2]em', ls.strip()) is not None
    is_price = (not upper) and (PRICE_SEL.search(selector) is not None or ls0)
    if is_price:
        if size >= 15:
            opts = {32: 'Display', 24: 'Title/1', 20: 'Title/2', 16: 'Title/3'}
            return opts[nearest(list(opts), size)]
        if size >= 13: return 'Price/L'
        if size >= 11.5: return 'Price/M' if weight >= 400 else 'Price/Note'
        return 'Price/S'
    if upper:
        if BTN_SEL.search(selector) and size in (12, 13, 14) :
            return 'Label/Control L' if (weight >= 400 and size >= 13) else ('Title/5' if weight >= 400 else 'Label/Control')
        if weight < 400 and size <= 12.5:
            return {12: 'Label/M', 10: 'Label/S'}[nearest([12, 10], size)]
        opts = {32: 'Display', 24: 'Title/1', 20: 'Title/2', 16: 'Title/3', 14: 'Title/4', 12: 'Title/5', 11: 'Title/6'}
        return opts[nearest(list(opts), size)]
    # sentence case
    if size >= 15: return 'Body/L'
    if size >= 13: return 'Label/Emphasis' if weight >= 400 else 'Body/M'
    if size >= 11: return 'Body/S'
    return 'Body/XS'

def style_decls(name):
    w, up, ls, _, _ = STYLES[name]
    s = slug(name)
    d = [f'font-weight:{w}', f'font-size:var(--ds-{s}-fs)', f'line-height:var(--ds-{s}-lh)',
         f'letter-spacing:{ls}', 'text-transform:' + ('uppercase' if up else 'none')]
    if name == 'Link':
        d += ['text-decoration:underline']
    return d

# where the DS component itself names the style, that wins over the nearest-match
COMPONENT_STYLES = [
    (r'^\s*\.btn\s*$|^\s*\.mc__btn\s*$|\.sso button\s*$', 'Label/Control L'),   # Button 83:26 label
    (r'\.field__frame legend|\.field:focus-within \.field__label', 'Label/S'),        # Text Field 116:229 label
    (r'^\s*\.steps__no\s*$', 'Title/6'),     # the step number in its 22px circle — the smallest title (Amelie, 2026-09-24)
]

TYPO_PROPS = {'font-weight', 'font-size', 'line-height', 'letter-spacing', 'text-transform'}

# ---------------------------------------------------------------- CSS walking
def split_decls(body):
    """Split a declaration block on ; that are not inside parentheses or strings."""
    out, depth, cur, q = [], 0, '', None
    for ch in body:
        if q:
            cur += ch
            if ch == q: q = None
            continue
        if ch in '"\'': q = ch
        elif ch == '(': depth += 1
        elif ch == ')': depth -= 1
        if ch == ';' and depth == 0:
            out.append(cur); cur = ''
        else:
            cur += ch
    if cur.strip(): out.append(cur)
    return out

def px(v):
    m = re.fullmatch(r'\s*(-?\d*\.?\d+)px\s*', v)
    return float(m.group(1)) if m else None

def snap_calc_sums(value, log, sel, prop):
    # calc() that only adds spacing tokens / px is one gap in Figma terms, so it has to be a step
    def rep(m):
        expr = m.group(1)
        if not re.fullmatch(r'\s*(var\(--space-\d+\)|\d+px)(\s*\+\s*(var\(--space-\d+\)|\d+px))+\s*', expr): return m.group(0)
        total = sum(int(x) for x in re.findall(r'--space-(\d+)\)|(\d+)px', expr) for x in x if x)
        s = nearest(SPACING, total, tie_up=False)
        if s != total: log.append({'sel': sel, 'kind': 'spacing', 'prop': prop, 'from': f'calc({expr.strip()}) = {total}px', 'to': f'{s}px'})
        return f'var(--space-{s})'
    return re.sub(r'calc\(([^()]*(?:\([^()]*\)[^()]*)*)\)', rep, value)

def snap_spacing(value, log, sel, prop):
    value = snap_calc_sums(value, log, sel, prop)
    for a, b in (('28', '24'),):
        if f'var(--space-{a})' in value:
            log.append({'sel': sel, 'kind': 'spacing', 'prop': prop, 'from': f'--space-{a} ({a}px, not a DS step)', 'to': f'{b}px'})
            value = value.replace(f'var(--space-{a})', f'var(--space-{b})')
    def rep(m):
        n = float(m.group(1)); sign = -1 if n < 0 else 1; a = abs(n)
        if a <= 1: return m.group(0)
        s = nearest(SPACING, a, tie_up=False)
        if s != a:
            log.append({'sel': sel, 'kind': 'spacing', 'prop': prop, 'from': m.group(0), 'to': f'{int(s * sign)}px'})
        return f'{int(s * sign)}px'
    # leave var() fallbacks alone: split on var(...) and only snap the parts outside it
    parts = re.split(r'(var\([^()]*(?:\([^()]*\)[^()]*)*\))', value)
    return ''.join(x if x.startswith('var(') else re.sub(r'(?<![\w.-])(-?\d*\.?\d+)px', rep, x) for x in parts)

# the prototypes' named tokens → the role each one stands for. The DS no longer has a 5% border
# (border/low contrast is #CECECE now). The checkout/bag separators (--c-hair) take border/subtle
# #E0E0E0, added to the DS for exactly this on 2026-09-25 (#F1F1F1 read too faint there); the
# mini cart's header rule stays on surface/hover #F1F1F1, which Amelie liked.
TOKEN_ROLES = {
    '--c-ink': 'text/primary', '--c-ink-soft': 'text/secondary', '--c-on-dark': 'text/on-dark',
    '--c-bg': 'surface/raised', '--c-offwhite': 'surface/page', '--c-wash': 'surface/hover',
    '--c-grey-light': 'surface/hover', '--c-grey-medium': 'icon/medium-contrast',
    '--c-hair': 'border/subtle', '--c-edge': 'border/low-contrast',
    '--c-burgundy': 'text/accent', '--c-sales': 'surface/sales', '--c-scrim': 'overlay/scrim',
    '--color-error': 'text/error', '--color-tutu': 'surface/error', '--color-green': 'text/success',
    '--color-peppermint': 'surface/success', '--color-buddha': 'text/warning', '--color-warning': 'surface/warning',
    '--color-buddha-ink': 'text/warning', '--color-darkcerulean': 'text/info', '--color-info-tint': 'surface/info',
    '--mc-ink': 'text/primary', '--mc-ink-50': 'text/secondary', '--mc-bg': 'surface/raised',
    '--mc-hair': 'border/low-contrast', '--mc-hair-soft': 'surface/hover', '--mc-edge': 'border/low-contrast', '--mc-grey': 'surface/hover',
    '--mc-scrim': 'overlay/scrim', '--mc-green': 'text/success',
}

def map_colours(value, prop, sel, log):
    if prop in TOKEN_ROLES:
        lit = value.strip()
        role = TOKEN_ROLES[prop]
        c = parse_colour(lit)
        if c and dist(c, parse_colour(ROLES[role])) > 0.5:
            log.append({'sel': sel, 'kind': 'colour', 'prop': prop, 'from': lit, 'to': role})
        return ' ' + role_var(role) if c else value
    fam = family_for(prop, sel)
    def rep(m):
        lit = m.group(0)
        if lit.lower() in BRAND_MARKS: return lit
        role = nearest_role(lit, fam)
        if not role: return lit
        if parse_colour(lit) and dist(parse_colour(lit), parse_colour(ROLES[role])) > 0.5:
            log.append({'sel': sel, 'kind': 'colour', 'prop': prop, 'from': lit, 'to': role})
        return role_var(role)
    return COLOUR_RE.sub(rep, value)

def map_shadow(value, sel, log):
    if value.strip() in ('none', 'inherit', '0 0 0 0 transparent') or 'var(' in value: return value
    blur = re.findall(r'(\d+)px', value)
    b = max([int(x) for x in blur] or [0])
    name = 'Elevation/Overlay' if b >= 30 else ('Elevation/Popover' if b >= 16 else ('Elevation/Menu' if b >= 10 else 'Elevation/Control'))
    if 'inset' in value: return value
    log.append({'sel': sel, 'kind': 'shadow', 'prop': 'box-shadow', 'from': value.strip(), 'to': name})
    return 'var(--ds-' + slug(name) + ')'

def process_block(sel, body, in_media, log, skip=False):
    if skip: return body
    decls = split_decls(body)
    parsed = []
    for d in decls:
        if ':' not in d or d.strip().startswith('/*') and d.strip().endswith('*/') and ':' not in d.split('*/')[-1]:
            parsed.append((None, None, d)); continue
        # keep a comment that precedes the declaration
        lead = ''
        dd = d
        while True:
            m = re.match(r'(\s*/\*.*?\*/)', dd, re.S)
            if not m: break
            lead += m.group(1); dd = dd[m.end():]
        if ':' not in dd:
            parsed.append((None, None, d)); continue
        p, v = dd.split(':', 1)
        parsed.append((p.strip().lower(), v, lead + re.match(r'\s*', dd).group(0)))
    props = {p: v.strip() for p, v, _ in parsed if p}
    typo = [p for p in props if p in TYPO_PROPS]
    has_size = 'font-size' in props and px(props['font-size']) is not None
    underline = 'underline' in props.get('text-decoration', '') or 'underline' in props.get('text-decoration-line', '')

    decision = None     # None = leave the type alone, 'drop', or a style name
    if typo:
        own_utility = re.fullmatch(r'\s*\.t-[\w-]+\s*', sel) is not None
        targets_utility = ('.t-' in sel) and not own_utility
        base_el = re.fullmatch(r'\s*(body|html|input|select|textarea|button)(\s*,\s*(input|select|textarea|button))*\s*', sel) is not None
        full = has_size and ('font-weight' in props or 'text-transform' in props or base_el)
        comp = next((st for rx, st in COMPONENT_STYLES if re.search(rx, sel)), None)
        if comp and has_size and not in_media:
            decision = comp
            log.append({'sel': sel.strip(), 'kind': 'type', 'from': f"{props.get('font-weight','–')} {props['font-size']}/{props.get('line-height','–')} ls {props.get('letter-spacing','–')}", 'to': comp + ' (DS component)'})
        elif targets_utility or (in_media and not full) or not full:
            decision = 'drop'
        else:
            size = px(props['font-size'])
            if size == 0: decision = None
            else:
                wv = props.get('font-weight', '300')
                weight = 400 if wv in ('400', '500', '600', '700', 'bold', 'normal') else (300 if wv in ('300', 'lighter') else 300)
                upper = props.get('text-transform', '').strip() == 'uppercase'
                decision = classify(size, weight, upper, props.get('letter-spacing'), underline, sel)
                before = f"{props.get('font-weight','–')} {props['font-size']}/{props.get('line-height','–')} ls {props.get('letter-spacing','–')}{' UPPER' if upper else ''}"
                log.append({'sel': sel.strip(), 'kind': 'type', 'from': before, 'to': decision})
        if decision == 'drop':
            dropped = ', '.join(f'{p}:{props[p]}' for p in typo)
            log.append({'sel': sel.strip(), 'kind': 'type-override', 'from': dropped, 'to': 'removed (inherits its DS style)'})

    out = []
    inserted = False
    for p, v, lead in parsed:
        if p is None:
            out.append(lead); continue
        if decision == 'drop' and ((p == 'font-size' and v.strip() in ('0', '0px')) or (p == 'line-height' and v.strip() == '1')):
            out.append(f'{lead}{p}:{v}'); continue
        if decision and p in TYPO_PROPS:
            if decision != 'drop' and not inserted:
                out.append(lead + ';'.join(style_decls(decision))); inserted = True
            continue
        if decision and decision != 'drop' and decision != 'Link' and p in ('text-decoration', 'text-decoration-line') and underline:
            pass
        nv = v
        if p in ('padding', 'margin', 'gap', 'row-gap', 'column-gap', 'grid-gap') or p.startswith(('padding-', 'margin-')) or p in ('padding-inline', 'padding-block', 'margin-inline', 'margin-block'):
            nv = snap_spacing(nv, log, sel.strip(), p)
        if p == 'box-shadow':
            nv = map_shadow(nv, sel.strip(), log)
        elif COLOUR_RE.search(nv) and p not in ('font-family',):
            nv = map_colours(nv, p, sel.strip(), log)
        # non-DS spacing / control tokens
        nv = re.sub(r'var\(--space-28\)', 'var(--space-24)', nv)
        nv = re.sub(r'var\(--control-32\)', 'var(--control-30)', nv)
        out.append(f'{lead}{p}:{nv}')
    return ';'.join(x.strip('\n') if False else x for x in out)

def walk(css, log, media=False, skip_sel=None):
    """Recursive-descent over a stylesheet: rules, @media / @supports (recursed),
    @keyframes / @font-face (left alone)."""
    i, n, out = 0, len(css), []
    while i < n:
        # copy comments / whitespace through
        m = re.match(r'\s+|/\*.*?\*/', css[i:], re.S)
        if m:
            out.append(m.group(0)); i += m.end(); continue
        j = css.find('{', i)
        if j < 0:
            out.append(css[i:]); break
        head = css[i:j]
        # find the matching brace
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{': depth += 1
            elif css[k] == '}': depth -= 1
            k += 1
        inner = css[j + 1:k - 1]
        h = head.strip()
        if h.startswith(('@media', '@supports', '@container')):
            out.append(head + '{' + walk(inner, log, True, skip_sel) + '}')
        elif h.startswith(('@keyframes', '@-webkit-keyframes', '@font-face', '@page')):
            out.append(head + '{' + inner + '}')
        else:
            skip = bool(skip_sel and re.search(skip_sel, h))
            out.append(head + '{' + process_block(h, inner, media, log, skip) + '}')
        i = k
    return ''.join(out)

# ---------------------------------------------------------------- files
LINK_MAP = [('./cart-original.html', './cart.html'), ('./checkout-original.html', './checkout.html'),
            ('./lib/shop-original.css', './lib/shop.css')]

def relink(s):
    for a, b in LINK_MAP: s = s.replace(a, b)
    return s

# left as authored: the prototype switcher, and the site header — which already IS the DS
# Header component (101:186), 36/30 spacing included, and must match the PLP's pixel for pixel
SKIP = r'^\.dash|\.dash\b|^header|^\.nav\b|^\.nav__|^\.logo|^\.search|^\.icon|^\.cart-count|^\.burger|^\.nav__icons'

# page-specific additions to the DS build, appended after the page's own rules
EXTRA = {
    'checkout': """
/* ds-constrained: the step number is Title/6 in its 22px circle. Alliance's figures sit
   ~1px above the line box's centre, so 2px of top padding moves them down 1; the indent
   gives back the trailing .04em of tracking so the digit centres on its own ink
   (measured at 4x, Amelie 2026-09-24). */
.steps__no{padding-top:2px;text-indent:.04em}
""",
}

def build_html(name):
    src = (V2 / f'{name}-original.html').read_text()
    log = []
    def rep(m):
        return m.group(1) + walk(m.group(2), log, skip_sel=SKIP) + EXTRA.get(name, '') + m.group(3)
    html = re.sub(r'(<style>)(.*?)(</style>)', rep, src, flags=re.S)
    html = relink(html)
    # the tokens have to win over the page's own :root, so they go after its <style>
    html = html.replace('</style>', '</style>\n<link rel="stylesheet" href="./lib/ds-tokens.css" />', 1)
    html = html.replace(' · pre-DS original</title>', '</title>', 1)
    html = '<!-- GENERATED by ds-constrained/build.py from ' + name + '-original.html — do not edit -->\n' + html
    (V2 / f'{name}.html').write_text(html)
    return log

def build_shop():
    log = []
    css = (V2 / 'lib/shop-original.css').read_text()
    # the mini cart is also injected into the PLP and PDP, which do not load ds-tokens.css —
    # so the tokens ride inside the stylesheet itself
    tokens = (V2 / 'lib/ds-tokens.css').read_text()
    head = '/* GENERATED by ds-constrained/build.py from shop-original.css — do not edit */\n'
    (V2 / 'lib/shop.css').write_text(head + tokens + '\n' + walk(css, log))
    return log

def tokens_css():
    L = ['/* Design System Triumph (C4UzkYsFCfJGxKr7BaakLO) as CSS — generated by ds-constrained/build.py.',
         '   Text sizes follow the Breakpoint collection: LG/XL/XXL ≥992, MD 768–991, SM 576–767, XS <576. */',
         ':root{']
    for r, v in ROLES.items(): L.append(f'  --ds-{r.replace("/", "-")}:{v};')
    for n, v in ELEVATION.items(): L.append(f'  --ds-{slug(n)}:{v};')
    for s in SPACING[1:]: L.append(f'  --space-{s}:{s}px;')
    for c in CONTROLS: L.append(f'  --control-{c}:{c}px;')
    for n, (_, _, _, fs, lh) in STYLES.items(): L.append(f'  --ds-{slug(n)}-fs:{fs}px; --ds-{slug(n)}-lh:{lh}px;')
    L.append('}')
    md = {'Title/3': (14, 20), 'Title/4': (12, 16), 'Title/5': (11, 14), 'Body/L': (14, 20), 'Body/M': (12, 16),
          'Body/S': (11, 14), 'Label/M': (11, 14), 'Label/Emphasis': (12, 16), 'Link': (12, 14),
          'Price/L': (12, 14), 'Price/M': (11, 12), 'Price/Note': (11, 12)}
    sm = {'Display': (24, 30), 'Title/1': (20, 24), 'Title/2': (16, 20)}
    L.append('@media (max-width:991px){:root{')
    for n, (fs, lh) in md.items(): L.append(f'  --ds-{slug(n)}-fs:{fs}px; --ds-{slug(n)}-lh:{lh}px;')
    L.append('}}')
    L.append('@media (max-width:767px){:root{')
    for n, (fs, lh) in sm.items(): L.append(f'  --ds-{slug(n)}-fs:{fs}px; --ds-{slug(n)}-lh:{lh}px;')
    L.append('}}')
    (V2 / 'lib/ds-tokens.css').write_text('\n'.join(L) + '\n')

if __name__ == '__main__':
    tokens_css()
    logs = {'Bag (cart.html)': build_html('cart'), 'Checkout (checkout.html)': build_html('checkout'),
            'Mini cart (lib/shop.css)': build_shop()}
    (OUT / 'changes.json').write_text(json.dumps(logs, indent=1))
    for k, v in logs.items():
        kinds = {}
        for e in v: kinds[e['kind']] = kinds.get(e['kind'], 0) + 1
        print(k, kinds)
