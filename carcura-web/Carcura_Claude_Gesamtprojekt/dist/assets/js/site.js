/* Carcura – gemeinsame Funktionen: Menü, Einblenden, Vorher/Nachher, Abholrechner, Galerie, Aktionsende, Klick-Messung. */
(function () {
  "use strict";
  var d = document, root = d.documentElement;
  root.classList.add("js");

  /* Menü: Mehr-Ausklapper (Desktop) und Vollbildmenü (Mobil), mit Escape und Fokusrückgabe */
  var more = d.querySelector(".nav-more");
  if (more) {
    var mb = more.querySelector("button");
    mb.addEventListener("click", function () { var o = more.classList.toggle("open"); mb.setAttribute("aria-expanded", String(o)); });
    d.addEventListener("click", function (e) { if (!more.contains(e.target)) { more.classList.remove("open"); mb.setAttribute("aria-expanded", "false"); } });
  }
  var drawer = d.getElementById("drawer"), opener = d.querySelector(".menu-btn");
  function closeDrawer() { if (!drawer || !drawer.classList.contains("open")) return; drawer.classList.remove("open"); opener.setAttribute("aria-expanded", "false"); d.body.style.overflow = ""; opener.focus(); }
  if (drawer && opener) {
    opener.addEventListener("click", function () { drawer.classList.add("open"); opener.setAttribute("aria-expanded", "true"); d.body.style.overflow = "hidden"; var f = drawer.querySelector("a,button"); if (f) f.focus(); });
    drawer.querySelector(".drawer-close").addEventListener("click", closeDrawer);
    drawer.addEventListener("click", function (e) { if (e.target.closest("a")) { drawer.classList.remove("open"); d.body.style.overflow = ""; opener.setAttribute("aria-expanded", "false"); } });
    drawer.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var f = drawer.querySelectorAll("a,button"), a = f[0], z = f[f.length - 1];
      if (e.shiftKey && d.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && d.activeElement === z) { e.preventDefault(); a.focus(); }
    });
  }
  d.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeDrawer(); if (more) { more.classList.remove("open"); } } });

  /* Abschnitte sanft einblenden */
  var rv = d.querySelectorAll(".rv");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { rootMargin: "0px 0px -8% 0px" });
    rv.forEach(function (el) { io.observe(el); });
  } else rv.forEach(function (el) { el.classList.add("in"); });

  /* Vorher/Nachher-Regler: natives range-Feld, per Tastatur bedienbar */
  d.querySelectorAll(".ba input").forEach(function (r) {
    var box = r.closest(".ba");
    function set() { box.style.setProperty("--p", r.value + "%"); }
    r.addEventListener("input", set); set();
  });

  /* Abholrechner: max(0, km - 10) * 2, Hin- und Rückfahrt inklusive */
  d.querySelectorAll("[data-calc]").forEach(function (c) {
    var r = c.querySelector("input"), o = c.querySelector("output"), k = c.querySelector("[data-km]");
    function upd() {
      var km = +r.value, p = Math.max(0, km - 10) * 2;
      o.textContent = p === 0 ? "0 € – kostenlos" : p + " €";
      k.textContent = km + " km";
    }
    r.addEventListener("input", upd); upd();
  });

  /* Galerie mit Lightbox (Pfeiltasten, Escape) */
  var lb = d.getElementById("lb");
  if (lb) {
    var items = Array.prototype.slice.call(d.querySelectorAll(".gal button")), cur = 0, last = null;
    var img = lb.querySelector("img"), cap = lb.querySelector("p");
    function show(i) { cur = (i + items.length) % items.length; var b = items[cur]; img.src = b.dataset.full; img.alt = b.querySelector("img").alt; cap.textContent = b.dataset.cap || ""; }
    function close() { lb.classList.remove("open"); d.body.style.overflow = ""; if (last) last.focus(); }
    items.forEach(function (b, i) { b.addEventListener("click", function () { last = b; show(i); lb.classList.add("open"); d.body.style.overflow = "hidden"; lb.querySelector(".lb-x").focus(); }); });
    lb.querySelector(".lb-x").addEventListener("click", close);
    lb.querySelector(".lb-p").addEventListener("click", function () { show(cur - 1); });
    lb.querySelector(".lb-n").addEventListener("click", function () { show(cur + 1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    d.addEventListener("keydown", function (e) { if (!lb.classList.contains("open")) return; if (e.key === "Escape") close(); if (e.key === "ArrowLeft") show(cur - 1); if (e.key === "ArrowRight") show(cur + 1); });
    var filters = d.querySelectorAll("[data-filter]");
    filters.forEach(function (f) {
      f.addEventListener("click", function () {
        filters.forEach(function (x) { x.setAttribute("aria-pressed", String(x === f)); });
        var v = f.dataset.filter;
        d.querySelectorAll(".gal figure").forEach(function (fg) { fg.hidden = !(v === "alle" || fg.dataset.cat.indexOf(v) > -1); });
      });
    });
  }

  /* gclid seitenweit merken (Format wie bisher live: localStorage ccrr_gclid {v,t}) */
  try { var g = new URLSearchParams(location.search).get("gclid"); if (g) localStorage.setItem("ccrr_gclid", JSON.stringify({ v: g, t: Date.now() })); } catch (e) {}

  /* Aktionen nach Enddatum ausblenden (zusätzlich zum Build-Datum) */
  var now = new Date();
  d.querySelectorAll("[data-ende]").forEach(function (el) { if (now >= new Date(el.getAttribute("data-ende"))) el.remove(); });

  /* Klick-Messung: nur wenn auf der Live-Seite ein Google-Tag mit Einwilligung geladen ist.
     Ereignisnamen wie die bestehenden Conversions (cc_whatsapp, cc_anruf). Kein eigenes Tracking. */
  d.addEventListener("click", function (e) {
    var a = e.target.closest("a"); if (!a || typeof window.gtag !== "function") return;
    var h = a.getAttribute("href") || "";
    if (h.indexOf("wa.me") > -1) window.gtag("event", "cc_whatsapp", { cc_service: a.dataset.service || "", cc_page: location.pathname });
    else if (h.indexOf("tel:") === 0) window.gtag("event", "cc_anruf", { cc_service: a.dataset.service || "", cc_page: location.pathname });
  });
})();
