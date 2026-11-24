/* Carcura Außenwäsche-Film: Pause/Abspielen, Sprung zu Phasen, Handy-Poster, reduzierte Bewegung.
   Das Video selbst ist ein normales <video> mit autoplay muted loop playsinline; ohne JavaScript läuft es trotzdem. */
(function () {
  "use strict";
  var v = document.getElementById("wash");
  if (!v) return;
  var btn = document.querySelector(".vplay"), txt = btn.querySelector(".vplay-t");
  var chips = Array.prototype.slice.call(document.querySelectorAll(".vchip"));
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (window.matchMedia("(max-width: 809px)").matches && v.dataset.posterMobil) v.poster = v.dataset.posterMobil;

  function state() {
    var playing = !v.paused && !v.ended;
    btn.setAttribute("aria-pressed", playing ? "false" : "true");
    btn.setAttribute("aria-label", playing ? "Film pausieren" : "Film abspielen");
    txt.textContent = playing ? "Pause" : "Abspielen";
    btn.classList.toggle("is-paused", !playing);
  }
  function phase() {
    var t = v.currentTime, cur = 0;
    chips.forEach(function (c, i) { if (t >= +c.dataset.t - 0.05) cur = i; });
    chips.forEach(function (c, i) { c.setAttribute("aria-pressed", i === cur ? "true" : "false"); });
  }
  btn.addEventListener("click", function () { if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause(); });
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      v.currentTime = +c.dataset.t + 0.01; phase();
      if (v.paused && !reduce.matches) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    });
  });
  ["play", "pause", "ended"].forEach(function (e) { v.addEventListener(e, state); });
  v.addEventListener("timeupdate", phase);
  /* Reduzierte Bewegung: kein Autoplay, Posterbild bleibt stehen, Abspielen nur auf Wunsch */
  function applyReduce() { if (reduce.matches) { v.removeAttribute("autoplay"); v.pause(); } }
  applyReduce();
  reduce.addEventListener && reduce.addEventListener("change", applyReduce);
  /* Pausieren, wenn der Film nicht sichtbar ist (spart Akku), beim Zurückkehren nur fortsetzen, wenn nicht manuell pausiert */
  var userPaused = false;
  btn.addEventListener("click", function () { userPaused = v.paused; });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      var vis = es[0].isIntersecting;
      if (!vis && !v.paused) v.pause();
      else if (vis && v.paused && !userPaused && !reduce.matches) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    }, { threshold: 0.25 }).observe(v);
  }
  state(); phase();
})();
