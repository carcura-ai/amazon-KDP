/* Carcura Anfrage: Vorauswahl aus der URL (?leistung=Name oder ?service=id, mehrfach mit Komma),
   Versand an den bestehenden Anfrage-Endpunkt (/wp-json/ccrr/v1/lead, gleiche Felder wie bisher).
   Erfolg erst nach bestätigter Antwort des Servers. Bei Fehler bleiben alle Eingaben stehen und
   Telefon, WhatsApp und E-Mail werden mit vorbereitetem Text angeboten. Keine simulierte Übermittlung. */
(function () {
  "use strict";
  var form = document.getElementById("anfrage");
  if (!form) return;
  var ENDPOINT = form.getAttribute("data-endpoint");
  var boxes = Array.prototype.slice.call(form.querySelectorAll('input[name="leistung"]'));
  var status = document.getElementById("status"), submit = form.querySelector('button[type="submit"]'), sum = document.getElementById("selsum");
  var pick = form.querySelector('input[name="pickup"]'), pickWrap = document.getElementById("pickup-wrap");
  var q = new URLSearchParams(location.search), wanted = [];
  ["leistung", "service"].forEach(function (k) { q.getAll(k).forEach(function (v) { v.split(",").forEach(function (x) { x = x.trim().toLowerCase(); if (x) wanted.push(x); }); }); });
  boxes.forEach(function (b) {
    var name = b.value.toLowerCase(), id = (b.dataset.id || "").toLowerCase(), alias = (b.dataset.alias || "").toLowerCase().split("|");
    if (wanted.some(function (w) { return w === name || w === id || alias.indexOf(w) > -1; })) b.checked = true;
  });
  if (q.get("abholung") === "1" && pick) pick.checked = true;
  var more = document.getElementById("more-opts");
  if (more && more.querySelector("input:checked")) more.open = true;
  function val(n) { var el = form.elements[n]; return el ? String(el.value || "").trim() : ""; }
  function selected() { return boxes.filter(function (b) { return b.checked; }); }
  function refresh() {
    var s = selected();
    sum.textContent = s.length ? "Ausgewählt: " + s.map(function (b) { return b.value + (b.dataset.price ? " (" + b.dataset.price + ")" : ""); }).join(", ") + ". Den Endpreis bestätigen wir dir vorab." : "Noch keine Leistung gewählt.";
    if (pickWrap) pickWrap.hidden = !(pick && pick.checked);
  }
  form.addEventListener("change", refresh); refresh();

  function show(kind, html) { status.className = "status " + kind; status.innerHTML = html; status.focus(); }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function gclid() { try { return q.get("gclid") || sessionStorage.getItem("cc_gclid") || ""; } catch (e) { return ""; } }
  try { if (q.get("gclid")) sessionStorage.setItem("cc_gclid", q.get("gclid")); } catch (e) {}

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!selected().length) { show("err", "<b>Bitte wähle mindestens eine Leistung.</b> Oder beschreibe deinen Wunsch unter „Andere Wünsche“."); boxes[0].focus(); return; }
    if (!val("phone") && !val("email")) { show("err", "<b>Bitte gib eine Telefonnummer oder E-Mail an,</b> damit wir dir antworten können."); form.elements.phone.focus(); return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    send();
  });

  function send() {
    var services = selected().map(function (b) { return b.value; });
    if (pick && pick.checked) services.push("Hol- und Bringservice");
    var lines = ["Gewählte Leistungen:"].concat(services.map(function (s) { return "• " + s; }));
    lines.push("");
    if (val("condition")) lines.push("Zustand: " + val("condition"));
    if (val("wunschtag")) lines.push("Wunschtag: " + val("wunschtag"));
    if (val("zeitfenster")) lines.push("Zeitfenster: " + val("zeitfenster"));
    if (pick && pick.checked) { lines.push("Hol- und Bringservice: gewünscht (bis 10 km kostenlos, darüber 2 € pro km)"); if (val("pickup_ort")) lines.push("Abholort: " + val("pickup_ort")); }
    if (val("kontaktweg")) lines.push("Bevorzugter Kontakt: " + val("kontaktweg"));
    if (val("message")) { lines.push(""); lines.push("Nachricht: " + val("message")); }
    lines.push(""); lines.push("Quelle: " + location.pathname + location.search);
    var payload = { name: val("name"), email: val("email"), phone: val("phone"), vehicle: val("vehicle"), service: services.join(", "),
      message: lines.join("\n"), customer_type: val("customer_type") === "firma" ? "firma" : "privat", source: "anfrage_formular", channel: "web", gclid: gclid(), website: val("website") };
    submit.disabled = true; var label = submit.textContent; submit.textContent = "Wird gesendet …";
    var ctrl = "AbortController" in window ? new AbortController() : null, to = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);
    fetch(ENDPOINT, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error("http_" + r.status); return r.json().catch(function () { return {}; }); })
      .then(function (data) {
        /* Wie das bisherige Formular: HTTP 2xx vom Endpunkt und kein ok:false = angenommen */
        if (data && data.ok === false) throw new Error("abgelehnt");
        if (typeof window.gtag === "function") window.gtag("event", "cc_anfrage", { cc_services: services.join("|") });
        show("ok", "<b>Danke, deine Anfrage ist bei uns angekommen.</b> Wir prüfen deine Angaben persönlich und melden uns mit Einschätzung, Preis und Terminvorschlag. Das ist noch keine Terminbestätigung.");
        form.reset(); refresh();
      })
      .catch(function () {
        var t = "Hallo Carcura, ich möchte anfragen: " + services.join(", ") + (val("vehicle") ? ". Fahrzeug: " + val("vehicle") : "") + (val("message") ? ". " + val("message") : "");
        var mail = "mailto:carcura@web.de?subject=" + encodeURIComponent("Anfrage Fahrzeugaufbereitung") + "&body=" + encodeURIComponent(lines.join("\n") + "\n\nName: " + val("name") + "\nTelefon: " + val("phone"));
        show("err", "<b>Das Senden hat gerade nicht geklappt.</b> Deine Eingaben bleiben stehen. Versuch es gleich noch einmal oder erreiche uns direkt: " +
          '<a href="tel:+491706669516">0170 6669516 anrufen</a> · <a href="https://wa.me/491706669516?text=' + encodeURIComponent(t) + '" target="_blank" rel="noopener">per WhatsApp (Text vorbereitet)</a> · <a href="' + esc(mail) + '">per E-Mail (Angaben eingetragen)</a>');
      })
      .then(function () { clearTimeout(to); submit.disabled = false; submit.textContent = label; });
  }
})();
