/* Carcura Scroll-Film: eine Fortschrittsquelle (Scrollposition), Einzelbilder auf fester Blickachse.
   Gleiche Blickachse (Waschzustände, Innen, Politur) = gerichtete Freilegung per Clip-Kante.
   Abweichende Blickwinkel = harter Schnitt, damit keine Doppelkanten am Fahrzeug entstehen.
   Bei reduzierter Bewegung oder Ladefehlern bleibt die statische Bildfolge mit allen Texten sichtbar. */
(function () {
  "use strict";
  var film = document.getElementById("film");
  if (!film) return;
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var F = JSON.parse(document.getElementById("film-data").textContent);
  var N = F.length;
  if (reduce.matches || !("IntersectionObserver" in window)) { root.classList.add("no-film"); return; }

  var stage = film.querySelector(".film-stage"), base = stage.querySelector(".f-base"), top = stage.querySelector(".f-top"),
      spray = stage.querySelector(".film-spray"), bar = stage.querySelector(".film-bar"),
      lab = stage.querySelector(".f-label"), h = stage.querySelector(".f-title"), p = stage.querySelector(".f-text"), pr = stage.querySelector(".f-price"),
      btns = Array.prototype.slice.call(stage.querySelectorAll(".film-nav button"));
  var imgs = [], loaded = false, cb = -1, ct = -1, shown = -1, ticking = false;

  function load() {
    if (loaded) return; loaded = true;
    F.forEach(function (f, i) { var im = new Image(); im.decoding = "async"; im.src = f.src; im.onerror = function () { f.broken = true; }; imgs[i] = im; });
  }
  new IntersectionObserver(function (es) { if (es[0].isIntersecting) load(); }, { rootMargin: "1200px 0px" }).observe(film);

  function src(i) { var f = F[i]; return f.broken ? null : f.src; }
  function setImg(el, i, key) {
    if ((key === "b" ? cb : ct) === i) return;
    var s = src(i); if (!s) return; /* fehlendes Bild: letztes gültiges bleibt stehen */
    el.src = s; el.alt = ""; if (key === "b") cb = i; else ct = i;
  }
  function text(i) {
    if (shown === i) return; shown = i; var f = F[i];
    lab.textContent = f.label; h.textContent = f.title; p.textContent = f.text;
    pr.innerHTML = f.price ? f.price + (f.href ? ' · <a href="' + f.href + '">' + f.link + "</a>" : "") : "";
    btns.forEach(function (b) { if (+b.dataset.chapter === f.chapter) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); });
  }
  function render(prog) {
    var i = Math.min(N - 1, Math.floor(prog)), mix = prog - i, j = Math.min(N - 1, i + 1);
    setImg(base, i, "b"); setImg(top, j, "t");
    var wipe = F[i].trans === "wipe" && j !== i;
    /* Ruhephase am Anfang jedes Bildes, dann Übergang */
    var k = Math.max(0, Math.min(1, (mix - 0.32) / 0.5));
    if (wipe) {
      top.style.opacity = "1";
      top.style.clipPath = "inset(0 " + (100 - k * 100).toFixed(2) + "% 0 0)";
      spray.style.opacity = k > 0 && k < 1 ? "1" : "0";
      spray.style.left = (k * 100).toFixed(2) + "%";
    } else {
      var cut = mix >= 0.62 && j !== i;
      top.style.clipPath = "none"; top.style.opacity = cut ? "1" : "0"; spray.style.opacity = "0";
    }
    text(wipe ? (k > 0.5 ? j : i) : (mix >= 0.62 ? j : i));
    bar.style.width = (prog / (N - 1) * 100).toFixed(2) + "%";
  }
  function length() { return film.offsetHeight - window.innerHeight; }
  function update() {
    ticking = false;
    var r = film.getBoundingClientRect(), L = length();
    if (L <= 0) return;
    var t = Math.max(0, Math.min(1, -r.top / L));
    render(t * (N - 1));
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener("resize", update);
  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      load();
      var i = +b.dataset.frame, y = film.getBoundingClientRect().top + window.pageYOffset + length() * (i + 0.05) / (N - 1);
      window.scrollTo({ top: y, behavior: "smooth" });
    });
  });
  reduce.addEventListener && reduce.addEventListener("change", function () { if (reduce.matches) root.classList.add("no-film"); });
  render(0); update();
})();
