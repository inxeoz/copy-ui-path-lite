(function () {
  console.log('[copy-ui-path-lite] picker.js loaded');
  var maxDepth = 25;
  if (document.getElementById('ctp-picker-root')) {
    console.log('[copy-ui-path-lite] picker already active, skipping');
    return;
  }

  // Inject shake animation + close animation (keep in sync with theme tokens)
  var injectedStyle = document.createElement('style');
  injectedStyle.textContent =
    '@keyframes ctp-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}' +
    '@keyframes ctp-fadeOut{from{opacity:1}to{opacity:0;transform:translateY(-8px)}}' +
    // Numbered page badges are appended to document.body, not to the picker's
    // shadow tree, so they need a real stylesheet — inline cssText cannot say
    // "show the × while this badge is hovered". `pointer-events` has to flip
    // from none to auto for the badge to be hoverable at all; it lives here so
    // the inline cssText never re-asserts `none` over it.
    '.ctp-badge{pointer-events:auto;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;}' +
    // The number must not swallow clicks meant for the × beside it.
    '.ctp-badge-n{pointer-events:none;}' +
    '.ctp-badge-x{display:none;align-items:center;justify-content:center;width:12px;height:12px;margin-left:4px;padding:0;border:0;border-radius:50%;background:transparent;color:inherit;font-family:inherit;font-size:12px;font-weight:700;line-height:1;cursor:pointer;}' +
    '.ctp-badge:hover .ctp-badge-x,.ctp-badge:focus-within .ctp-badge-x{display:inline-flex;}' +
    '.ctp-badge-x:hover{background:rgba(30,58,95,.18);}';
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
    while (cur && depth < maxDepth) {
      if (cur !== el && (cur === document.documentElement || cur === document.body)) break;
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
    if (depth >= maxDepth) segs.unshift('...');
    return segs;
  }

  function savePathFromElement(el) {
    var path = [];
    var cur = el;
    var depth = 0;
    while (cur && depth < maxDepth) {
      if (cur !== el && (cur === document.documentElement || cur === document.body)) break;
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

  function getClassicContextPath(el) {
    try {
      var z = getZ(el);
      return buildPathData(el, getSelectorPath(el, 'classic-context'), z).toText();
    } catch (e) { return '(detached)'; }
  }

  // The preview shows exactly the selector that will be copied for the current mode.
  function getPreviewPath(el, mode) {
    return getSelectorPath(el, mode);
  }

  function calcTestidPercent(el) {
    var total = 0;
    var withId = 0;
    var cur = el;
    while (cur) {
      if (cur !== el && (cur === document.documentElement || cur === document.body)) break;
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
    // Badges are hoverable now (their × needs pointer events), so a hit-test
    // over one would return the badge instead of the page element — hide them
    // for the duration of the test.
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
    if (el && (el.id === 'ctp-lite-toast' || (el.style && el.style.zIndex === '2147483647' &&
        (el.parentElement === document.body || el.parentElement === document.documentElement) && el !== hlEl))) {
      // badge divs carry only a number and a ×; fall through to element below via coords offset
      // (badges are hidden above so this is rare, but guard anyway)
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

  // ── Screenshot capture (element-level crop) ─────────────────────

  function sendMessage(msg) {
    return new Promise(function (resolve) {
      try {
        var chromeObj = window.chrome;
        var browserObj = window.browser;
        if (chromeObj && chromeObj.runtime && chromeObj.runtime.sendMessage) {
          chromeObj.runtime.sendMessage(msg, function (res) {
            if (chromeObj.runtime.lastError) resolve({ dataUrl: null });
            else resolve(res || { dataUrl: null });
          });
        } else if (browserObj && browserObj.runtime && browserObj.runtime.sendMessage) {
          browserObj.runtime.sendMessage(msg).then(resolve).catch(function () { resolve({ dataUrl: null }); });
        } else {
          resolve({ dataUrl: null });
        }
      } catch (e) {
        resolve({ dataUrl: null });
      }
    });
  }

  function captureElementScreenshot(el) {
    if (!settings.includeImageBase64 || !el) return Promise.resolve(null);
    var rect = null;
    try { rect = el.getBoundingClientRect(); } catch (e) { rect = null; }
    if (!rect || !rect.width || !rect.height) { console.log('[copy-ui-path-lite] bad rect', rect && rect.width, rect && rect.height); return Promise.resolve(null); }
    return sendMessage({ action: 'ctp-capture-visible' }).then(function (res) {
      if (!res || !res.dataUrl) {
        console.error('[copy-ui-path-lite] screenshot capture failed:', res && res.error);
        return null;
      }
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () { console.log('[copy-ui-path-lite] capture crop img onload');
          var dpr = window.devicePixelRatio || 1;
          // Compress aggressively: scale down large elements and use JPEG
          // so the embedded base64 prompt stays much shorter.
          // User-configurable resolution/compression (0-100%).
          // Resolution % scales the element dimensions directly.
          // Compression % increases JPEG compression (higher = more compressed).
          var resoPct = parseFloat(settings.imageResolutionPct || '50');
          if (!resoPct || resoPct <= 0) resoPct = 1;
          if (resoPct > 100) resoPct = 100;
          var compLevel = parseFloat(settings.imageCompressionLevel || '40');
          if (compLevel < 0) compLevel = 0;
          if (compLevel > 100) compLevel = 100;
          var quality = Math.max(0.01, (100 - compLevel) / 100);
          var scale = resoPct / 100;
          var outW = Math.max(1, Math.round(rect.width * dpr * scale));
          var outH = Math.max(1, Math.round(rect.height * dpr * scale));
          var canvas = document.createElement('canvas');
          canvas.width = outW;
          canvas.height = outH;
          var ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, rect.left * dpr, rect.top * dpr, rect.width * dpr, rect.height * dpr, 0, 0, outW, outH);
          try { console.log('[copy-ui-path-lite] screenshot cropped to ' + outW + 'x' + outH); resolve(canvas.toDataURL('image/jpeg', quality)); } catch (e) {
            try { resolve(canvas.toDataURL('image/png')); } catch (e2) { resolve(null); }
          }
        };
        img.onerror = function () { console.error("[copy-ui-path-lite] capture crop img onerror"); resolve(null); };
        img.src = res.dataUrl;
      });
    });
  }

  function writeClipboardPayload(text, imageBlob) {
    if (imageBlob && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      try {
        var item = new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'image/png': imageBlob
        });
        return navigator.clipboard.write([item]);
      } catch (e) { console.error('[copy-ui-path-lite] clipboard image write failed:', e); }
    }
    return copyToClipboard(text);
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
  tpl.innerHTML = /*__CTP_UI__*/'';
  shadow.appendChild(tpl.content.cloneNode(true));

  document.documentElement.appendChild(host);

  // ── MAIN-world bridge ──────────────────────────────────────────
  // Framework internals (React fiber, Vue component, ...) live in the page's
  // own JavaScript world. A content script cannot see them, so we inject a
  // small collector into the main world and talk to it with DOM events.
  var mainBridgeInjected = false;
  function injectMainBridge() {
    if (mainBridgeInjected) return;
    mainBridgeInjected = true;
    var s = document.createElement('script');
    s.textContent = [
      'window.__ctpCollectContext = function(el) {',
      '  try {',
      '    var out = { framework: null, file: null, line: null, componentChain: null, usage: null };',
      '    // React',
      '    var node = el;',
      '    var fiber = null, tries = 0;',
      '    while (node && !fiber && tries < 6) {',
      '      for (var k in node) {',
      '        if (/^__react(Fiber|InternalInstance)\\$/.test(k)) { fiber = node[k]; break; }',
      '      }',
      '      if (!fiber && node.parentElement) node = node.parentElement; tries++;',
      '    }',
      '    if (fiber) {',
      '      out.framework = "React";',
      '      var f = fiber, chain = [], owners = f._debugOwner || f._debugStack; ',
      '      // collect owners',
      '      var o = f._debugOwner;',
      '      var names = [];',
      '      while (o) { var n = (o.type && (o.type.displayName || o.type.name)) || o.name; if (n) names.push(n); o = o._debugOwner; }',
      '      if (names.length) names.reverse();',
      '      names.push((f.type && (f.type.displayName || f.type.name)) || f.type || (el && el.tagName && el.tagName.toLowerCase()));',
      '      if ((el && el.tagName)) names.push(el.tagName.toLowerCase());',
      '      // de-dupe adjacent',
      '      var dedup = []; names.forEach(function(n){ if (!dedup.length || dedup[dedup.length-1] !== n) dedup.push(n); });',
      '      out.componentChain = dedup.join(" > ");',
      '      var src = f._debugSource;',
      '      if (src && src.fileName) { out.file = src.fileName; out.line = src.lineNumber || src.line || null; }',
      '      if (!out.file && typeof f._debugStack === "string") {',
      '        var m = f._debugStack.match(/\\(([^)]+):(\\d+):(\\d+)\\)/);',
      '        if (m) { out.file = m[1]; out.line = parseInt(m[2],10); }',
      '      }',
      '      // usage: parent owner',
      '      if (f._debugOwner) {',
      '        var po = f._debugOwner;',
      '        var pn = (po.type && (po.type.displayName || po.type.name)) || po.name;',
      '        var ps = po._debugSource;',
      '        if (pn) out.usage = "<" + pn + "> at @" + (ps && ps.fileName ? ps.fileName : "") + (ps && (ps.lineNumber||ps.line) ? ":" + (ps.lineNumber||ps.line) : "");',
      '      }',
      '    }',
      '    // Vue',
      '    if (!out.file) {',
      '      var vNode = el;',
      '      var triesV = 0, inst = null;',
      '      while (vNode && !inst && triesV < 6) {',
      '        if (vNode.__vueParentComponent) inst = vNode.__vueParentComponent;',
      '        else if (vNode.__vue__) inst = vNode.__vue__; ',
      '        if (!inst && vNode.parentElement) vNode = vNode.parentElement; triesV++;',
      '      }',
      '      if (inst) {',
      '        out.framework = "Vue";',
      '        if (inst.type && inst.type.__file) { out.file = inst.type.__file; }',
      '        if (inst.type && (inst.type.name || inst.type.__name)) out.componentChain = (inst.type.name || inst.type.__name);',
      '        // ancestors',
      '        var cur = inst, chainV = [];',
      '        while (cur) {',
      '          var nm = cur.type && (cur.type.name || cur.type.__name || cur.type.displayName);',
      '          if (nm) chainV.unshift(nm);',
      '          cur = cur.parent;',
      '        }',
      '        if (chainV.length) { chainV.push(el && el.tagName && el.tagName.toLowerCase()); out.componentChain = chainV.join(" > "); }',
      '        if (inst.parent && inst.parent.type) {',
      '          var pnm = inst.parent.type.name || inst.parent.type.__name || inst.parent.type.displayName;',
      '          var pf = inst.parent.type && inst.parent.type.__file;',
      '          if (pnm) out.usage = "<" + pnm + "> at @" + (pf || "");',
      '        }',
      '      }',
      '    }',
      '    // Svelte',
      '    if (!out.file) {',
      '      var sNode = el, triesS = 0, meta = null;',
      '      while (sNode && !meta && triesS < 6) {',
      '        if (sNode.__svelte_meta) meta = sNode.__svelte_meta;',
      '        if (!meta && sNode.parentElement) sNode = sNode.parentElement; triesS++;',
      '      }',
      '      if (meta && meta.loc) {',
      '        out.framework = "Svelte";',
      '        out.file = meta.loc.file;',
      '        out.line = meta.loc.line;',
      '        if (meta.loc.component) out.componentChain = String(meta.loc.component);',
      '      }',
      '    }',
      '    // Angular',
      '    if (!out.file && window.ng && typeof window.ng.getOwningComponent === "function") {',
      '      var comp = null;',
      '      try { comp = window.ng.getOwningComponent(el); } catch(e) {}',
      '      if (comp) {',
      '        out.framework = "Angular";',
      '        var cn = (comp.constructor && comp.constructor.name) || "Component";',
      '        out.componentChain = cn;',
      '        // try debug info',
      '        try {',
      '          var debug = comp.constructor && (comp.constructor.ɵcmp || comp.constructor.ɵcmp.debugInfo);',
      '          if (debug && debug.fileName) out.file = debug.fileName;',
      '          if (debug && debug.lineNumber) out.line = debug.lineNumber;',
      '        } catch(e){}',
      '      }',
      '    }',
      '    // Sentry attributes (production)',
      '    if (!out.file) {',
      '      var sentryNode = el, triesN = 0;',
      '      while (sentryNode && triesN < 6) {',
      '        if (sentryNode.getAttribute && sentryNode.getAttribute("data-sentry-source-file")) {',
      '          out.framework = "Sentry";',
      '          out.file = sentryNode.getAttribute("data-sentry-source-file");',
      '          out.componentChain = sentryNode.getAttribute("data-sentry-component");',
      '          break;',
      '        }',
      '        if (sentryNode.parentElement) sentryNode = sentryNode.parentElement; triesN++;',
      '      }',
      '    }',
      '    return out;',
      '  } catch (e) { return null; }',
      '};',
      'window.addEventListener("ctp:get-context", function(e) {',
      '  var d = (e && e.detail) || {};',
      '  var r = (window.__ctpCollectContext && d.el) ? window.__ctpCollectContext(d.el) : null;',
      '  window.dispatchEvent(new CustomEvent("ctp:context-result", { detail: { id: d.id, result: r } }));',
      '});'
    ].join('\n');
    document.documentElement.appendChild(s);
    s.remove();
  }
  injectMainBridge();

  function requestMainContext(el) {
    return new Promise(function (resolve) {
      var id = 'ctp_' + Math.random().toString(36).slice(2);
      function handler(e) {
        var d = e && e.detail;
        if (!d || d.id !== id) return;
        window.removeEventListener('ctp:context-result', handler);
        resolve(d.result || null);
      }
      window.addEventListener('ctp:context-result', handler);
      try { window.dispatchEvent(new CustomEvent('ctp:get-context', { detail: { id: id, el: el } })); }
      catch (err) { resolve(null); }
      setTimeout(function () { window.removeEventListener('ctp:context-result', handler); resolve(null); }, 200);
    });
  }

  // ── Context cache ───────────────────────────────────────────────
  var contextCache = new Map();

  function ensureContext(el) {
    if (!contextCache.has(el)) {
      contextCache.set(el, {
        source: null,
        fingerprint: null,
        searched: false
      });
    }
    var c = contextCache.get(el);
    if (!c.fingerprint) c.fingerprint = buildFingerprint(el);
    return c;
  }

  function toProjectRelative(p) {
    if (!p) return null;
    var s = String(p);
    try {
      if (/^https?:\/\//i.test(s)) {
        var u = new URL(s);
        s = u.pathname || s;
      }
    } catch (e) {}
    s = s.replace(/\\\\/g, '/');
    s = s.split('?')[0].split('#')[0];
    var idx = s.lastIndexOf('/src/');
    if (idx >= 0) return s.slice(idx + 1);
    idx = s.lastIndexOf('src/');
    if (idx >= 0 && (idx === 0 || s.charAt(idx - 1) === '/')) return s.slice(idx);
    return s.replace(/^\/+/, '');
  }

  function collectBuildPluginSource(el) {
    var node = el;
    for (var depth = 0; depth < 8 && node; depth++) {
      if (node.getAttribute) {
        var sentryFile = node.getAttribute('data-sentry-source-file');
        if (sentryFile) {
          return {
            framework: 'Sentry',
            file: sentryFile,
            line: parseFileLineNum(node.getAttribute('data-sentry-line') || node.getAttribute('data-sentry-source-line')),
            componentChain: node.getAttribute('data-sentry-component'),
            usage: null
          };
        }
        var vi = node.getAttribute('data-v-inspector');
        if (vi) {
          var pl = parseFileLine(vi);
          if (pl) return { framework: 'Vue', file: pl.file, line: pl.line, componentChain: null, usage: null };
        }
        var rel = node.getAttribute('data-inspector-relative-path');
        if (rel) {
          var ln = node.getAttribute('data-inspector-line') || node.getAttribute('data-inspector-row') || node.getAttribute('data-line');
          return { framework: 'React', file: rel, line: ln ? parseInt(ln, 10) : null, componentChain: null, usage: null };
        }
        var astro = node.getAttribute('data-astro-source-file');
        if (astro) {
          var aln = node.getAttribute('data-astro-source-line');
          return { framework: 'Astro', file: astro, line: aln ? parseInt(aln, 10) : null, componentChain: null, usage: null };
        }
      }
      node = node.parentElement;
    }
    return null;
  }

  function parseFileLine(str) {
    if (!str) return null;
    var m = String(str).match(/^(.*?):(\\d+)(?::\\d+)?$/);
    if (m) return { file: m[1], line: parseInt(m[2], 10) };
    return { file: String(str), line: null };
  }
  function parseFileLineNum(str) {
    if (!str) return null;
    var m = String(str).match(/(\\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  function candidateStrings(el) {
    var out = [];
    var text = (el.textContent || '').trim().replace(/\s+/g, ' ');
    if (text && text.length >= 4 && text.length <= 80) out.push(text);
    var aria = el.getAttribute && el.getAttribute('aria-label');
    if (aria && aria.trim().length >= 3) out.push(aria.trim());
    var tid = getTestId(el);
    if (tid && tid.value) out.push(String(tid.value));
    var id = el.id;
    if (id && id.length >= 3) out.push(String(id));
    var classes = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\\s+/) : [];
    if (classes.length) {
      var stable = classes[0];
      if (stable && stable.length >= 4 && !/^[a-z]{1,2}-?[a-f0-9]{4,}$/i.test(stable)) out.push(stable);
    }
    // de-dupe
    var seen = {};
    return out.filter(function (s) { if (seen[s]) return false; seen[s] = true; return true; });
  }

  var scriptTextCache = {};
  function getSameOriginScripts() {
    var set = {};
    var urls = [];
    function add(u) {
      try {
        var abs = new URL(u, location.href).href;
        if (new URL(abs).origin !== location.origin) return;
        if (set[abs]) return;
        set[abs] = true;
        urls.push(abs);
      } catch (e) {}
    }
    document.querySelectorAll('script[src]').forEach(function (s) { add(s.src); });
    try {
      performance.getEntriesByType('resource').forEach(function (r) {
        if (r.initiatorType === 'script' || /\\.js(\\?|$)/.test(r.name)) add(r.name);
      });
    } catch (e) {}
    return urls;
  }

  function fetchScriptText(url) {
    if (scriptTextCache[url]) return scriptTextCache[url];
    var p = fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('bad status');
      return r.text();
    }).catch(function () { return null; });
    scriptTextCache[url] = p;
    return p;
  }

  function getScriptEntries() {
    var entries = [];
    var seen = {};
    getSameOriginScripts().forEach(function (u) {
      if (seen[u]) return; seen[u] = true;
      entries.push({ url: u, textPromise: fetchScriptText(u) });
    });
    document.querySelectorAll('script:not([src])').forEach(function (s, i) {
      var u = location.href + '#inline-' + i;
      if (seen[u]) return; seen[u] = true;
      entries.push({ url: u, textPromise: Promise.resolve(s.textContent || '') });
    });
    return entries;
  }

  function runSourceSearch(el) {
    var c = ensureContext(el);
    if (c.source && c.source.file) return Promise.resolve(c.source);
    var cands = candidateStrings(el);
    if (!cands.length) return Promise.resolve(null);
    var entries = getScriptEntries();
    var urls = entries.map(function (e) { return e.url; });
    return Promise.all(entries.map(function (e) { return e.textPromise; })).then(function (texts) {
      var best = null; // {file, line, count}
      for (var ci = 0; ci < cands.length; ci++) {
        var cand = cands[ci];
        var fileCount = 0;
        var firstMatch = null;
        for (var i = 0; i < entries.length; i++) {
          var t = texts[i];
          if (!t) continue;
          if (t.indexOf(cand) === -1) continue;
          fileCount++;
          if (!firstMatch) {
            var idx = t.indexOf(cand);
            var line = t.slice(0, idx).split(/\n/).length;
            firstMatch = { url: urls[i], line: line };
          }
        }
        if (fileCount > 0 && fileCount <= 5) {
          if (!best || fileCount < best.count) {
            best = { url: firstMatch.url, line: firstMatch.line, count: fileCount };
          }
        }
      }
      if (best) {
        var src = { framework: 'Search', file: best.url, line: best.line, componentChain: null, usage: null };
        // store raw url; normalization later
        c.source = src;
        // mark searched
        c.searched = true;
      } else {
        c.searched = true;
      }
      return c.source;
    });
  }

  function scheduleSourceSearch(el) {
    ensureContext(el);
    runSourceSearch(el);
    setTimeout(function () { var c = contextCache.get(el); if (c && !(c.source && c.source.file)) runSourceSearch(el); }, 500);
    setTimeout(function () { var c = contextCache.get(el); if (c && !(c.source && c.source.file)) runSourceSearch(el); }, 1500);
  }

  async function collectSource(el) {
    var c = ensureContext(el);
    // Layer 1 main bridge
    var info = null;
    try { info = await requestMainContext(el); } catch (e) { info = null; }
    if (info) {
      if (!c.source) c.source = { framework: null, file: null, line: null, componentChain: null, usage: null };
      if (info.framework) c.source.framework = info.framework;
      if (info.file) c.source.file = info.file;
      if (info.line) c.source.line = info.line;
      if (info.componentChain) c.source.componentChain = info.componentChain;
      if (info.usage) c.source.usage = info.usage;
      if (c.source.file) return c.source;
    }
    // Layer 2 build plugin attrs (sync)
    var bps = collectBuildPluginSource(el);
    if (bps && bps.file) {
      c.source = bps;
      return c.source;
    }
    // Layer 3 scheduled (async) – kick off
    scheduleSourceSearch(el);
    return c.source;
  }

  function engineSourceLine(src) {
    if (!src || !src.file) return '- Source: not found. Use the selector and fingerprint to search.';
    var path = src.file;
    if (path.indexOf('#inline-') === -1) {
      var rel = toProjectRelative(path);
      if (rel && rel.length) path = rel;
    }
    if (src.line) return '- Source: @' + path + ':' + src.line;
    return '- Source: @' + path;
  }

  // ── Fingerprint ─────────────────────────────────────────────────
  function buildFingerprint(el) {
    var rect = el.getBoundingClientRect();
    var cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\\s+/).filter(Boolean) : [];
    var text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 200);
    // selector
    var selector = '';
    try { selector = getSelectorPath(el, 'css'); } catch (e) { selector = el.tagName.toLowerCase(); }
    var domPath = '';
    try { domPath = getDomPath(el); } catch (e) { domPath = selector; }
    // attributes
    var attrNames = ['role', 'aria-label', 'name', 'type', 'href', 'alt', 'title', 'data-testid'];
    var attrs = [];
    attrNames.forEach(function (a) {
      var v = el.getAttribute && el.getAttribute(a);
      if (v) attrs.push(a + '="' + String(v).slice(0, 80) + '"');
    });
    // nearby
    var prevText = '', nextText = '';
    try {
      if (el.previousElementSibling) prevText = (el.previousElementSibling.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
      if (el.nextElementSibling) nextText = (el.nextElementSibling.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    } catch (e) {}
    // section
    var section = '';
    try {
      var landmark = el.closest('section, article, form, nav, header, footer');
      if (landmark) {
        var h = landmark.querySelector('h1,h2,h3,h4,h5,h6');
        if (h) section = (h.textContent || '').trim().slice(0, 80);
        else if (landmark.getAttribute('aria-label')) section = landmark.getAttribute('aria-label');
        else if (landmark.getAttribute('aria-labelledby')) {
          var labeled = document.getElementById(landmark.getAttribute('aria-labelledby'));
          if (labeled) section = (labeled.textContent || '').trim().slice(0, 80);
        }
      }
    } catch (e) {}
    // computed styles (non-default subset)
    var styleProps = ['display', 'position', 'background-color', 'color', 'font-size', 'font-family', 'border-radius', 'margin', 'padding', 'width', 'height', 'z-index'];
    var styles = [];
    try {
      var cs = window.getComputedStyle(el);
      var defaults = { display: 'inline', position: 'static' };
      styleProps.forEach(function (p) {
        var v = cs.getPropertyValue(p);
        if (v && v !== 'none' && v !== 'auto' && v !== 'normal' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') {
          styles.push(p + ': ' + v);
        }
      });
    } catch (e) {}
    var html = '';
    try { html = el.outerHTML.slice(0, 200); } catch (e) {}
    return {
      selector: selector,
      domPath: domPath,
      text: text,
      classes: cls.join(' '),
      attrs: attrs.join(' '),
      position: Math.round(rect.width) + 'x' + Math.round(rect.height) + ' at (' + Math.round(rect.left) + ', ' + Math.round(rect.top) + ')',
      section: section,
      nearby: 'before it "' + prevText + '", after it "' + nextText + '"',
      prevText: prevText,
      nextText: nextText,
      html: html,
      styles: styles.join('; '),
      viewport: window.innerWidth + 'x' + window.innerHeight,
      title: document.title
    };
  }

  function getDomPath(el) {
    var parts = [];
    var cur = el;
    var depth = 0;
    while (cur && cur !== document.documentElement && depth < maxDepth) {
      parts.unshift(cur.tagName.toLowerCase());
      if (cur.parentElement) cur = cur.parentElement;
      else {
        var r = cur.getRootNode ? cur.getRootNode() : null;
        if (r && r instanceof ShadowRoot && r.host) { parts.unshift('{shadow}'); cur = r.host; }
        else break;
      }
      depth++;
    }
    parts.unshift('html');
    return parts.join(' > ');
  }

  function buildContextOutput(el) {
    var c = ensureContext(el);
    if (!c.fingerprint) c.fingerprint = buildFingerprint(el);
    var fp = c.fingerprint;
    var src = c.source;
    var inc = function (k) { return settings[k] !== false; };
    var lines = [];
    // Only include the Source line when a source file was actually found.
    if (inc('includeSource') && src && src.file) lines.push(engineSourceLine(src));
    // Details (annotations) are included only when they exist for this element.
    try {
      var full = getSelectorPath(el, formatMode);
      var ds = notesByPath[full] || [];
      if (ds.length) lines.push('- Details: ' + ds.join('; '));
    } catch (e) {}
    if (inc('includeComponentChain') && src && src.componentChain) {
      var fw = src.framework || 'Component';
      lines.push('- ' + fw + ' component: ' + src.componentChain);
    }
    if (inc('includeUsage') && src && src.usage) lines.push('- Rendered inside: ' + src.usage);
    if (inc('includeSelector')) lines.push('- Selector: ' + fp.selector);
    if (inc('includeDOMPath')) lines.push('- DOM path: ' + fp.domPath);
    if (inc('includeClasses') && fp.classes) lines.push('- Classes: ' + fp.classes);
    if (inc('includeText') && fp.text) lines.push('- Text: "' + fp.text + '"');
    if (inc('includeAttributes') && fp.attrs) lines.push('- Attributes: ' + fp.attrs);
    if (inc('includePosition') && fp.position) lines.push('- Position: ' + fp.position);
    if (inc('includeSection') && fp.section) lines.push('- Section: "' + fp.section + '"');
    if (inc('includeNearby')) {
      var near = [];
      if (fp.prevText) near.push('before it "' + fp.prevText + '"');
      if (fp.nextText) near.push('after it "' + fp.nextText + '"');
      if (near.length) lines.push('- Nearby: ' + near.join(', '));
    }
    if (inc('includeHTML') && fp.html) lines.push('- HTML: ' + fp.html);
    if (inc('includeStyles') && fp.styles) lines.push('- Computed styles: ' + fp.styles);
    if (inc('includeViewport')) lines.push('- Viewport: ' + fp.viewport);
    if (inc('includeTitle')) lines.push('- Page title: ' + fp.title);
    // URL is mandatory even if the (disabled) toggle were off.
    lines.push('- Page: ' + location.href);
    return lines.join('\n');
  }

  function elLabel(el) {
    var tag = el.tagName.toLowerCase();
    var text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return tag + (text ? ' "' + text + '"' : '');
  }

  // Monitor hover: collect source lazily
  // (called below when wiring)

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
  var addBtn = shadow.querySelector('#addBtn');
  var stepBackBtn = shadow.querySelector('#stepBackBtn');
  var stepNextBtn = shadow.querySelector('#stepNextBtn');
  var queueList = shadow.querySelector('#queue-list');
  var multiActions = shadow.querySelector('#multi-actions');
  var queueCount = shadow.querySelector('#queue-count');
  var sepSelect = shadow.querySelector('#sep-select');
  var copyAllBtn = shadow.querySelector('#copyAllBtn');
  var clearBtn = shadow.querySelector('#clearBtn');
  var closeAfterCopyBox = shadow.querySelector('#closeAfterCopy');
  var maxDepthInput = shadow.querySelector('#max-depth');

  // ── Settings (one localStorage record, debounced auto-save) ───────
  var SETTINGS_KEY = 'ctp-lite-settings';
  var settings = {};
  try { settings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { settings = {}; }
  if (!settings.sep) {
    // pre-toolbox builds stored the separator under its own key
    try { var _oldSep = localStorage.getItem('ctp-lite-sep-style'); if (_oldSep) settings.sep = _oldSep; } catch (e) {}
  }
  var saveState = shadow.querySelector('#saveState');
  var saveTimer = null;
  function autoSave() {
    if (!saveState) return;
    saveState.textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
      saveState.textContent = 'Saved ✓';
    }, 350);
  }

  var frozen = false;
  // ── Multi-pick state ─────────────────────────────────────────────
  var collected = [];
  var multiMode = (settings.instantCopy !== true);
  var sepStyle = settings.sep || 'newline';
  var sepCustom = settings.sepCustom || '\n\n';
  var closeAfterCopy = !!settings.closeAfterCopy;
  settings.maxDepth = settings.maxDepth || '25';
  maxDepth = parseInt(settings.maxDepth, 10) || 25;
  if (maxDepth < 1) maxDepth = 1;
  var formatMode = settings.format || 'context';
  try { formatSelect.value = formatMode; } catch (e) {}
  try { sepSelect.value = sepStyle; } catch (e) {}
  if (closeAfterCopyBox) closeAfterCopyBox.checked = closeAfterCopy;
  if (maxDepthInput) maxDepthInput.value = maxDepth;
  var sepCustomInput = shadow.querySelector('#sep-custom');
  if (sepCustomInput) { sepCustomInput.value = sepCustom; }
  var imgResoRange = shadow.querySelector('#imgreso-range');
  var imgCompRange = shadow.querySelector('#imgcomp-range');
  var imgResoVal = shadow.querySelector('#imgreso-val');
  var imgCompVal = shadow.querySelector('#imgcomp-val');
  settings.imageResolutionPct = settings.imageResolutionPct || '50';
  settings.imageCompressionLevel = settings.imageCompressionLevel || '40';
  if (imgResoRange) imgResoRange.value = settings.imageResolutionPct;
  if (imgCompRange) imgCompRange.value = settings.imageCompressionLevel;
  if (imgResoVal) imgResoVal.textContent = settings.imageResolutionPct + '%';
  if (imgCompVal) imgCompVal.textContent = settings.imageCompressionLevel + '%';

  formatSelect.addEventListener('change', function() {
    formatMode = this.value;
    settings.format = formatMode;
    autoSave();
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
  var settingsPanel = shadow.querySelector('#settingsPanel');
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
  function collectProps(){
    var custom = configCustom.value.trim();
    if(custom) return custom.split(',').map(function(s){return s.trim()}).filter(Boolean);
    var out=[]; configChecks.querySelectorAll('input:checked').forEach(function(cb){ out.push(cb.value); });
    return out;
  }
  // Computed props apply live — every edit is persisted, there is no Save button.
  function liveUpdate(){
    cfgProps = collectProps();
    saveCfg(cfgProps);
    autoSave();
    if(currentEl) { var el=currentEl; currentEl=null; updateUI(el); }
  }
  shadow.querySelectorAll('.preset-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var p = this.getAttribute('data-preset');
      if(p==='all'){ configCustom.value=''; configChecks.querySelectorAll('input').forEach(function(cb){cb.checked=true;}); }
      else if(p==='clear'){ configCustom.value=''; configChecks.querySelectorAll('input').forEach(function(cb){cb.checked=false;}); }
      else if(PRESETS[p]){ configCustom.value=''; var set=PRESETS[p]; configChecks.querySelectorAll('input').forEach(function(cb){cb.checked=set.indexOf(cb.value)!==-1;}); }
      liveUpdate();
    });
  });
  if(configChecks) configChecks.addEventListener('change', liveUpdate);
  if(configCustom) configCustom.addEventListener('input', liveUpdate);
  // expose for tests
  window.__ctp_cfg = { get: function(){ return cfgProps.slice(); }, set: function(a){ cfgProps=a; saveCfg(a); } };

  // ── Settings panel: gear toggles it, tabs switch inside it ────────
  function setPanelOpen(open){
    if (settingsPanel) settingsPanel.hidden = !open;
    dialog.classList.toggle('open', open);
    if (configBtn) {
      configBtn.classList.toggle('active', open);
      configBtn.setAttribute('aria-expanded', String(open));
    }
  }
  if (configBtn) configBtn.addEventListener('click', function(e){ e.stopPropagation(); setPanelOpen(settingsPanel.hidden); });

  var tabs = shadow.querySelectorAll('.tab');
  var panels = shadow.querySelectorAll('.panel');
  // Path / Output / Toolbar were separate tabs before they were merged.
  var LEGACY_TABS = { path: 'config', output: 'config', toolbar: 'config' };
  var TAB_NAMES = ['style', 'config', 'preview'];
  function showTab(name){
    if (LEGACY_TABS[name]) name = LEGACY_TABS[name];
    if (TAB_NAMES.indexOf(name) === -1) name = 'preview';
    tabs.forEach(function(tab){
      var on = tab.getAttribute('data-tab') === name;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', String(on));
    });
    panels.forEach(function(p){ p.hidden = p.getAttribute('data-panel') !== name; });
    settings.tab = name;
    autoSave();
  }
  tabs.forEach(function(tab){
    tab.addEventListener('click', function(){ showTab(tab.getAttribute('data-tab')); });
  });

  // ── Toolbar toggles ─────────────────────────────────────────────
  // A checked box shows the control; unchecking removes it from the bar.
  var TOOLBAR_TARGETS = {
    'opt-child': '#stepBackBtn',
    'opt-parent': '#stepNextBtn',
    'opt-move': '#moveBtn',
    'opt-settings': '#configBtn',
    'opt-info': '#el-info'
  };
  function applyToolbarToggle(id) {
    var sel = TOOLBAR_TARGETS[id];
    if (!sel) return;
    var box = shadow.querySelector('#' + id);
    var el = shadow.querySelector(sel);
    if (box && el) el.style.display = box.checked ? '' : 'none';
  }
  // Every `opt-` box is remembered the same way — its id minus the prefix is
  // the settings key — so the plumbing lives here and a caller only supplies
  // the work its own toggle owes beyond being persisted.
  function registerToggle(id, apply) {
    var box = shadow.querySelector('#' + id);
    if (!box) return;
    var key = id.replace('opt-', '');
    if (settings[key] !== undefined) box.checked = !!settings[key];
    box.addEventListener('change', function () {
      settings[key] = box.checked;
      apply();
      autoSave();
    });
    apply();
  }
  // builds before the split stored one toggle for both walk buttons
  if (settings.nav !== undefined) {
    ['opt-child', 'opt-parent'].forEach(function (id) {
      var key = id.replace('opt-', '');
      if (settings[key] === undefined) settings[key] = !!settings.nav;
    });
  }
  if (settings.move === undefined) settings.move = true;
  Object.keys(TOOLBAR_TARGETS).forEach(function (id) {
    registerToggle(id, function () { applyToolbarToggle(id); });
  });

  // Instant copy on click: when on, a click copies immediately instead of
  // adding to the picked list. Off by default (multi-pick).
  if (settings.instantCopy === undefined) settings.instantCopy = false;
  registerToggle('opt-instantCopy', function () { applyInstantCopyMode(); });

  // Show the full path in the Copy button tooltip while hovering.
  if (settings.showPathOnCopyHover === undefined) settings.showPathOnCopyHover = true;
  registerToggle('opt-showPathOnCopyHover', function () { updateCopyBtn(); });

  // Dark theme toggle.
  if (settings.darkTheme === undefined) settings.darkTheme = false;
  function applyDarkTheme() {
    var on = !!settings.darkTheme;
    if (dialog) dialog.classList.toggle('dark', on);
    if (overlay) overlay.classList.toggle('dark', on);
  }
  applyDarkTheme();
  registerToggle('opt-darkTheme', function () { applyDarkTheme(); });

  // Highlight overlay
  var hlEl = document.createElement('div');
  hlEl.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #4A90D9;z-index:2147483646;display:none;';
  document.body.appendChild(hlEl);

  // Corner labels
  var CORNER_NAMES = ['tl', 'tr', 'bl', 'br'];
  var cornerLabels = [];
  CORNER_NAMES.forEach(function(name) {
    var el = document.createElement('div');
    // No id on these divs — the classes are the only handle on them, and
    // what the corner boxes below (and the test harness) look for.
    el.className = 'ctp-corner ctp-corner-' + name;
    el.style.cssText = 'position:fixed;z-index:2147483646;font:11px/1 SF Mono,Cascadia Code,Fira Code,Menlo,monospace;color:#1E3A5F;background:#FFD700;padding:2px 5px;border-radius:3px;pointer-events:none;white-space:nowrap;display:none;';
    document.body.appendChild(el);
    cornerLabels.push(el);
  });
  var cornerTl = cornerLabels[0];
  var cornerTr = cornerLabels[1];
  var cornerBl = cornerLabels[2];
  var cornerBr = cornerLabels[3];

  // ── Corner-label toggles ────────────────────────────────────────
  // One box per corner, starting off: nothing is drawn until a corner is
  // switched on, and each box then gates only its own label in
  // updateCornerLabels() below. The corner block inside the path is a single
  // PART.CORNER segment, so it keeps listing all four corners either way.
  CORNER_NAMES.forEach(function (name) {
    registerToggle('opt-corner-' + name, function () {
      // updateUI() early-returns for the element already hovered, so redraw
      // the labels straight away rather than waiting for the pointer to move.
      if (currentEl) updateCornerLabels(currentEl.getBoundingClientRect());
    });
  });

  // ── Context-path toggles ────────────────────────────────────────
  // Per-field customization from the context path plan. Keys match the toggle
  // names in the plan; ids in the UI are `opt-<key>`.
  var CONTEXT_TOGGLE_KEYS = [
    'includeURL', 'includeTitle', 'includeSource', 'includeComponentChain',
    'includeUsage', 'includeSelector', 'includeDOMPath', 'includeClasses',
    'includeText', 'includeAttributes', 'includePosition', 'includeSection',
    'includeNearby', 'includeHTML', 'includeStyles', 'includeViewport',
    'includeScreenshot', 'includeImageBase64', 'includeScreenshotCompact'
  ];
  var CONTEXT_TOGGLE_DEFAULTS = {
    includeURL: true, includeTitle: false, includeSource: true,
    includeComponentChain: true, includeUsage: false, includeSelector: true,
    includeDOMPath: false, includeClasses: true, includeText: true,
    includeAttributes: false, includePosition: false, includeSection: false,
    includeNearby: false, includeHTML: false, includeStyles: false,
    includeViewport: true, includeScreenshot: true, includeImageBase64: false, includeScreenshotCompact: false
  };
  CONTEXT_TOGGLE_KEYS.forEach(function (key) {
    if (settings[key] === undefined && CONTEXT_TOGGLE_DEFAULTS[key] !== undefined) {
      settings[key] = CONTEXT_TOGGLE_DEFAULTS[key];
    }
  });
  // URL is mandatory: it can never be off.
  settings.includeURL = true;
  CONTEXT_TOGGLE_KEYS.forEach(function (key) {
    registerToggle('opt-' + key, function () { /* value lives in settings */ });
  });
  var urlToggle = shadow.querySelector('#opt-includeURL');
  if (urlToggle) { urlToggle.checked = true; urlToggle.disabled = true; }

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

  // A corner is drawn only when its `corner-<name>` setting is on — an absent
  // key means off, so the labels stay hidden until they are asked for.
  function cornerOn(name) {
    return !!settings['corner-' + name];
  }

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
    cornerTl.style.display = cornerOn('tl') ? 'block' : 'none';

    cornerTr.textContent = 'tr[' + trX + ',' + trY + ']';
    cornerTr.style.right = Math.max(2, window.innerWidth - rect.right + 4) + 'px';
    cornerTr.style.top = Math.max(2, rect.top - 22) + 'px';
    cornerTr.style.display = cornerOn('tr') ? 'block' : 'none';

    cornerBl.textContent = 'bl[' + blX + ',' + blY + ']';
    cornerBl.style.left = Math.max(2, rect.left - 4) + 'px';
    cornerBl.style.top = (rect.bottom + 4) + 'px';
    cornerBl.style.display = cornerOn('bl') ? 'block' : 'none';

    cornerBr.textContent = 'br[' + brX + ',' + brY + ']';
    cornerBr.style.right = Math.max(2, window.innerWidth - rect.right + 4) + 'px';
    cornerBr.style.top = (rect.bottom + 4) + 'px';
    cornerBr.style.display = cornerOn('br') ? 'block' : 'none';
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
    pathDisplay.title = currentPath;
    updateCopyBtn();
  }

  function updateUI(el) {
    if (!el || el === currentEl) return;
    currentEl = el;
    // Kick off layered source resolution (framework -> build plugin -> search)
    // and re-prove after source maps arrive late.
    try {
      ensureContext(el);
      collectSource(el);
      setTimeout(function () { if (contextCache.has(el)) collectSource(el); }, 500);
      setTimeout(function () { if (contextCache.has(el)) collectSource(el); }, 1500);
    } catch (e) {}
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
    updateAddBtn();

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

  function applyInstantCopyMode() {
    multiMode = !settings.instantCopy;
    if (multiActions) multiActions.classList.toggle('open', multiMode || collected.length > 0);
  }
  function setMultiMode(on) {
    // Compatibility shim: multi-pick mode is the inverse of instant copy.
    settings.instantCopy = !on;
    var box = shadow.querySelector('#opt-instantCopy');
    if (box) box.checked = settings.instantCopy;
    applyInstantCopyMode();
    autoSave();
    showToast(on ? 'Multi-pick ON — click elements to add' : 'Instant copy ON — click to copy');
  }

  function addBadge(item) {
    var rect;
    try { rect = item.el.getBoundingClientRect(); } catch (e) { return; }
    var b = document.createElement('div');
    b.className = 'ctp-badge';
    // The number gets its own span so renumbering can rewrite just that text —
    // assigning textContent on the badge itself would wipe the × out of every
    // other badge on the next removal. The base look stays inline; the hover
    // rules for the × live in injectedStyle (top of this file).
    var num = document.createElement('span');
    num.className = 'ctp-badge-n';
    num.textContent = String(item.n);
    var x = document.createElement('button');
    x.className = 'ctp-badge-x';
    x.type = 'button';
    x.textContent = '\u00d7';
    x.title = 'Remove this path';
    x.setAttribute('aria-label', 'Remove this path');
    x.addEventListener('click', function (e) {
      // The badge is not in the picker's shadow tree, so the overlay never sees
      // this click — but document-level listeners do receive it bubbled.
      e.preventDefault();
      e.stopPropagation();
      removeItem(item.el);
    });
    b.appendChild(num);
    b.appendChild(x);
    b.style.cssText = 'position:fixed;z-index:2147483647;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#FFD700;color:#1E3A5F;font:700 12px/20px -apple-system,BlinkMacSystemFont,sans-serif;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
    positionBadge(b, rect);
    // A direct child of <html>, appended after the picker host: both sit at
    // z-index 2147483647 in the root stacking context, so tree order decides —
    // and a badge parked in <body> would land *under* the overlay (and could
    // never be hovered). Keep it here.
    document.documentElement.appendChild(b);
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
      var b = collected[i].badgeEl;
      // Rewrite only the number span: assigning textContent on the badge itself
      // would blow away the × button hidden inside it.
      var n = b && b.querySelector ? b.querySelector('.ctp-badge-n') : null;
      if (n) n.textContent = String(i + 1);
    }
  }

  // ── Details (annotations), keyed by path text so they survive re-picks ──
  var NOTES_KEY = 'ctp-lite-notes';
  var notesByPath = {};
  try { notesByPath = JSON.parse(localStorage.getItem(NOTES_KEY)) || {}; } catch (e) { notesByPath = {}; }
  function saveNotes() {
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(notesByPath)); } catch (e) {}
    autoSave();
  }
  function removeNote(item, txt) {
    var arr = notesByPath[item.key] || [];
    var i = arr.indexOf(txt);
    if (i >= 0) arr.splice(i, 1);
    if (!arr.length) delete notesByPath[item.key];
    item.notes = arr;
    saveNotes();
  }
  function flashBtn(btn, label) {
    var restore = btn.textContent;
    btn.textContent = label;
    btn.classList.add('ok');
    setTimeout(function () { btn.textContent = restore; btn.classList.remove('ok'); }, 1000);
  }
  function openNoteEditor(item, body) {
    if (body.querySelector('.note-editor')) { body.querySelector('.note-input').focus(); return; }
    var ed = document.createElement('div');
    ed.className = 'note-editor';
    var input = document.createElement('input');
    input.className = 'note-input';
    input.placeholder = 'e.g. sign-in button — asserts login';
    input.maxLength = 120;
    var add = document.createElement('button');
    add.className = 'note-save';
    add.textContent = 'Add';
    ed.appendChild(input);
    ed.appendChild(add);
    body.appendChild(ed);
    input.focus();
    var commit = function () {
      var v = input.value.trim();
      if (!v) { ed.remove(); return; }
      if (!notesByPath[item.key]) notesByPath[item.key] = [];
      notesByPath[item.key].push(v);
      item.notes = notesByPath[item.key];
      saveNotes();
      renderQueue();
    };
    add.addEventListener('click', commit);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') commit();
      if (ev.key === 'Escape') ed.remove();
    });
  }
  // The ``+`` button mirrors what left-click does in multi-pick mode, so it also
  // works while the picker is frozen (when left-clicking only unfreezes).
  // `currentEl` is the frozen element while frozen (onRightClick sets it), so
  // `+` must add that — not whatever the pointer has since drifted onto.
  function addTarget() {
    return currentEl;
  }
  function canAdd() {
    var el = addTarget();
    return !!el;
  }
  function updateAddBtn() {
    if (!addBtn) return;
    var el = addTarget();
    var ok = !!el;
    addBtn.disabled = !ok;
    addBtn.title = ok
      ? 'Add ' + el.tagName.toLowerCase() + ' to picked paths'
      : 'Hover an element to add it';
    addBtn.setAttribute('aria-disabled', String(!ok));
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
        var full;
        try { full = getSelectorPath(item.el, formatMode); } catch (e) { full = '(detached)'; }
        item.key = full;
        item.notes = notesByPath[full] || [];

        var row = document.createElement('div');
        row.className = 'preview-row';

        var num = document.createElement('span');
        num.className = 'n';
        num.textContent = item.n;

        var body = document.createElement('div');
        body.className = 'preview-body';

        var p = document.createElement('span');
        p.className = 'path-text';
        p.textContent = truncatePath(full);
        p.title = full;

        var actions = document.createElement('div');
        actions.className = 'row-actions';

        var bCopy = document.createElement('button');
        bCopy.className = 'copy-one';
        bCopy.textContent = 'Copy';
        bCopy.title = 'Copy this path';
        bCopy.addEventListener('click', function (e) {
          e.stopPropagation();
          copyToClipboard(full).then(function () {
            flashBtn(bCopy, 'Copied');
            showToast('Copied path #' + item.n);
          }).catch(function () { showToast('Clipboard failed', true); });
        });

        var bNote = document.createElement('button');
        bNote.className = 'add-note';
        bNote.textContent = 'Add Details';
        bNote.title = 'Annotate what this path is for';
        bNote.addEventListener('click', function (e) { e.stopPropagation(); openNoteEditor(item, body); });

        var bView = document.createElement('button');
        bView.className = 'view-one';
        bView.textContent = 'View Path';
        bView.title = 'Show the full path';
        bView.addEventListener('click', function (e) {
          e.stopPropagation();
          var expanded = row.classList.toggle('expanded');
          p.textContent = expanded ? full : truncatePath(full);
          bView.textContent = expanded ? 'Hide Path' : 'View Path';
        });

        var bRm = document.createElement('button');
        bRm.className = 'rm-one';
        bRm.textContent = '\u00d7';
        bRm.title = 'Remove this path';
        bRm.setAttribute('aria-label', 'Remove this path');
        bRm.addEventListener('click', function (e) {
          e.stopPropagation();
          removeItem(item.el);
        });

        actions.appendChild(bCopy);
        actions.appendChild(bNote);
        actions.appendChild(bView);
        actions.appendChild(bRm);
        body.appendChild(p);
        body.appendChild(actions);

        var notes = document.createElement('div');
        notes.className = 'preview-notes';
        item.notes.forEach(function (txt) {
          var note = document.createElement('span');
          note.className = 'note';
          var s = document.createElement('span');
          s.textContent = txt;
          s.title = txt;
          var x = document.createElement('button');
          x.textContent = '\u00d7';
          x.title = 'Remove detail';
          x.addEventListener('click', function (e) {
            e.stopPropagation();
            removeNote(item, txt);
            note.remove();
          });
          note.appendChild(s);
          note.appendChild(x);
          notes.appendChild(note);
        });
        body.appendChild(notes);

        row.appendChild(num);
        row.appendChild(body);
        queueList.appendChild(row);
      })(collected[i]);
    }
    if (queueCount) queueCount.textContent = collected.length + (collected.length === 1 ? ' path' : ' paths');
    if (copyAllBtn) {
      copyAllBtn.textContent = 'Copy All';
      copyAllBtn.disabled = collected.length === 0;
    }
    // Keep the picked-paths panel visible in multi-pick mode or whenever
    // there are collected paths.
    if (multiActions) multiActions.classList.toggle('open', multiMode || collected.length > 0);
    // The toolbar's primary action follows the queue: one path copies what the
    // pointer is on, several paths copy the whole set.
    updateCopyBtn();
    if (sepSelect && sepSelect.value !== sepStyle) sepSelect.value = sepStyle;
  }

  function updateCopyBtn() {
    if (!copyBtn) return;
    var many = collected.length > 1;
    copyBtn.textContent = many ? 'Copy' : 'Copy path';
    if (settings.showPathOnCopyHover && currentPath) {
      copyBtn.title = currentPath;
    } else {
      copyBtn.title = many ? 'Copy all ' + collected.length + ' picked paths' : 'Copy path';
    }
  }

  function addItem(el) {
    if (!el) {
      showToast('Hover an element first', true);
      return;
    }
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
    updateAddBtn();
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
    var isContextMode = (formatMode === 'auto' || formatMode === 'context');
    if (isContextMode) {
      var contextBlocks = collected.map(function (item, idx) {
        try {
          return '## ' + (idx + 1) + '. Element: ' + elLabel(item.el) + '\n\n' + buildContextOutput(item.el);
        } catch (e) { return '## ' + (idx + 1) + '. Element: (detached)'; }
      });
      if (sepStyle === 'json') {
        return JSON.stringify(contextBlocks);
      }
      if (sepStyle === 'comma') return contextBlocks.join(', ');
      if (sepStyle === 'custom') {
        var js = sepCustom.replace(/\\n/g, '\n');
        return contextBlocks.join(js);
      }
      // numbered and newline both keep the block numbers; use a blank line between blocks
      return contextBlocks.join('\n\n');
    }
    var paths = collected.map(function (item) {
      try {
        if (formatMode === 'classic-context') return getClassicContextPath(item.el);
        return getSelectorPath(item.el, formatMode);
      } catch (e) { return '(detached)'; }
    });
    if (sepStyle === 'numbered') {
      return paths.map(function (p, i) { return (i + 1) + '. ' + p; }).join('\n');
    }
    if (sepStyle === 'comma') return paths.join(', ');
    if (sepStyle === 'json') {
      return JSON.stringify(paths.map(function (p, i) { return { n: i + 1, path: p }; }));
    }
    if (sepStyle === 'custom') return paths.join(sepCustom.replace(/\\n/g, '\n'));
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
    var shotTarget = currentEl || (collected.length ? collected[0].el : null);
    captureElementScreenshot(shotTarget).then(function (dataUrl) {
      var finalText = text;
      if (dataUrl) finalText += '\n- Image (base64): "' + dataUrl + '"';
      return copyToClipboard(finalText).then(function () {
        showToast('Copied ' + collected.length + ' paths (' + sepStyle + ')');
        if (copyAllBtn) copyAllBtn.textContent = 'Copied!';
        if (copyBtn) flashBtn(copyBtn, 'Copied!');
        setTimeout(renderQueue, 1200);
        if (closeAfterCopy) { dialog.classList.add('closing'); setTimeout(quit, 300); }
      });
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
    var copyText;
    if (isContextMode) {
      copyText = '## 1. Element: ' + elLabel(currentEl) + '\n\n' + buildContextOutput(currentEl);
    } else if (formatMode === 'classic-context') {
      copyText = currentPath;
    } else {
      copyText = selector;
    }
    var pct = calcTestidPercent(currentEl);
    console.log('[copy-ui-path-lite] ──────────────────────────────────────');
    console.log('[copy-ui-path-lite] COPIED TO CLIPBOARD:');
    console.log('[copy-ui-path-lite]', copyText);
    console.log('[copy-ui-path-lite] testid coverage:', pct + '%');
    console.log('[copy-ui-path-lite] ──────────────────────────────────────');
    if (!stayOpen) hidePicker();
    copyBtn.textContent = 'Copied!';
    copyBtn.classList.add('copied');
    captureElementScreenshot(currentEl).then(function (dataUrl) {
      var finalText = copyText;
      if (dataUrl) finalText += '\n- Image (base64): "' + dataUrl + '"';
      else if (settings.includeImageBase64) console.error('[copy-ui-path-lite] no screenshot data captured');
      // Keep base64 payload from making the toast preview unreadable.
      var previewText = copyText;
      return copyToClipboard(finalText).then(function () {
        var preview = previewText.length > 50 ? previewText.slice(0, 47) + '...' : previewText;
        showToast('Copied ' + formatMode + ': ' + preview + '  ' + (dataUrl ? '(image included)' : (settings.includeImageBase64 ? '(no image captured)' : '')) + '  [' + pct + '%]');
        if (stayOpen) {
          setTimeout(function () {
            updateCopyBtn();
            copyBtn.classList.remove('copied');
          }, 1200);
        } else {
          dialog.classList.add('closing');
          setTimeout(quit, 300);
        }
      });
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
    lastX = e.clientX;
    lastY = e.clientY;
    if (dragging || frozen || isNavigating) return;
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

  function unfreeze() {
    if (!frozen) return;
    frozen = false;
    dialog.classList.remove('frozen');
    overlay.classList.remove('frozen');
    showToast('Resumed hovering');
  }
  function onOverlayClick(e) {
    if (dragging) return;
    e.preventDefault();
    e.stopPropagation();
    if (frozen) { unfreeze(); return; }
    var el = elFromPoint(e.clientX, e.clientY);
    if (el) {
      updateUI(el);
      if (!settings.instantCopy) { addItem(el); return; }
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
    // Never drag by grabbing one of the bar's own controls. `e.target` is the
    // inner <svg>/glyph rather than the <button>, so match up the tree.
    // The dedicated move handle is a button but must still initiate dragging.
    var isMoveHandle = e.target.closest && e.target.closest('#moveBtn');
    if (!isMoveHandle && e.target.closest && e.target.closest('.box button')) return;
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

  copyBtn.addEventListener('click', function (e) {
    // several paths picked -> the primary action becomes "copy them all"
    if (collected.length > 1) { doCopyAll(); return; }
    doCopy(e.ctrlKey);
  });
  if (copyIdBtn) copyIdBtn.addEventListener('click', function(e) { doCopyId(e.ctrlKey); });
  quitBtn.addEventListener('click', quit);
  stepBackBtn.addEventListener('click', stepBack);
  stepNextBtn.addEventListener('click', stepNext);
  if (addBtn) addBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    // While frozen this adds the frozen element (currentEl), never whatever the
    // pointer has drifted onto. Then hand the pointer back so you can pick the
    // next path instead of having to left-click to unfreeze first.
    addItem(addTarget());
    if (frozen) { unfreeze(); updateAddBtn(); }
  });
  if (sepSelect) {
    sepSelect.addEventListener('change', function () {
      sepStyle = this.value;
      settings.sep = sepStyle;
      autoSave();
      renderQueue();
    });
  }
  if (sepCustomInput) {
    sepCustomInput.addEventListener('change', function () {
      sepCustom = this.value;
      settings.sepCustom = sepCustom;
      autoSave();
      renderQueue();
    });
  }
  if (imgResoRange) {
    imgResoRange.addEventListener('input', function () {
      settings.imageResolutionPct = this.value;
      if (imgResoVal) imgResoVal.textContent = this.value + '%';
      autoSave();
    });
  }
  if (imgCompRange) {
    imgCompRange.addEventListener('input', function () {
      settings.imageCompressionLevel = this.value;
      if (imgCompVal) imgCompVal.textContent = this.value + '%';
      autoSave();
    });
  }
  if (copyAllBtn) copyAllBtn.addEventListener('click', doCopyAll);
  if (clearBtn) clearBtn.addEventListener('click', clearQueue);
  if (closeAfterCopyBox) closeAfterCopyBox.addEventListener('change', function () {
    closeAfterCopy = this.checked;
    settings.closeAfterCopy = closeAfterCopy;
    autoSave();
  });
  if (maxDepthInput) maxDepthInput.addEventListener('change', function () {
    var v = parseInt(maxDepthInput.value, 10);
    if (!v || v < 1) v = 1;
    if (v > 200) v = 200;
    maxDepth = v;
    maxDepthInput.value = v;
    settings.maxDepth = String(v);
    autoSave();
  });
  window.addEventListener('scroll', repositionBadges, true);
  window.addEventListener('resize', repositionBadges);
  applyInstantCopyMode();
  renderQueue();
  updateAddBtn();
  updateCopyBtn();
  window.__ctp_context = {
    build: buildContextOutput,
    ensure: ensureContext,
    cache: contextCache,
    collect: collectSource,
    toggles: function () { return settings; }
  };
  window.__ctp_multi = {
    debugCopy: function () { if (currentEl) { doCopy(true); return 'called'; } return 'no currentEl'; },
    capture: function (el) { return captureElementScreenshot(el ? el : currentEl); },
    get: function () { return collected.map(function (it) { return it.el; }); },
    current: function () { return currentEl; },
    mode: function () { return multiMode; },
    setMode: setMultiMode,
    add: function (el) { addItem(el || addTarget()); },
    addEl: function (el) { addItem(el); },
    remove: removeItem,
    clear: clearQueue,
    output: buildMultiOutput,
    copyAll: doCopyAll,
    setSep: function (s) { sepStyle = s; settings.sep = s; autoSave(); renderQueue(); },
    setSepCustom: function (s) { sepCustom = s; settings.sepCustom = s; autoSave(); renderQueue(); },
    setFormat: function (m) { formatMode = m; if (currentEl) renderPathDisplay(currentEl, getZ(currentEl)); renderQueue(); }
  };
  overlay.addEventListener('mousemove', onMouseMove);
  overlay.addEventListener('click', onOverlayClick);
  overlay.addEventListener('contextmenu', onRightClick);
  dialogHeader.addEventListener('mousedown', onDragStart);
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('keydown', onKeyDown, true);
  // Settings start collapsed; opening them lands on the live path unless the
  // user last worked in another tab.
  setPanelOpen(false);
  showTab(settings.tab || 'preview');
  renderChecks();
})();
