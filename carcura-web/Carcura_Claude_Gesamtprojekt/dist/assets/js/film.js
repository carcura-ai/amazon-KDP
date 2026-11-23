/* Carcura Startseitenfilm, scrollgesteuert.
   Daten: <script id="film-data"> (erzeugt aus src/film-szenen.json). Jeder Zustand hat ein Gewicht (Scroll-Anteil),
   ein Kapitel (-1 = keine Karte) und einen Übergang zum nächsten Zustand ('wipe' nur bei gleicher Kamera, sonst 'cut').
   Szenen mit 'seq' (Bildsequenz) spielen ihre Bilder innerhalb ihres Anteils ab – so lässt sich besseres Material
   pro Szene einsetzen, ohne den Code zu ändern.
   Karten folgen dem tatsächlich angezeigten Bild, nicht nur der Scrollposition: Ist ein Bild noch nicht geladen,
   bleibt das letzte gültige Bild samt passender Karte stehen. */
(function () {
  "use strict";
  var film = document.getElementById("film");
  if (!film) return;
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var mobile = window.matchMedia("(max-width: 809px)");
  if (reduce.matches || !("IntersectionObserver" in window)) { root.classList.add("no-film"); return; }
  root.classList.add("film-on");

  var S = JSON.parse(document.getElementById("film-data").textContent);
  var stage = film.querySelector(".film-stage"), base = stage.querySelector(".f-base"), top = stage.querySelector(".f-top"),
      spray = stage.querySelector(".film-spray"), bar = stage.querySelector(".film-bar"),
      cards = Array.prototype.slice.call(film.querySelectorAll(".fcard"));
  var total = S.reduce(function (a, s) { return a + s.w; }, 0), starts = [], acc = 0;
  S.forEach(function (s) { starts.push(acc); acc += s.w; });

  /* Bildquellen je Gerät; Sequenzen als Liste */
  function list(s) { var m = mobile.matches && s.m ? s.m : null; return (m && m.length) ? m : s.d; }
  var cache = {};
  function img(src) {
    if (!cache[src]) { var im = new Image(); im.decoding = "async"; cache[src] = { ok: false, bad: false }; im.onload = function () { cache[src].ok = true; tick(); }; im.onerror = function () { cache[src].bad = true; }; im.src = src; }
    return cache[src];
  }
  var started = false;
  function preload() { if (started) return; started = true; S.forEach(function (s) { list(s).forEach(img); }); }
  new IntersectionObserver(function (e) { if (e[0].isIntersecting) preload(); }, { rootMargin: "800px 0px" }).observe(film);
  img(list(S[0])[0]); img(list(S[1])[0]);

  var shownBase = null, shownTop = null, cur = -2, ticking = false;
  function setSrc(el, src, which) {
    if (which === "b" ? shownBase === src : shownTop === src) return true;
    if (!img(src).ok) return false;                   /* noch nicht geladen: letztes gültiges Bild bleibt */
    el.src = src; if (which === "b") shownBase = src; else shownTop = src; return true;
  }
  function frameSrc(i, sub) { var l = list(S[i]); return l[Math.min(l.length - 1, Math.floor(sub * l.length))]; }
  function card(ch) {
    if (ch === cur) return; cur = ch;
    cards.forEach(function (c, k) { var on = k === ch; c.classList.toggle("on", on); c.setAttribute("aria-hidden", on ? "false" : "true"); c.querySelectorAll("a").forEach(function (a) { a.tabIndex = on ? 0 : -1; }); });
  }
  function length() { return film.offsetHeight - window.innerHeight; }
  function render() {
    ticking = false;
    var L = length(); if (L <= 0) return;
    var t = Math.max(0, Math.min(1, -film.getBoundingClientRect().top / L)) * total;
    var i = 0; while (i < S.length - 1 && t >= starts[i + 1]) i++;
    var mix = (t - starts[i]) / S[i].w, j = Math.min(S.length - 1, i + 1);
    var seq = list(S[i]).length > 1;
    /* Ruhephase am Anfang jedes Zustands, danach Übergang; Sequenzen laufen über den ganzen Anteil */
    var k = seq ? 0 : Math.max(0, Math.min(1, (mix - 0.4) / 0.45));
    var haveBase = setSrc(base, frameSrc(i, seq ? mix : 0), "b");
    var shown = haveBase ? i : -1;
    var nextOk = j !== i && setSrc(top, list(S[j])[0], "t");
    if (!seq && S[i].tr === "wipe" && nextOk) {
      top.style.opacity = "1"; top.style.clipPath = "inset(0 " + (100 - k * 100).toFixed(2) + "% 0 0)";
      spray.style.opacity = k > 0 && k < 1 ? "1" : "0";
      spray.style.transform = "translateX(" + (k * stage.clientWidth).toFixed(1) + "px)";
      if (k > 0.5) shown = j;
    } else {
      var cut = !seq && nextOk && mix >= 0.8;
      top.style.clipPath = "none"; top.style.opacity = cut ? "1" : "0"; spray.style.opacity = "0";
      if (cut) shown = j;
    }
    if (shown >= 0) card(S[shown].ch);
    bar.style.width = (t / total * 100).toFixed(2) + "%";
  }
  function tick() { if (!ticking) { ticking = true; requestAnimationFrame(render); } }
  window.addEventListener("scroll", tick, { passive: true });
  window.addEventListener("resize", tick);
  mobile.addEventListener && mobile.addEventListener("change", function () { shownBase = shownTop = null; started = false; preload(); tick(); });
  reduce.addEventListener && reduce.addEventListener("change", function () { if (reduce.matches) { root.classList.remove("film-on"); root.classList.add("no-film"); } });
  var first = list(S[0])[0]; base.src = first; shownBase = first; card(-1); tick();
})();
