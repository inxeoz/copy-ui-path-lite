// GENERATED FILE — do not edit by hand.
//   backend : src/picker.core.js
//   ui      : templates/picker_ui.j2 + themes/carbon.json
//   rebuild : make ui [THEME=<name>]
(function () {
  console.log('[copy-ui-path-lite] picker.js loaded');
  if (document.getElementById('ctp-picker-root')) {
    console.log('[copy-ui-path-lite] picker already active, skipping');
    return;
  }

  // Inject shake animation + close animation (keep in sync with theme tokens)
  var injectedStyle = document.createElement('style');
  injectedStyle.textContent = '@keyframes ctp-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}@keyframes ctp-fadeOut{from{opacity:1}to{opacity:0;transform:translateY(-8px)}}';
  document.head.appendChild(injectedStyle);

  // ── Path building ──────────────────────────────────────────────────

  var PART = {
    URL:      'url',
    SEP:      'sep',
    PATH:     'path',
    PATH_TID: 'path_tid',
    SEP_PATH: 'sep_path',
    BR_OPEN:  'br_open',
    CORNER:   'corner',
    Z_INDEX:  'zindex',
    BR_CLOSE: 'br_close',
    CTX_OPEN: 'ctx_open',
    CTX_KEY:  'ctx_key',
    CTX_STR:  'ctx_str',
    CTX_FLAG: 'ctx_flag',
    CTX_CLOSE:'ctx_close',
    SWATCH:   'swatch',
  };

  function PathBuilder() {
    this.list = [];
  }
  PathBuilder.prototype.add = function(type, value) {
    this.list.push({ type: type, value: value });
    return this;
  };
  PathBuilder.prototype.toText = function() {
    return this.list.filter(function(s){ return s.type !== PART.SWATCH; }).map(function(s) { return s.value; }).join('');
  };
  PathBuilder.prototype.appendTo = function(parent) {
    for (var i = 0; i < this.list.length; i++) {
      var s = this.list[i];
      if(s.type === PART.SWATCH){
        var sw = document.createElement('span');
        sw.className = 'p-swatch';
        sw.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:middle;margin:0 3px 0 4px;border:1px solid rgba(0,0,0,0.15);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.6);background:' + s.value + ';';
        sw.title = s.value;
        parent.appendChild(sw);
        continue;
      }
      var span = document.createElement('span');
      span.className = 'p-' + s.type;
      span.textContent = s.value;
      parent.appendChild(span);
    }
  };

  function siblingIndex(el) {
    const p = el.parentElement;
    if (!p) return 1;
    const siblings = Array.from(p.children).filter(function (c) { return c.tagName === el.tagName; });
    return siblings.indexOf(el) + 1;
  }

  function testContext(el) {
    const ctx = el.closest('[data-test-context]');
    return ctx ? ctx.getAttribute('data-test-context') : '';
  }

  function shouldSkip(el) {
    return el.hasAttribute('data-testignore');
  }

  var TEST_ATTRS = [
    'data-testid', 'data-test', 'data-cy', 'data-qa',
    'data-automation-id', 'data-automation', 'data-e2e',
    'data-test-id', 'data-component', 'data-element'
  ];

  function getTestId(el) {
    for (var i = 0; i < TEST_ATTRS.length; i++) {
      var val = el.getAttribute(TEST_ATTRS[i]);
      if (val) return { name: TEST_ATTRS[i], value: val };
    }
    return null;
  }

  function getSelectedUniqueId(el) {
    if (!el) return null;
    var tid = getTestId(el);
    if (tid && tid.value) return tid.value;
    if (el.id) return el.id;
    return null;
  }

  function getContext(el) {
    if (getTestId(el)) return '';
    if (el.id) return '(#' + el.id + ')';
    if (el.className && typeof el.className === 'string' && el.className.trim()) {
      return '(' + el.className.trim().split(/\s+/)[0] + ')';
    }
    return '';
  }

  function segPlaywright(el) {
    var tid = getTestId(el);
    if (tid) {
      const label = el.getAttribute('data-testlabel');
      return label ? tid.value + '[data-testlabel="' + label + '"]' : tid.value;
    }
    var ctx = getContext(el);
    return el.tagName.toLowerCase() + '[' + siblingIndex(el) + ']' + ctx;
  }

  function segXPath(el) {
    var tid = getTestId(el);
    if (tid) return tid.value;
    var ctx = getContext(el);
    return el.tagName.toLowerCase() + '[' + siblingIndex(el) + ']' + ctx;
  }

  function walkUp(el, segmentFn) {
    var segs = [];
    var cur = el;
    var depth = 0;
    while (cur && cur !== document.documentElement && cur !== document.body && depth < 25) {
      if (shouldSkip(cur)) { cur = cur.parentElement; depth++; continue; }
      var parent = cur.parentElement;
      if (!parent) {
        var root = cur.getRootNode ? cur.getRootNode() : null;
        if (root instanceof ShadowRoot && root.host && cur !== root.host) {
          segs.unshift(segmentFn(cur));
          segs.unshift('{shadow}');
          cur = root.host;
          depth += 2;
          continue;
        }
      }
      segs.unshift(segmentFn(cur));
      cur = cur.parentElement;
      depth++;
    }
    if (depth >= 25) segs.unshift('...');
    return segs;
  }

  function savePathFromElement(el) {
    var path = [];
    var cur = el;
    var depth = 0;
    while (cur && cur !== document.documentElement && cur !== document.body && depth < 25) {
      if (shouldSkip(cur)) { cur = cur.parentElement; depth++; continue; }
      var parent = cur.parentElement;
      if (!parent) {
        var root = cur.getRootNode ? cur.getRootNode() : null;
        if (root instanceof ShadowRoot && root.host && cur !== root.host) {
          path.unshift(cur);
          cur = root.host;
          depth += 2;
          continue;
        }
      }
      path.unshift(cur);
      cur = cur.parentElement;
      depth++;
    }
    return path;
  }

  function savePath(el) {
    savedPath = savePathFromElement(el);
    pathIndex = 0;
    updateNavButtons();
  }

  function stepBack() {
    if (!currentEl || savedPath.length === 0) return;
    var idx = savedPath.indexOf(currentEl);
    if (idx < 0 || idx >= savedPath.length - 1) return;
    var parentEl = savedPath[idx + 1];
    if (!parentEl) return;
    isNavigating = true;
    updateUI(parentEl);
    updateNavButtons();
    isNavigating = false;
  }

  function stepNext() {
    if (!currentEl || savedPath.length === 0) return;
    var idx = savedPath.indexOf(currentEl);
    if (idx <= 0) return;
    var childEl = savedPath[idx - 1];
    if (!childEl) return;
    isNavigating = true;
    updateUI(childEl);
    updateNavButtons();
    isNavigating = false;
  }

  function navigateToPathElement() {
    if (pathIndex < 0 || pathIndex >= savedPath.length) return;
    var el = savedPath[pathIndex];
    if (!el || el === currentEl) return;
    isNavigating = true;
    updateUI(el);
    updateNavButtons();
    isNavigating = false;
  }

  function updateNavButtons() {
    if (!currentEl || savedPath.length === 0) {
      stepBackBtn.disabled = true;
      stepNextBtn.disabled = true;
      return;
    }
    var idx = savedPath.indexOf(currentEl);
    stepBackBtn.disabled = idx < 0 || idx >= savedPath.length - 1;
    stepNextBtn.disabled = idx <= 0;
  }

  function buildPlaywrightPath(el) {
    var ctx = testContext(el);
    var p = walkUp(el, segPlaywright).join(' > ');
    return ctx ? ctx + ' | ' + p : p;
  }

  function buildXPath(el) {
    return '/' + walkUp(el, segXPath).join('/');
  }

  function segCSS(el) {
    var tid = getTestId(el);
    if (tid) return tid.value;
    if (el.id) return '#' + CSS.escape(el.id);
    var tag = el.tagName.toLowerCase();
    var classes = [];
    if (el.className && typeof el.className === 'string') {
      classes = el.className.trim().split(/\s+/).filter(Boolean).map(function(c) { return '.' + CSS.escape(c); });
    }
    if (classes.length) return tag + classes.join('') + ':nth-child(' + siblingIndex(el) + ')';
    return tag + ':nth-child(' + siblingIndex(el) + ')';
  }

  function buildCSSSelector(el) {
    return walkUp(el, segCSS).join(' > ');
  }

  function formatPath(el) {
    var tid = getTestId(el);
    if (tid) {
      console.log('[copy-ui-path-lite] element has ' + tid.name + ':', tid.value, '-> using Playwright path');
      return buildPlaywrightPath(el);
    }
    console.log('[copy-ui-path-lite] no test id found -> using XPath');
    return buildXPath(el);
  }

  function rgbToHex(str) {
    var m = str.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/);
    if (!m) return null;
    if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
    if (m[4] !== undefined && parseFloat(m[4]) !== 1) return str;
    var r = +m[1], g = +m[2], b = +m[3];
    return '#' + [r, g, b].map(function(x){ return x.toString(16).padStart(2,'0'); }).join('');
  }
  var COLOR_PROPS = ['color','background-color','border-color','border-top-color','border-right-color','border-bottom-color','border-left-color','outline-color','text-decoration-color','column-rule-color','caret-color','fill','stroke','flood-color','lighting-color','stop-color','accent-color'];
  function extractColor(val){
    if(!val) return null;
    var m = val.match(/rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}\b/);
    if(m) return m[0];
    var named = val.match(/\b(aqua|black|blue|fuchsia|gray|grey|green|lime|maroon|navy|olive|purple|red|silver|teal|white|yellow|orange|aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|blanchedalmond|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dodgerblue|firebrick|floralwhite|forestgreen|gainsboro|ghostwhite|gold|goldenrod|greenyellow|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightsteelblue|lightyellow|limegreen|linen|magenta|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|oldlace|olivedrab|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|skyblue|slateblue|slategray|snow|springgreen|steelblue|tan|thistle|tomato|turquoise|violet|wheat|whitesmoke|yellowgreen|currentColor)\b/i);
    if(named) return named[0];
    return null;
  }
  function effectiveBg(el){
    var cur=el;
    while(cur && cur!==document.documentElement){
      try{
        var cs=window.getComputedStyle(cur);
        var bg=cs.backgroundColor;
        if(bg && bg!=='rgba(0, 0, 0, 0)' && bg!=='transparent' && bg!=='none') return bg;
      }catch(e){}
      cur=cur.parentElement;
    }
    return null;
  }
  function buildContextParts(el) {
    var segs = [];
    var text = (el.textContent || '').trim().replace(/\s+/g, ' ');
    if (text) {
      text = text.length > 40 ? text.slice(0, 37) + '...' : text;
      segs.push({ type: PART.CTX_KEY, value: 'text' });
      segs.push({ type: PART.CTX_STR, value: '="' + text + '"' });
    }
    var role = el.getAttribute('role');
    if (role) {
      segs.push({ type: PART.CTX_KEY, value: ' role' });
      segs.push({ type: PART.CTX_STR, value: '="' + role + '"' });
    }
    if (el.disabled) segs.push({ type: PART.CTX_FLAG, value: ' disabled' });
    if (el.checked)  segs.push({ type: PART.CTX_FLAG, value: ' checked' });
    if (el.selected) segs.push({ type: PART.CTX_FLAG, value: ' selected' });
    var ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) {
      segs.push({ type: PART.CTX_KEY, value: ' aria-label' });
      segs.push({ type: PART.CTX_STR, value: '="' + ariaLabel + '"' });
    }
    var tag = el.tagName.toLowerCase();
    if (tag === 'a') {
      var href = el.getAttribute('href');
      if (href) {
        href = href.length > 60 ? href.slice(0, 57) + '...' : href;
        segs.push({ type: PART.CTX_KEY, value: ' href' });
        segs.push({ type: PART.CTX_STR, value: '="' + href + '"' });
      }
    }
    if (tag === 'img') {
      var alt = el.getAttribute('alt');
      if (alt) {
        segs.push({ type: PART.CTX_KEY, value: ' alt' });
        segs.push({ type: PART.CTX_STR, value: '="' + alt + '"' });
      }
    }
    if (el.type) {
      segs.push({ type: PART.CTX_KEY, value: ' type' });
      segs.push({ type: PART.CTX_STR, value: '="' + el.type + '"' });
    }
    var name = el.getAttribute('name');
    if (name) {
      segs.push({ type: PART.CTX_KEY, value: ' name' });
      segs.push({ type: PART.CTX_STR, value: '="' + name + '"' });
    }
    var placeholder = el.getAttribute('placeholder');
    if (placeholder) {
      segs.push({ type: PART.CTX_KEY, value: ' placeholder' });
      segs.push({ type: PART.CTX_STR, value: '="' + placeholder + '"' });
    }
    var r = el.getBoundingClientRect();
    var sx = r.left + window.scrollX;
    var sy = r.top + window.scrollY;
    if (sx !== 0 || sy !== 0) {
      segs.push({ type: PART.CTX_KEY, value: ' scroll' });
      segs.push({ type: PART.CTX_STR, value: '="' + Math.round(sx) + ',' + Math.round(sy) + '"' });
    }
    segs.push({ type: PART.CTX_KEY, value: ' area' });
    segs.push({ type: PART.CTX_STR, value: '="' + Math.round(r.width) + 'x' + Math.round(r.height) + '"' });
    try{
      var _z = window.getComputedStyle(el).zIndex;
      if(_z && _z !== 'auto'){
        var _cfgZ = (typeof cfgProps !== 'undefined' && cfgProps && cfgProps.length) ? cfgProps : (function(){ try{ var _r=localStorage.getItem('ctp-lite-computed-props'); if(_r){ var _a=JSON.parse(_r); if(Array.isArray(_a)) return _a; } }catch(e){} return ['color','background-color','background-image','z-index']; })();
        if(_cfgZ.indexOf('z-index') !== -1){ segs.push({ type: PART.CTX_KEY, value: ' z-index' }); segs.push({ type: PART.CTX_STR, value: '="' + _z + '"' }); }
      }
    }catch(e){}
    // computed styles — only if config chose props (default: original, no extra)
    // swatch right beside each color/bg/background-image inside computed
    try {
      var cfg = (typeof cfgProps !== 'undefined' && cfgProps) ? cfgProps : [];
      if(!cfg || !cfg.length) { try{ var _r=localStorage.getItem('ctp-lite-computed-props'); if(_r) cfg=JSON.parse(_r); }catch(e){} }
      if(!cfg || !cfg.length) { cfg = ['color','background-color','background-image']; }
      else {
        var cs = window.getComputedStyle(el);
        segs.push({ type: PART.CTX_KEY, value: ', computed' });
        segs.push({ type: PART.CTX_STR, value: '="' });
        var first = true;
        for (var j = 0; j < cfg.length; j++) {
          var prop = cfg[j];
          if(prop === 'z-index') continue;
          var val = cs.getPropertyValue(prop);
          if (!val || val==='none') continue;
          if (!first) segs.push({ type: PART.CTX_STR, value: '; ' });
          first = false;
          // any prop that visibly shows a color -> swatch right beside it
          // handle hex for plain color props
          if(prop==='color' || prop==='background-color'){
            var raw=val; var hex= rgbToHex(raw) || raw; if(hex==='null' || hex==null) hex=raw;
            segs.push({ type: PART.CTX_STR, value: prop + ': ' + hex });
            if(raw && raw!=='rgba(0, 0, 0, 0)' && raw!=='transparent' && raw!=='none'){
              var col = extractColor(raw) || raw;
              segs.push({ type: PART.SWATCH, value: col });
            } else if(prop==='background-color' && (raw==='transparent' || raw==='rgba(0, 0, 0, 0)')){
              var eff=effectiveBg(el);
              if(eff) segs.push({ type: PART.SWATCH, value: eff });
            }
            continue;
          }
          if(COLOR_PROPS.indexOf(prop)!==-1){
            var cRaw=val; var c= rgbToHex(cRaw) || cRaw;
            if(c==='null' || c==null) c=cRaw;
            segs.push({ type: PART.CTX_STR, value: prop + ': ' + c });
            var col3 = extractColor(cRaw) || cRaw;
            if(col3 && col3!=='rgba(0, 0, 0, 0)' && col3!=='transparent' && col3!=='none') segs.push({ type: PART.SWATCH, value: col3 });
            continue;
          }
          // generic: background-image, gradients, shadows, borders, etc.
          segs.push({ type: PART.CTX_STR, value: prop + ': ' + val });
          if(prop==='background-image'){
            if(val && val!=='none') segs.push({ type: PART.SWATCH, value: val });
          } else {
            var col4 = extractColor(val);
            if(col4) segs.push({ type: PART.SWATCH, value: col4 });
          }
          continue;
          segs.push({ type: PART.CTX_STR, value: prop + ': ' + val });
        }
        // close quote - if nothing was added, pop opening
        if(first){
          // no valid props, remove the opening we pushed
          segs.pop(); segs.pop();
        } else {
          var last = segs[segs.length-1];
          // ensure we close the string
          segs.push({ type: PART.CTX_STR, value: '"' });
          // escape quotes inside: already handled by not using " in values, but ensure
          // replace stray " in the computed parts is done via the pushes (values contain no ")
        }
      }
    } catch(e) {}
    return segs;
  }

  function splitPathFull(selectorPath, el) {
    var isXPath = selectorPath.charAt(0) === '/';
    var sep = isXPath ? '/' : ' > ';
    var raw = selectorPath.split(sep);
    var result = [];
    var lastHasTid = !!getTestId(el);
    var start = (isXPath && raw[0] === '') ? 1 : 0;
    if (isXPath && raw[0] === '') result.push({ type: PART.PATH, value: '' });
    for (var i = start; i < raw.length; i++) {
      if (i > start) result.push({ type: PART.SEP_PATH, value: sep });
      result.push({ type: (i === raw.length - 1 && lastHasTid) ? PART.PATH_TID : PART.PATH, value: raw[i] });
    }
    return result;
  }

  function buildPathData(el, selectorPath, zVal) {
    var pb = new PathBuilder();
    var rect = el.getBoundingClientRect();

    pb.add(PART.URL, location.href);
    pb.add(PART.SEP, ' | ');
    splitPathFull(selectorPath, el).forEach(function(s) { pb.add(s.type, s.value); });

    pb.add(PART.BR_OPEN, ' [');
    pb.add(PART.CORNER, 'tl=[' + Math.round(rect.left) + ',' + Math.round(rect.top) + '], tr=[' + Math.round(rect.right) + ',' + Math.round(rect.top) + '], bl=[' + Math.round(rect.left) + ',' + Math.round(rect.bottom) + '], br=[' + Math.round(rect.right) + ',' + Math.round(rect.bottom) + ']');
    if (zVal) pb.add(PART.Z_INDEX, ' z-index=' + zVal);
    pb.add(PART.BR_CLOSE, ']');

    var ctx = buildContextParts(el);
    if (ctx.length) {
      pb.add(PART.CTX_OPEN, ' [');
      ctx.forEach(function(p) { pb.add(p.type, p.value); });
      pb.add(PART.CTX_CLOSE, ']');
    }

    return pb;
  }

  function getSelectorPath(el, mode) {
    if (mode === 'xpath') return buildXPath(el);
    if (mode === 'pw') return buildPlaywrightPath(el);
    if (mode === 'css') return buildCSSSelector(el);
    return formatPath(el);
  }

  // The preview shows exactly the selector that will be copied for the current mode.
  function getPreviewPath(el, mode) {
    return getSelectorPath(el, mode);
  }

  function calcTestidPercent(el) {
    var total = 0;
    var withId = 0;
    var cur = el;
    while (cur && cur !== document.documentElement && cur !== document.body) {
      if (shouldSkip(cur)) { cur = cur.parentElement; continue; }
      total++;
      if (getTestId(cur) || cur.id) withId++;
      cur = cur.parentElement;
    }
    if (total === 0) return 0;
    return Math.round((withId / total) * 100);
  }

  // ── Shadow DOM element detection ───────────────────────────────────

  function elFromPoint(x, y) {
    host.style.setProperty('display', 'none', 'important');
    hlEl.style.setProperty('display', 'none', 'important');
    // Badges live in document.body (above the overlay) with pointer-events:none,
    // but elementFromPoint can still hit them — hide so clicks resolve to the page el.
    var hiddenBadges = [];
    for (var bi = 0; bi < collected.length; bi++) {
      var bEl = collected[bi].badgeEl;
      if (bEl && bEl.style.display !== 'none') { hiddenBadges.push(bEl); bEl.style.display = 'none'; }
    }
    var el = document.elementFromPoint(x, y);
    host.style.removeProperty('display');
    if (currentEl) hlEl.style.setProperty('display', 'block', 'important');
    for (var ri = 0; ri < hiddenBadges.length; ri++) hiddenBadges[ri].style.display = '';
    // Never pick our own badge / toast chrome
    if (el && (el.id === 'ctp-lite-toast' || (el.style && el.style.zIndex === '2147483647' && el.parentElement === document.body && el !== hlEl))) {
      // badge divs carry only a numeric label; fall through to element below via coords offset
      // (badges are pointer-events:none so this is rare, but guard anyway)
    }
    return el;
  }

  // ── Clipboard ──────────────────────────────────────────────────────

  function copyToClipboard(text) {
    return new Promise(function (resolve, reject) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(resolve).catch(function () {
          fallbackCopy(text, resolve, reject);
        });
      } else {
        fallbackCopy(text, resolve, reject);
      }
    });
  }

  function fallbackCopy(text, resolve, reject) {
    if (!document.body) { reject(new Error('no body')); return; }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); resolve(); }
    catch (e) { reject(e); }
    finally { document.body.removeChild(ta); }
  }

  // ── Toast ──────────────────────────────────────────────────────────

  function showToast(msg, isError) {
    if (!document.body) return;
    var existing = document.getElementById('ctp-lite-toast');
    if (existing) existing.remove();
    var d = document.createElement('div');
    d.id = 'ctp-lite-toast';
    d.textContent = msg;
    var bg = isError ? '#dc2626' : '#22c55e';
    d.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;background:' + bg + ';color:#fff;font:13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;padding:10px 18px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,0.3);transition:opacity 0.4s;animation:ctp-shake 0.4s ease;';
    document.body.appendChild(d);
    setTimeout(function () { d.style.opacity = '0'; }, 2200);
    setTimeout(function () { d.remove(); }, 2600);
  }

  // ── Hide picker overlay ────────────────────────────────────────────

  function hidePicker() {
    host.style.display = 'none';
    hlEl.style.display = 'none';
    hideCornerLabels();
    centerLabel.style.display = 'none';
  }

  // ── UI ─────────────────────────────────────────────────────────────

  var host = document.createElement('div');
  host.id = 'ctp-picker-root';
  Object.assign(host.style, {
    position: 'fixed', top: '0', left: '0',
    width: '100%', height: '100%',
    zIndex: '2147483647', pointerEvents: 'none'
  });

  var shadow = host.attachShadow({ mode: 'closed' });
  var tpl = document.createElement('template');
  // ── UI markup ──────────────────────────────────────────────────────
  // Generated from templates/picker_ui.j2 + themes/<name>.json.
  // Edit the template/theme and run `make ui` — never edit this line by hand.
  tpl.innerHTML = /*__CTP_UI__*/"<style>\n*,*::before,*::after{box-sizing:border-box}\n#overlay{position:fixed;top:0;left:0;width:100vw;height:100vh;cursor:crosshair;pointer-events:auto}\n#dialog{position:fixed;bottom:20px;right:20px;width:470px;min-width:320px;max-width:560px;background:#1f1f23;border:1px solid #2e2e33;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.6);overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;color:#f5f5f5;pointer-events:auto;z-index:1}\n#dialog.closing{animation:ctp-fadeOut .25s ease forwards}\n#dialog-header{display:flex;align-items:center;gap:8px;padding:9px 12px;background:#27272a;color:#fdba74;font-weight:700;font-size:13px;cursor:move;user-select:none;white-space:nowrap}\n#el-info{font-size:11px;font-weight:400;opacity:.75;overflow:hidden;text-overflow:ellipsis;flex:1;text-align:right;white-space:nowrap;color:#fdba74}\n#multiBtn{margin-left:2px;padding:2px 11px;border:1px solid #f97316;border-radius:999px;background:transparent;color:#f97316;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;font-family:inherit}\n#multiBtn:hover{background:#f9731622}\n#multiBtn.active{background:#f97316;border-color:#f97316;color:#111111}\n#quitBtn{background:none;border:none;color:#fdba74;font-size:20px;cursor:pointer;padding:0 4px;line-height:1;opacity:.7;flex-shrink:0}\n#quitBtn:hover{opacity:1}\n#dialog-body{display:flex;align-items:stretch;min-height:220px}\n#pane-main{flex:1;min-width:0;display:flex;flex-direction:column}\n#path-display{padding:10px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;color:#f5f5f5;background:#18181b;border-bottom:1px solid #2e2e33;word-break:break-all;line-height:1.5;max-height:104px;overflow-y:auto;white-space:pre-wrap;min-height:38px}\n#queue-list{display:none;overflow-y:auto;max-height:260px;padding:4px 0 6px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;flex:1}\n#queue-list.has-items{display:block}\n.q-row{display:flex;align-items:center;gap:7px;padding:5px 8px;margin:4px 8px;border-radius:6px;background:#232327;border:1px solid #34343a}\n.q-row:hover{border-color:#f97316}\n.q-num{font-weight:800;color:#111111;background:#f97316;border-radius:4px;padding:0 6px;min-width:20px;text-align:center;flex-shrink:0}\n.q-path{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f5f5f5}\n.q-remove{border:none;background:none;color:#f87171;font-size:14px;cursor:pointer;padding:0 4px;line-height:1;flex-shrink:0}\n.q-remove:hover{font-weight:700}\n#pane-side{width:150px;flex-shrink:0;padding:9px;display:flex;flex-direction:column;gap:7px;border-left:1px solid #2e2e33;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}\n#multi-actions{display:none;flex-direction:column;gap:7px}\n#multi-actions.open{display:flex}\n#queue-count{font-weight:700;color:#f97316}\n#sep-select,#format-select{font-family:inherit;font-size:11px;padding:5px 7px;border:1px solid #3f3f46;border-radius:6px;background:#18181b;color:#f5f5f5;cursor:pointer;outline:none;width:100%}\n#copyAllBtn{padding:7px 10px;border:none;border-radius:7px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;background:#f97316;color:#111111;width:100%}\n#copyAllBtn:hover{background:#fb923c}\n#copyAllBtn:disabled{opacity:.45;cursor:not-allowed}\n#clearBtn{padding:6px 10px;border:1px solid #3f3f46;border-radius:7px;font-family:inherit;font-size:12px;cursor:pointer;background:#232327;color:#f5f5f5;width:100%}\n#clearBtn:hover{border-color:#f97316}\n.close-toggle{display:flex;align-items:center;gap:5px;font-size:11px;color:#a3a3a3;cursor:pointer;white-space:nowrap}\n.side-div{border-top:1px solid #2e2e33;margin:1px 0}\n.nav-btn{padding:6px 10px;border:1px solid #3f3f46;border-radius:7px;background:#232327;color:#f5f5f5;font-family:inherit;font-size:12px;cursor:pointer;width:100%;transition:border-color .15s}\n.nav-btn:hover{border-color:#f97316}\n.nav-btn:disabled{opacity:.4;cursor:not-allowed}\n#copyIdBtn{padding:6px 10px;border:1px solid #3f3f46;border-radius:7px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;background:#232327;color:#f5f5f5;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n#copyIdBtn:hover{border-color:#f97316}\n#copyIdBtn:disabled{opacity:.4;cursor:not-allowed}\n#copyIdBtn.copied{background:#22c55e;color:#111111;border-color:#22c55e}\n.primary{padding:8px 10px;border:none;border-radius:7px;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;background:#f97316;color:#111111;width:100%;transition:background .15s}\n.primary:hover{background:#fb923c}\n.primary:active{background:#f97316}\n.primary.copied{background:#22c55e;color:#fff}\n#overlay.frozen{cursor:default}\n#dialog.frozen{border-color:#22c55e}\n#config-panel{display:none;padding:10px 12px;background:#18181b;border-top:1px solid #2e2e33;max-height:250px;overflow-y:auto;color:#f5f5f5;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}\n.preset-btn{font-size:11px;padding:3px 9px;border:1px solid #3f3f46;border-radius:999px;background:#232327;color:#f5f5f5;cursor:pointer;font-family:inherit}\n.preset-btn:hover{border-color:#f97316}\n#config-checks label{color:#f5f5f5;font-size:12px}\n#config-checks input{accent-color:#f97316}\n#freeze-hint{padding:6px 12px;font-size:11px;color:#a3a3a3;text-align:center;border-top:1px solid #2e2e33;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}\n.p-url{color:#7dd3fc}\n.p-sep{color:#a3a3a3}\n.p-path{color:#f5f5f5}\n.p-corner{color:#fbbf24}\n.p-zindex{color:#c4b5fd}\n.p-ctx_key{color:#86efac}\n.p-ctx_str{color:#6ee7b7}\n.p-ctx_flag{color:#fca5a5}\n.p-path_tid{color:#fdba74}\n.p-sep_path{color:#a3a3a3}\n.p-br_open,.p-br_close{color:#fbbf24}\n.p-ctx_open,.p-ctx_close{color:#86efac}\n</style><svg id=\"overlay\" xmlns=\"http://www.w3.org/2000/svg\"><path id=\"ocean\" fill=\"rgba(0,0,0,0.55)\" fill-rule=\"evenodd\" d=\"\"/><path id=\"island\" fill=\"rgba(249,115,22,0.18)\" stroke=\"#f97316\" stroke-width=\"2\" d=\"\"/></svg><div id=\"dialog\"><div id=\"dialog-header\"><span>$ picker</span><span id=\"el-info\"></span><button id=\"multiBtn\" title=\"Toggle multi-pick mode (Add +)\">[+ add]</button><button id=\"quitBtn\" title=\"Quit (Esc)\">&times;</button></div><div id=\"dialog-body\"><div id=\"pane-main\"><div id=\"path-display\">Hover over an element...</div><div id=\"queue-list\"></div></div><div id=\"pane-side\"><div id=\"multi-actions\"><span id=\"queue-count\">0 picked</span><select id=\"sep-select\" title=\"Separator style\"><option value=\"newline\">newline</option><option value=\"numbered\">numbered</option><option value=\"comma\">comma</option><option value=\"json\">JSON</option></select><button id=\"copyAllBtn\" disabled>Copy All (0)</button><button id=\"clearBtn\">Clear</button><label class=\"close-toggle\"><input type=\"checkbox\" id=\"closeAfterCopy\"> close after copy</label></div><div class=\"side-div\"></div><button id=\"stepBackBtn\" class=\"nav-btn\" title=\"Step to child\">To Child</button><button id=\"stepNextBtn\" class=\"nav-btn\" title=\"Step to parent\">To Parent</button><select id=\"format-select\"><option value=\"context\">Context</option><option value=\"xpath\">XPath</option><option value=\"css\">CSS</option><option value=\"pw\">Playwright</option></select><button id=\"configBtn\" class=\"nav-btn\" title=\"Pick computed style props\">\u2699 style</button><button id=\"copyIdBtn\" title=\"Copy only the selected element id\" disabled>Copy Selected id</button><button id=\"copyBtn\" class=\"primary\">Copy path</button></div></div><div id=\"config-panel\"><div style=\"font-weight:700;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;\">Computed props <span id=\"config-close\" style=\"cursor:pointer;font-size:18px;line-height:1;color:#a3a3a3;\">&times;</span></div><div style=\"display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;\"><button class=\"preset-btn\" data-preset=\"color\">color only</button><button class=\"preset-btn\" data-preset=\"essentials\">essentials</button><button class=\"preset-btn\" data-preset=\"typography\">typography</button><button class=\"preset-btn\" data-preset=\"box\">box</button><button class=\"preset-btn\" data-preset=\"all\">all</button><button class=\"preset-btn\" data-preset=\"clear\">clear</button></div><div id=\"config-checks\" style=\"display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:12px;margin-bottom:8px;\"></div><div style=\"font-size:11px;color:#a3a3a3;margin-bottom:4px;\">Custom (comma-separated, overrides checks if non-empty):</div><textarea id=\"config-custom\" rows=\"2\" style=\"width:100%;font:11px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:6px;border:1px solid #3f3f46;border-radius:6px;resize:vertical;background:#18181b;color:#f5f5f5;\" placeholder=\"e.g. color, background-color, font-size\"></textarea><div style=\"display:flex;justify-content:flex-end;gap:8px;margin-top:8px;\"><button id=\"config-cancel\" class=\"nav-btn\" style=\"width:auto;padding:5px 12px;\">Cancel</button><button id=\"config-save\" class=\"primary\" style=\"width:auto;padding:5px 12px;font-size:12px;\">Save</button></div><div style=\"font-size:10px;color:#71717a;margin-top:6px;\">Saved in localStorage, used for computed=\"...\"</div></div><div id=\"freeze-hint\">right-click: freeze \u2022 \u2699: computed props</div></div>";
  shadow.appendChild(tpl.content.cloneNode(true));

  document.documentElement.appendChild(host);

  var overlay = shadow.querySelector('#overlay');
  var ocean = shadow.querySelector('#ocean');
  var island = shadow.querySelector('#island');
  var dialog = shadow.querySelector('#dialog');
  var dialogHeader = shadow.querySelector('#dialog-header');
  var pathDisplay = shadow.querySelector('#path-display');
  var elInfo = shadow.querySelector('#el-info');
  var formatSelect = shadow.querySelector('#format-select');
  var copyBtn = shadow.querySelector('#copyBtn');
  var copyIdBtn = shadow.querySelector('#copyIdBtn');
  var quitBtn = shadow.querySelector('#quitBtn');
  var stepBackBtn = shadow.querySelector('#stepBackBtn');
  var stepNextBtn = shadow.querySelector('#stepNextBtn');
  var freezeHint = shadow.querySelector('#freeze-hint');
  var multiBtn = shadow.querySelector('#multiBtn');
  var queueList = shadow.querySelector('#queue-list');
  var multiActions = shadow.querySelector('#multi-actions');
  var queueCount = shadow.querySelector('#queue-count');
  var sepSelect = shadow.querySelector('#sep-select');
  var copyAllBtn = shadow.querySelector('#copyAllBtn');
  var clearBtn = shadow.querySelector('#clearBtn');
  var closeAfterCopyBox = shadow.querySelector('#closeAfterCopy');
  var formatMode = 'context';
  var frozen = false;
  // ── Multi-pick state ─────────────────────────────────────────────
  var collected = [];
  var multiMode = true;
  var SEP_KEY = 'ctp-lite-sep-style';
  var sepStyle = 'newline';
  try { var _s = localStorage.getItem(SEP_KEY); if (_s) sepStyle = _s; } catch (e) {}
  var closeAfterCopy = false;
  formatSelect.addEventListener('change', function() {
    formatMode = this.value;
    if (currentEl) renderPathDisplay(currentEl, getZ(currentEl));
    renderQueue();
  });

  // ── Computed props config (localStorage) ──────────────────────────
  var CFG_KEY = 'ctp-lite-computed-props';
  var AVAILABLE_PROPS = ['z-index','color','background-color','background-image','border-color','border-top-color','border-right-color','border-bottom-color','border-left-color','outline-color','text-decoration-color','text-emphasis-color','-webkit-text-fill-color','-webkit-text-stroke-color','column-rule-color','caret-color','fill','stroke','flood-color','lighting-color','stop-color','accent-color','scrollbar-color','box-shadow','text-shadow','filter','border','outline','border-radius','display','position','width','height','font-family','font-size','font-weight','line-height','letter-spacing','text-align','opacity','visibility','overflow','margin','padding','gap','flex','flex-direction','justify-content','align-items','grid','cursor','transform','transition','animation'];
  var PRESETS = {
    color: ['color','background-color'],
    essentials: ['color','background-color','font-size','font-family','display','width','height','border-radius','box-shadow'],
    typography: ['color','font-family','font-size','font-weight','line-height','letter-spacing','text-align'],
    box: ['display','width','height','margin','padding','border','border-radius','box-sizing'],
    all: null,
    clear: []
  };
  function loadCfg(){
    try{
      var raw = localStorage.getItem(CFG_KEY);
      if(raw){
        var arr = JSON.parse(raw);
        if(Array.isArray(arr)) return arr;
        if(typeof raw==='string' && raw.trim()) return raw.split(',').map(function(s){return s.trim()}).filter(Boolean);
      }
    }catch(e){}
    return ['color','background-color','background-image','z-index'];
  }
  function saveCfg(arr){
    try{ localStorage.setItem(CFG_KEY, JSON.stringify(arr)); }catch(e){}
  }
  var cfgProps = loadCfg();

  var configBtn = shadow.querySelector('#configBtn');
  var configPanel = shadow.querySelector('#config-panel');
  var configClose = shadow.querySelector('#config-close');
  var configCancel = shadow.querySelector('#config-cancel');
  var configSave = shadow.querySelector('#config-save');
  var configChecks = shadow.querySelector('#config-checks');
  var configCustom = shadow.querySelector('#config-custom');

  function renderChecks(){
    configChecks.innerHTML = '';
    var customVal = configCustom.value.trim();
    var active = customVal ? customVal.split(',').map(function(s){return s.trim()}).filter(Boolean) : cfgProps;
    // if preset all -> treat as all available
    var isAll = cfgProps.length===AVAILABLE_PROPS.length || (cfgProps.length===1 && cfgProps[0]==='*');
    AVAILABLE_PROPS.forEach(function(prop){
      var label = document.createElement('label');
      label.style.cssText='display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap;';
      var cb = document.createElement('input');
      cb.type='checkbox'; cb.value=prop;
      cb.checked = isAll ? true : active.indexOf(prop)!==-1;
      cb.addEventListener('change', function(){ configCustom.value=''; });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(prop));
      configChecks.appendChild(label);
    });
    if(!customVal) configCustom.placeholder = cfgProps.join(', ');
  }
  var cfgSnapshot = null;
  function openConfig(){
    cfgSnapshot = cfgProps.slice();
    configCustom.value = '';
    renderChecks();
    configPanel.style.display='block';
    freezeHint.style.display='none';
  }
  function closeConfig(){ configPanel.style.display='none'; freezeHint.style.display='block'; }
  function cancelConfig(){
    if(cfgSnapshot) { cfgProps = cfgSnapshot.slice(); try{ localStorage.setItem(CFG_KEY, JSON.stringify(cfgProps)); }catch(e){} }
    closeConfig();
    if(currentEl){ var el=currentEl; currentEl=null; updateUI(el); }
  }
  function collectProps(){
    var custom = configCustom.value.trim();
    if(custom) return custom.split(',').map(function(s){return s.trim()}).filter(Boolean);
    var out=[]; configChecks.querySelectorAll('input:checked').forEach(function(cb){ out.push(cb.value); });
    return out;
  }
  function liveUpdate(){
    var live = collectProps();
    cfgProps = live;
    try{ localStorage.setItem(CFG_KEY, JSON.stringify(cfgProps)); }catch(e){}
    if(currentEl) { var el=currentEl; currentEl=null; updateUI(el); }
  }
  if(configBtn) configBtn.addEventListener('click', function(e){ e.stopPropagation(); if(configPanel.style.display==='none' || !configPanel.style.display) openConfig(); else closeConfig(); if(currentEl) updateUI(currentEl); });
  if(configClose) configClose.addEventListener('click', cancelConfig);
  if(configCancel) configCancel.addEventListener('click', cancelConfig);
  if(configSave) configSave.addEventListener('click', function(){
    cfgProps = collectProps();
    if(cfgProps.length===AVAILABLE_PROPS.length) cfgProps = AVAILABLE_PROPS.slice();
    saveCfg(cfgProps);
    closeConfig();
    if(currentEl) { currentEl=null; updateUI(document.elementFromPoint(lastX||0, lastY||0) || document.body); }
    showToast('Saved ' + cfgProps.length + ' props');
  });
  shadow.querySelectorAll('.preset-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var p = this.getAttribute('data-preset');
      if(p==='all'){ configCustom.value=''; configChecks.querySelectorAll('input').forEach(function(cb){cb.checked=true;}); }
      else if(p==='clear'){ configCustom.value=''; configChecks.querySelectorAll('input').forEach(function(cb){cb.checked=false;}); }
      else if(PRESETS[p]){ configCustom.value=''; var set=PRESETS[p]; configChecks.querySelectorAll('input').forEach(function(cb){cb.checked=set.indexOf(cb.value)!==-1;}); }
      liveUpdate();
    });
  });
  // live reflect on change
  if(configChecks) configChecks.addEventListener('change', liveUpdate);
  if(configCustom) configCustom.addEventListener('input', liveUpdate);
  // expose for tests
  window.__ctp_cfg = { get: function(){ return cfgProps.slice(); }, set: function(a){ cfgProps=a; saveCfg(a); } };


  // Highlight overlay
  var hlEl = document.createElement('div');
  hlEl.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #4A90D9;z-index:2147483646;display:none;';
  document.body.appendChild(hlEl);

  // Corner labels
  var cornerLabels = [];
  ['tl', 'tr', 'bl', 'br'].forEach(function(name) {
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;z-index:2147483646;font:11px/1 SF Mono,Cascadia Code,Fira Code,Menlo,monospace;color:#1E3A5F;background:#FFD700;padding:2px 5px;border-radius:3px;pointer-events:none;white-space:nowrap;display:none;';
    document.body.appendChild(el);
    cornerLabels.push(el);
  });
  var cornerTl = cornerLabels[0];
  var cornerTr = cornerLabels[1];
  var cornerBl = cornerLabels[2];
  var cornerBr = cornerLabels[3];

  // Center z-index label
  var centerLabel = document.createElement('div');
  centerLabel.style.cssText = 'position:fixed;z-index:2147483646;font:12px/1 SF Mono,Cascadia Code,Fira Code,Menlo,monospace;color:#1E3A5F;background:#FFD700;padding:2px 6px;border-radius:4px;pointer-events:none;display:none;';
  document.body.appendChild(centerLabel);

  var currentEl = null;
  var currentPath = '';
  var savedPath = [];
  var pathIndex = -1;
  var isNavigating = false;
  var dragging = false;
  var dragOffsetX = 0;
  var dragOffsetY = 0;
  var rafPending = false;
  var lastX = 0;
  var lastY = 0;

  var SIZE_THRESHOLD_W = 100;
  var SIZE_THRESHOLD_H = 40;

  function updateCornerLabels(rect) {
    if (rect.width < SIZE_THRESHOLD_W || rect.height < SIZE_THRESHOLD_H) {
      hideCornerLabels();
      return;
    }
    var tlX = Math.round(rect.left);
    var tlY = Math.round(rect.top);
    var trX = Math.round(rect.right);
    var trY = Math.round(rect.top);
    var blX = Math.round(rect.left);
    var blY = Math.round(rect.bottom);
    var brX = Math.round(rect.right);
    var brY = Math.round(rect.bottom);

    cornerTl.textContent = 'tl[' + tlX + ',' + tlY + ']';
    cornerTl.style.left = Math.max(2, rect.left - 4) + 'px';
    cornerTl.style.top = Math.max(2, rect.top - 22) + 'px';
    cornerTl.style.display = 'block';

    cornerTr.textContent = 'tr[' + trX + ',' + trY + ']';
    cornerTr.style.right = Math.max(2, window.innerWidth - rect.right + 4) + 'px';
    cornerTr.style.top = Math.max(2, rect.top - 22) + 'px';
    cornerTr.style.display = 'block';

    cornerBl.textContent = 'bl[' + blX + ',' + blY + ']';
    cornerBl.style.left = Math.max(2, rect.left - 4) + 'px';
    cornerBl.style.top = (rect.bottom + 4) + 'px';
    cornerBl.style.display = 'block';

    cornerBr.textContent = 'br[' + brX + ',' + brY + ']';
    cornerBr.style.right = Math.max(2, window.innerWidth - rect.right + 4) + 'px';
    cornerBr.style.top = (rect.bottom + 4) + 'px';
    cornerBr.style.display = 'block';
  }

  function hideCornerLabels() {
    cornerTl.style.display = 'none';
    cornerTr.style.display = 'none';
    cornerBl.style.display = 'none';
    cornerBr.style.display = 'none';
  }

  function updateCenterLabel(rect, zVal) {
    if (!zVal || zVal === 'auto' || rect.width < SIZE_THRESHOLD_W || rect.height < SIZE_THRESHOLD_H) {
      centerLabel.style.display = 'none';
      return;
    }
    centerLabel.textContent = 'z: ' + zVal;
    centerLabel.style.left = (rect.left + rect.width / 2) + 'px';
    centerLabel.style.top = (rect.top + rect.height / 2 - 10) + 'px';
    centerLabel.style.display = 'block';
  }

  function getZ(el) {
    try { var z = window.getComputedStyle(el).zIndex; return z || 'auto'; } catch (e) { return 'auto'; }
  }

  // Renders the path preview for `el` in the current formatMode. Called on hover,
  // on selection change and after navigating — so switching format updates it live.
  function renderPathDisplay(el, zVal) {
    var pb = buildPathData(el, getPreviewPath(el, formatMode), zVal);
    currentPath = pb.toText();
    pathDisplay.textContent = '';
    pb.appendTo(pathDisplay);
    if (!dragging) {
      var w = Math.min(420, Math.max(280, Math.ceil(currentPath.length * 7.5) + 160));
      dialog.style.width = w + 'px';
    }
  }

  function updateUI(el) {
    if (!el || el === currentEl) return;
    currentEl = el;
    var rect = el.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var zVal = getZ(el);

    // SVG spotlight
    ocean.setAttribute('d', 'M0 0h' + vw + 'v' + vh + 'h-' + vw + 'z M' + rect.left + ' ' + rect.top + 'h' + rect.width + 'v' + rect.height + 'h-' + rect.width + 'z');
    island.setAttribute('d', 'M' + rect.left + ' ' + rect.top + 'h' + rect.width + 'v' + rect.height + 'h-' + rect.width + 'z');

    // Blue outline highlight
    hlEl.style.left = rect.left + 'px';
    hlEl.style.top = rect.top + 'px';
    hlEl.style.width = rect.width + 'px';
    hlEl.style.height = rect.height + 'px';
    hlEl.style.display = 'block';

    // Element info in dialog header
    var tag = el.tagName.toLowerCase();
    var id = el.id ? '#' + el.id : '';
    var cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
      : '';
    var tid = getTestId(el);
    var tidStr = tid ? ' [' + tid.name + '=' + tid.value + ']' : '';
    var dim = Math.round(rect.width) + '\u00d7' + Math.round(rect.height);
    elInfo.textContent = tag + id + cls + tidStr + ' ' + dim;

    // Hide crosshair on small elements
    overlay.style.cursor = (rect.width < SIZE_THRESHOLD_W || rect.height < SIZE_THRESHOLD_H) ? 'default' : 'crosshair';

    // Corner labels
    updateCornerLabels(rect);

    // Center z-index label
    updateCenterLabel(rect, zVal);

    // Path display
    renderPathDisplay(el, zVal);
    // toolbox: Copy Selected id button — enabled only when element has a unique id
    if (copyIdBtn) {
      var uid = getSelectedUniqueId(el);
      copyIdBtn.disabled = !uid;
      copyIdBtn.title = uid ? 'Copy id: ' + uid : 'No unique id on this element (needs data-testid / id)';
    }
  }

  // ── Multi-pick queue ───────────────────────────────────────────
  function truncatePath(p) {
    return p.length > 80 ? p.slice(0, 77) + '...' : p;
  }

  function setMultiMode(on) {
    multiMode = on;
    if (multiBtn) multiBtn.classList.toggle('active', on);
    if (multiActions) multiActions.classList.toggle('open', on);
    if (!on) { /* keep collected so user can toggle back; badges stay */ }
    showToast(on ? 'Multi-pick ON — click elements to add' : 'Multi-pick OFF');
  }

  function addBadge(item) {
    var rect;
    try { rect = item.el.getBoundingClientRect(); } catch (e) { return; }
    var b = document.createElement('div');
    b.textContent = String(item.n);
    b.style.cssText = 'position:fixed;z-index:2147483647;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#FFD700;color:#1E3A5F;font:700 12px/20px -apple-system,BlinkMacSystemFont,sans-serif;text-align:center;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
    positionBadge(b, rect);
    document.body.appendChild(b);
    item.badgeEl = b;
    if (!item.origOutline) item.origOutline = item.el.style.outline;
    try { item.el.style.outline = '2px dashed rgba(255,180,0,0.7)'; } catch (e) {}
  }

  function positionBadge(b, rect) {
    b.style.left = Math.max(2, rect.left) + 'px';
    b.style.top = Math.max(2, rect.top - 24) + 'px';
  }

  function repositionBadges() {
    for (var i = 0; i < collected.length; i++) {
      var item = collected[i];
      if (!item.badgeEl) continue;
      try {
        var r = item.el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0 && item.el.isConnected === false) continue;
        positionBadge(item.badgeEl, r);
      } catch (e) {}
    }
  }

  function removeBadge(item) {
    if (item.badgeEl) { try { item.badgeEl.remove(); } catch (e) {} item.badgeEl = null; }
    try { item.el.style.outline = item.origOutline || ''; } catch (e) {}
  }

  function renumberBadges() {
    for (var i = 0; i < collected.length; i++) {
      collected[i].n = i + 1;
      if (collected[i].badgeEl) collected[i].badgeEl.textContent = String(i + 1);
    }
  }

  function renderQueue() {
    if (!queueList) return;
    queueList.textContent = '';
    if (!collected.length) {
      queueList.classList.remove('has-items');
    } else {
      queueList.classList.add('has-items');
    }
    for (var i = 0; i < collected.length; i++) {
      (function (item) {
        var row = document.createElement('div');
        row.className = 'q-row';
        var num = document.createElement('span');
        num.className = 'q-num';
        num.textContent = item.n + '.';
        var p = document.createElement('span');
        p.className = 'q-path';
        var full;
        try { full = getSelectorPath(item.el, formatMode); } catch (e) { full = '(detached)'; }
        p.textContent = truncatePath(full);
        p.title = full;
        var x = document.createElement('button');
        x.className = 'q-remove';
        x.textContent = '\u00d7';
        x.title = 'Remove #' + item.n;
        x.addEventListener('click', function (e) { e.stopPropagation(); removeItem(item.el); });
        row.appendChild(num);
        row.appendChild(p);
        row.appendChild(x);
        queueList.appendChild(row);
      })(collected[i]);
    }
    if (queueCount) queueCount.textContent = collected.length + ' picked';
    if (copyAllBtn) {
      copyAllBtn.textContent = 'Copy All (' + collected.length + ')';
      copyAllBtn.disabled = collected.length === 0;
    }
    if (sepSelect && sepSelect.value !== sepStyle) sepSelect.value = sepStyle;
  }

  function addItem(el) {
    if (!el || el === document.body || el === document.documentElement) return;
    for (var i = 0; i < collected.length; i++) {
      if (collected[i].el === el) {
        showToast('Already added #' + collected[i].n, true);
        if (queueList) { queueList.style.animation = 'none'; queueList.offsetHeight; queueList.style.animation = 'ctp-shake 0.4s ease'; }
        return;
      }
    }
    var item = { n: collected.length + 1, el: el, origOutline: '', badgeEl: null };
    collected.push(item);
    addBadge(item);
    renderQueue();
    showToast('Added #' + item.n);
  }

  function removeItem(el) {
    for (var i = 0; i < collected.length; i++) {
      if (collected[i].el === el) {
        removeBadge(collected[i]);
        collected.splice(i, 1);
        break;
      }
    }
    renumberBadges();
    renderQueue();
  }

  function clearQueue() {
    for (var i = 0; i < collected.length; i++) removeBadge(collected[i]);
    collected = [];
    renderQueue();
    showToast('Queue cleared');
  }

  function buildMultiOutput() {
    var paths = collected.map(function (item) {
      try { return getSelectorPath(item.el, formatMode); } catch (e) { return '(detached)'; }
    });
    if (sepStyle === 'numbered') {
      return paths.map(function (p, i) { return (i + 1) + '. ' + p; }).join('\n');
    }
    if (sepStyle === 'comma') return paths.join(', ');
    if (sepStyle === 'json') {
      return JSON.stringify(paths.map(function (p, i) { return { n: i + 1, path: p }; }));
    }
    return paths.join('\n');
  }

  function doCopyAll() {
    if (!collected.length) { showToast('Nothing picked', true); return; }
    var text = buildMultiOutput();
    console.log('[copy-ui-path-lite] COPIED MULTI (' + collected.length + ', ' + sepStyle + '):');
    console.log('[copy-ui-path-lite]', text);
    // Stay-open by default: never hide the picker unless closeAfterCopy is on.
    // (hidePicker sets host display:none, which would strand badges + dialog.)
    if (closeAfterCopy) hidePicker();
    copyToClipboard(text).then(function () {
      showToast('Copied ' + collected.length + ' paths (' + sepStyle + ')');
      if (copyAllBtn) copyAllBtn.textContent = 'Copied!';
      setTimeout(renderQueue, 1200);
      if (closeAfterCopy) { dialog.classList.add('closing'); setTimeout(quit, 300); }
    }).catch(function () {
      showToast('Clipboard failed', true);
      if (closeAfterCopy) { dialog.classList.add('closing'); setTimeout(quit, 300); }
      else if (copyAllBtn) setTimeout(renderQueue, 1200);
    });
  }

  function doCopy(stayOpen) {
    if (!currentPath) return;
    var zVal = getZ(currentEl);
    var selector = getSelectorPath(currentEl, formatMode);
    var isContextMode = (formatMode === 'auto' || formatMode === 'context');
    var copyText = isContextMode ? buildPathData(currentEl, selector, zVal).toText() : selector;
    var pct = calcTestidPercent(currentEl);
    console.log('[copy-ui-path-lite] ──────────────────────────────────────');
    console.log('[copy-ui-path-lite] COPIED TO CLIPBOARD:');
    console.log('[copy-ui-path-lite]', copyText);
    console.log('[copy-ui-path-lite] testid coverage:', pct + '%');
    console.log('[copy-ui-path-lite] ──────────────────────────────────────');
    if (!stayOpen) hidePicker();
    copyBtn.textContent = 'Copied!';
    copyBtn.classList.add('copied');
    copyToClipboard(copyText).then(function () {
      var preview = copyText.length > 50 ? copyText.slice(0, 47) + '...' : copyText;
      showToast('Copied ' + formatMode + ': ' + preview + '  [' + pct + '%]');
      if (stayOpen) {
        setTimeout(function() { copyBtn.textContent = 'Copy path'; copyBtn.classList.remove('copied'); }, 1200);
      } else {
        dialog.classList.add('closing');
        setTimeout(quit, 300);
      }
    }).catch(function () {
      console.error('[copy-ui-path-lite] clipboard write FAILED');
      showToast('Clipboard failed', true);
      if (!stayOpen) { dialog.classList.add('closing'); setTimeout(quit, 300); }
    });
  }

  function doCopyId(stayOpen) {
    if (!currentEl) return;
    var uid = getSelectedUniqueId(currentEl);
    if (!uid) {
      showToast('No unique id on selected element', true);
      if (copyIdBtn) { copyIdBtn.style.animation = 'none'; copyIdBtn.offsetHeight; copyIdBtn.style.animation = 'ctp-shake 0.4s ease'; }
      return;
    }
    console.log('[copy-ui-path-lite] COPIED ID:', uid);
    if (!stayOpen) hidePicker();
    copyIdBtn.textContent = 'Copied!';
    copyIdBtn.classList.add('copied');
    copyToClipboard(uid).then(function () {
      showToast('Copied id: ' + uid);
      if (stayOpen) {
        setTimeout(function() { copyIdBtn.textContent = 'Copy Selected id'; copyIdBtn.classList.remove('copied'); }, 1200);
      } else {
        dialog.classList.add('closing');
        setTimeout(quit, 300);
      }
    }).catch(function () {
      console.error('[copy-ui-path-lite] copy id FAILED');
      showToast('Clipboard failed', true);
      if (!stayOpen) { dialog.classList.add('closing'); setTimeout(quit, 300); }
    });
  }

  function quit() {
    savedPath = [];
    pathIndex = -1;
    isNavigating = false;
    for (var qi = 0; qi < collected.length; qi++) removeBadge(collected[qi]);
    collected = [];
    overlay.removeEventListener('mousemove', onMouseMove);
    overlay.removeEventListener('click', onOverlayClick);
    overlay.removeEventListener('contextmenu', onRightClick);
    dialogHeader.removeEventListener('mousedown', onDragStart);
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', repositionBadges, true);
    window.removeEventListener('resize', repositionBadges);
    injectedStyle.remove();
    hlEl.remove();
    cornerTl.remove();
    cornerTr.remove();
    cornerBl.remove();
    cornerBr.remove();
    centerLabel.remove();
    host.remove();
  }

  function onMouseMove(e) {
    if (dragging || frozen || isNavigating) return;
    lastX = e.clientX;
    lastY = e.clientY;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      var el = elFromPoint(lastX, lastY);
      if (el) {
        updateUI(el);
      }
    });
  }

  function onOverlayClick(e) {
    if (dragging) return;
    e.preventDefault();
    e.stopPropagation();
    if (frozen) {
      frozen = false;
      dialog.classList.remove('frozen');
      overlay.classList.remove('frozen');
      freezeHint.style.display = 'block';
      showToast('Resumed hovering');
      return;
    }
    var el = elFromPoint(e.clientX, e.clientY);
    if (el) {
      updateUI(el);
      if (multiMode) { addItem(el); return; }
      doCopy(e.ctrlKey);
    }
  }

  function onRightClick(e) {
    if (frozen) return;
    e.preventDefault();
    e.stopPropagation();
    frozen = true;
    dialog.classList.add('frozen');
    overlay.classList.add('frozen');
    freezeHint.style.display = 'none';
    showToast('Frozen — left click to unfreeze');
    var el = elFromPoint(e.clientX, e.clientY);
    if (el) {
      savePath(el);
      updateUI(el);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') quit();
    if (frozen) {
      if (e.key === 'ArrowLeft') stepBack();
      if (e.key === 'ArrowRight') stepNext();
    }
  }

  function onDragStart(e) {
    if (e.target === quitBtn || (multiBtn && e.target === multiBtn)) return;
    dragging = true;
    var rect = dialog.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    dialog.style.left = rect.left + 'px';
    dialog.style.top = rect.top + 'px';
    dialog.style.right = 'auto';
    dialog.style.bottom = 'auto';
    e.preventDefault();
  }

  function onDragMove(e) {
    if (!dragging) return;
    var x = Math.max(0, Math.min(e.clientX - dragOffsetX, window.innerWidth - dialog.offsetWidth));
    var y = Math.max(0, Math.min(e.clientY - dragOffsetY, window.innerHeight - dialog.offsetHeight));
    dialog.style.left = x + 'px';
    dialog.style.top = y + 'px';
  }

  function onDragEnd() {
    dragging = false;
  }

  copyBtn.addEventListener('click', function(e) { doCopy(e.ctrlKey); });
  if (copyIdBtn) copyIdBtn.addEventListener('click', function(e) { doCopyId(e.ctrlKey); });
  quitBtn.addEventListener('click', quit);
  stepBackBtn.addEventListener('click', stepBack);
  stepNextBtn.addEventListener('click', stepNext);
  if (multiBtn) multiBtn.addEventListener('click', function (e) { e.stopPropagation(); setMultiMode(!multiMode); });
  if (sepSelect) {
    try { sepSelect.value = sepStyle; } catch (e) {}
    sepSelect.addEventListener('change', function () {
      sepStyle = this.value;
      try { localStorage.setItem(SEP_KEY, sepStyle); } catch (e) {}
      renderQueue();
    });
  }
  if (copyAllBtn) copyAllBtn.addEventListener('click', doCopyAll);
  if (clearBtn) clearBtn.addEventListener('click', clearQueue);
  if (closeAfterCopyBox) closeAfterCopyBox.addEventListener('change', function () { closeAfterCopy = this.checked; });
  window.addEventListener('scroll', repositionBadges, true);
  window.addEventListener('resize', repositionBadges);
  if (multiBtn) multiBtn.classList.toggle('active', multiMode);
  if (multiActions) multiActions.classList.toggle('open', multiMode);
  renderQueue();
  window.__ctp_multi = {
    get: function () { return collected.map(function (it) { return it.el; }); },
    mode: function () { return multiMode; },
    setMode: setMultiMode,
    add: addItem,
    remove: removeItem,
    clear: clearQueue,
    output: buildMultiOutput,
    copyAll: doCopyAll,
    setSep: function (s) { sepStyle = s; renderQueue(); },
    setFormat: function (m) { formatMode = m; if (currentEl) renderPathDisplay(currentEl, getZ(currentEl)); renderQueue(); }
  };
  overlay.addEventListener('mousemove', onMouseMove);
  overlay.addEventListener('click', onOverlayClick);
  overlay.addEventListener('contextmenu', onRightClick);
  dialogHeader.addEventListener('mousedown', onDragStart);
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('keydown', onKeyDown, true);
})();
