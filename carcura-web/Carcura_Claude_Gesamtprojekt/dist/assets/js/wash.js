/* Carcura Außenwäsche als Scroll-Effekt. Kein Video, keine Bedienelemente: Die Scrollposition bestimmt den Waschzustand.
   Vier Zustandsbilder + Verlaufskarte (src/video/build_scroll_assets.py), gemischt per WebGL (Schaum und Spülwasser laufen
   von oben nach unten, das Abtrocknen erfolgt fleckig). Ohne WebGL: weiche Überblendung im Canvas.
   Ohne JavaScript oder bei reduzierter Bewegung bleibt das Standbild (sauber) stehen. */
(function () {
  "use strict";
  var sec = document.getElementById("film");
  if (!sec || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var base = sec.getAttribute("data-base");
  var set = window.matchMedia("(max-width: 809px)").matches ? "m/" : "d/";
  var fig = sec.querySelector(".wash-fig"), cv = sec.querySelector(".wash-cv");
  var img = sec.querySelector(".wash-img"), srcEl = sec.querySelector(".wash-fig source");
  var lbl = sec.querySelector(".wash-lbl"), step = sec.querySelector(".wash-step"), bar = sec.querySelector(".wash-bar i");

  /* Zeitplan über die Scrollstrecke: [Art, Zustand, Anteil]. h = stehen, g = Schwerkraftfront, d = Abtrocknen */
  var T = [["h", 0, .10], ["g", 0, .20], ["h", 1, .08], ["g", 1, .20], ["h", 2, .07], ["d", 2, .17], ["h", 3, .18]];
  var LBL = ["Vorher", "Schaumvorwäsche", "Abspülen", "Trocknen", "Sauber"], LIDX = [0, 1, 1, 2, 2, 3, 4];

  /* Start im verschmutzten Zustand (das HTML zeigt für Nutzer ohne JavaScript das saubere Ergebnis) */
  if (srcEl) srcEl.srcset = base + "m/0.webp";
  img.src = base + "d/0.webp";
  sec.classList.add("on");

  function ease(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }
  function at(p) {
    var acc = 0;
    for (var i = 0; i < T.length; i++) {
      if (p <= acc + T[i][2] || i === T.length - 1) return { seg: i, kind: T[i][0], st: T[i][1], t: ease((p - acc) / T[i][2]) };
      acc += T[i][2];
    }
  }

  var target = 0, cur = -1, raf = 0, draw = null, iw = 1, ih = 1, lastL = -1;
  function progress() {
    var r = sec.getBoundingClientRect(), run = sec.offsetHeight - window.innerHeight;
    return run > 0 ? Math.min(1, Math.max(0, -r.top / run)) : 0;
  }
  function hud(p, s) {
    var l = LIDX[s.seg];
    if (l !== lastL) { lastL = l; lbl.textContent = LBL[l]; step.textContent = (l + 1) + "/5"; }
    bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
    sec.classList.toggle("moved", p > 0.015);
  }
  var last = 0;
  function tick(now) {
    raf = 0;
    /* Nachlauf zeitbasiert (unabhängig von der Bildrate): nach ca. 0,3 s ist die Scrollposition erreicht */
    var dt = last && now ? Math.min(250, now - last) : 16.7;
    last = now || 0;
    cur = cur < 0 ? target : cur + (target - cur) * (1 - Math.pow(0.78, dt / 16.7));
    if (Math.abs(target - cur) < 0.0004) cur = target;
    var s = at(cur);
    hud(cur, s);
    if (draw) draw(s);
    if (cur !== target) raf = requestAnimationFrame(tick); else last = 0;
  }
  function onScroll() { target = progress(); if (!raf) raf = requestAnimationFrame(tick); }

  /* Bildausschnitt: Bild füllt die Fläche (cover), vertikal etwas unter der Mitte verankert wie im Video */
  function cover() {
    var ca = cv.width / cv.height, ia = iw / ih;
    return ca > ia ? [1, ia / ca, 0, (1 - ia / ca) * 0.55] : [ca / ia, 1, (1 - ca / ia) * 0.5, 0];
  }
  function size() {
    var r = fig.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.min(2560, Math.round(r.width * d)), h = Math.min(1600, Math.round(r.height * d));
    if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; return true; }
    return false;
  }

  function load(src) {
    return new Promise(function (ok, no) { var i = new Image(); i.decoding = "async"; i.onload = function () { ok(i); }; i.onerror = no; i.src = src; });
  }
  Promise.all([0, 1, 2, 3].map(function (k) { return load(base + set + k + ".webp"); }).concat(load(base + "field.png"))).then(function (im) {
    iw = im[0].naturalWidth; ih = im[0].naturalHeight;
    size();
    draw = webgl(im) || canvas2d(im);
    if (!draw) return;
    cur = -1; tick();
    sec.classList.add("ready");
  }).catch(function () { /* Bilder fehlen: Standbild bleibt */ });

  function webgl(im) {
    var gl = cv.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false });
    if (!gl) return null;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, "attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}"));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER,
      "precision mediump float;varying vec2 v;uniform sampler2D A,B,F;uniform float t,k;uniform vec4 u;" +
      "void main(){vec2 q=v*u.xy+u.zw;vec3 a=texture2D(A,q).rgb,b=texture2D(B,q).rgb;vec2 f=texture2D(F,q).rg;float m;" +
      "if(k<.5){m=clamp((-.12+1.3*t-(q.y-(f.r*.3-.1)))/.06,0.,1.);}else{m=clamp((1.25*t-.1-(f.g*.75+q.y*.35))/.08,0.,1.);}" +
      "gl_FragColor=vec4(mix(a,b,m),1.);}"));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, "p");
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var tex = [];
    try {
      im.forEach(function (i) {
        var t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, i);
        tex.push(t);
      });
    } catch (e) { /* z. B. file:// ohne Server: Bilder gelten als fremd. Frisches Canvas für die 2D-Überblendung */
      var n = cv.cloneNode(false); cv.parentNode.replaceChild(n, cv); cv = n; size(); return null;
    }
    var U = {}; ["A", "B", "F", "t", "k", "u"].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
    gl.uniform1i(U.A, 0); gl.uniform1i(U.B, 1); gl.uniform1i(U.F, 2);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tex[4]);
    return function (s) {
      var hold = s.kind === "h";
      gl.viewport(0, 0, cv.width, cv.height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[s.st]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex[hold ? s.st : s.st + 1]);
      gl.uniform1f(U.t, hold ? 0 : s.t); gl.uniform1f(U.k, s.kind === "d" ? 1 : 0);
      gl.uniform4fv(U.u, cover());
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
  }

  function canvas2d(im) {
    var c = cv.getContext("2d");
    if (!c) return null;
    return function (s) {
      var u = cover(), sx = u[2] * iw, sy = u[3] * ih, sw = u[0] * iw, sh = u[1] * ih;
      c.globalAlpha = 1; c.drawImage(im[s.st], sx, sy, sw, sh, 0, 0, cv.width, cv.height);
      if (s.kind !== "h") { c.globalAlpha = s.t; c.drawImage(im[s.st + 1], sx, sy, sw, sh, 0, 0, cv.width, cv.height); }
    };
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { if (size() && draw) { cur = -1; tick(); } onScroll(); });
  onScroll();
})();
