"""Carcura-Mailing an Firmen mit Firmenwagen und Leasingrückläufern.

Baut pro Empfänger eine personalisierte HTML-Mail (plus Nur-Text-Fassung) und
verschickt sie einzeln über den Carcura Mail-Relay (ab Version 1.1.0).

  python3 mailing.py demo <ausgabe.html>                    Vorschau mit Musterfirma
  python3 mailing.py senden <empfaenger.json> <ergebnis.json>

empfaenger.json: [{"firma": "...", "ort": "...", "email": "...", "anrede": "Herr Müller"}]
"anrede" ist optional, ohne sie beginnt die Mail mit "Guten Tag,".
Anmeldung am Relay übernimmt der Proxy der Umgebung, alternativ
CARCURA_WP_USER und CARCURA_WP_APP_PASSWORD.
"""

import html
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
from urllib.parse import quote

RELAY = "https://carcura.info/wp-json/carcura-mail/v1"
UPLOADS = "https://carcura.info/wp-content/uploads/2026/10"
LOGO = f"{UPLOADS}/carcura-mail-logo.png"
CARD_FRONT = f"{UPLOADS}/carcura-visitenkarte-vorderseite.jpg"
CARD_BACK = f"{UPLOADS}/carcura-visitenkarte-rueckseite.jpg"
VCARD = f"{RELAY}/vcard"
CAMPAIGN = "firmenflotte_2026_10"
GAP_SECONDS = 22  # Relay verlangt mindestens 20 Sekunden zwischen zwei Mails

FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
INK = "#09090A"
YELLOW = "#E8F320"


def slug(text):
    text = unicodedata.normalize("NFKD", text.replace("ß", "ss")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60]


def tracked(url, firma):
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}utm_source=email&utm_medium=email&utm_campaign={CAMPAIGN}&utm_content={slug(firma)}"


def subject(r):
    return f"Carcura stellt sich vor – Fuhrparkpflege für {r['firma']}"


def greeting(r):
    anrede = (r.get("anrede") or "").strip()
    return f"Guten Tag {anrede}," if anrede else "Guten Tag,"


def whatsapp(r):
    return "https://wa.me/491706669516?text=" + quote(f"Hallo Carcura, es geht um unsere Firmenwagen ({r['firma']}).")


def text_version(r):
    return f"""{greeting(r)}

wir möchten uns kurz bei Ihnen vorstellen: Wir sind Richy Schumacher und Alexander Fuchs von der Carcura GbR, Fahrzeugaufbereitung aus Walterschen. In unserer eigenen Halle bereiten wir Fahrzeuge von Hand auf, ohne Waschstraße.

Für Unternehmen mit Firmenwagen übernehmen wir vor allem zwei Dinge:

1. Fuhrparkpflege im festen Rhythmus
Innen- und Außenreinigung Ihrer Firmenwagen, zum Beispiel alle zwei oder vier Wochen. Ihr Team fährt gepflegte Autos, und beim Kunden steht ein Wagen, der zu Ihrem Unternehmen passt.

2. Aufbereitung vor der Leasingrückgabe
Bei der Rückgabe wird das Fahrzeug begutachtet: Lack, Innenraum, Geruch. Wir bereiten es vorher gründlich auf, von Polstern und Innenraum über die Ozonbehandlung gegen Rauch- und Tiergeruch bis zu Scheinwerfern und Politur. Was sich mit Pflege beheben lässt, beheben wir vor dem Termin.

Außerdem: Keramikversiegelung für neue Fahrzeuge, Tierhaarentfernung, Lederpflege.

So läuft es:
- Wir holen die Fahrzeuge an Ihrem Standort in {r['ort']} ab.
- Wir bereiten sie in unserer Halle in Walterschen auf.
- Sie bekommen sie zum vereinbarten Termin zurück.

Ihr Standort liegt nur wenige Kilometer von unserer Halle entfernt. Im Umkreis von 10 km holen wir kostenlos ab.

Die Konditionen richten sich nach Anzahl der Fahrzeuge und Rhythmus. Am besten überzeugen Sie sich an einem Fahrzeug selbst.

Termin vereinbaren: {tracked('https://carcura.info/firmenkunde/', r['firma'])}
Oder direkt anrufen: 0170 6669516

Viele Grüße
Richy Schumacher und Alexander Fuchs

Carcura GbR – Fahrzeugaufbereitung
Hauptstr. 7, 57632 Walterschen
Tel. 0170 6669516 · carcura@web.de · carcura.info
Kontakt speichern: {VCARD}

Sie möchten keine weiteren Infos von uns? Eine kurze Antwort auf diese Mail genügt."""


def html_version(r):
    e = lambda s: html.escape(str(s), quote=True)
    firma, ort = e(r["firma"]), e(r["ort"])
    p = f"margin:0 0 16px;font-family:{FONT};font-size:16px;line-height:1.6;color:#2a2b2e;"
    cta = e(tracked("https://carcura.info/firmenkunde/", r["firma"]))
    anfrage = e(tracked("https://carcura.info/anfragen/", r["firma"]))
    home = e(tracked("https://carcura.info/", r["firma"]))

    def feature(title, body):
        return f"""
<tr><td style="padding:0 32px 12px;" class="px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
    <tr><td style="background:#f6f5f0;border-left:4px solid {YELLOW};border-radius:0 10px 10px 0;padding:18px 20px;">
      <p style="margin:0 0 6px;font-family:{FONT};font-size:17px;line-height:1.35;font-weight:700;color:{INK};">{title}</p>
      <p style="margin:0;font-family:{FONT};font-size:15px;line-height:1.6;color:#3a3b3f;">{body}</p>
    </td></tr>
  </table>
</td></tr>"""

    def step(n, body):
        return f"""
    <tr>
      <td width="40" valign="top" style="padding:0 0 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="28" height="28" align="center" valign="middle" style="width:28px;height:28px;background:{INK};border-radius:14px;font-family:{FONT};font-size:14px;font-weight:700;color:{YELLOW};">{n}</td>
        </tr></table>
      </td>
      <td valign="top" style="padding:4px 0 12px;font-family:{FONT};font-size:15px;line-height:1.5;color:#2a2b2e;">{body}</td>
    </tr>"""

    chips = "".join(
        f'<span style="display:inline-block;margin:0 6px 8px 0;padding:6px 12px;border:1px solid #dcdbd4;border-radius:999px;font-family:{FONT};font-size:13px;line-height:1.2;color:#3a3b3f;white-space:nowrap;">{c}</span>'
        for c in ("Keramikversiegelung für neue Fahrzeuge", "Tierhaarentfernung", "Lederpflege", "Scheinwerferaufbereitung")
    )

    card_img = lambda src, alt, href: f"""<!--[if mso]><td width="270" valign="top"><![endif]-->
<div class="card" style="display:inline-block;width:100%;max-width:270px;vertical-align:top;padding:6px;">
  <a href="{href}" style="text-decoration:none;"><img src="{src}" width="270" alt="{alt}" style="display:block;width:100%;max-width:270px;height:auto;border:0;border-radius:12px;color:#cfd0d4;font-family:{FONT};font-size:13px;"></a>
</div>
<!--[if mso]></td><![endif]-->"""

    return f"""<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{e(subject(r))}</title>
<style>
  body {{ margin:0; padding:0; -webkit-text-size-adjust:100%; }}
  a {{ color:{INK}; }}
  @media (max-width:620px) {{
    .px {{ padding-left:20px !important; padding-right:20px !important; }}
    .h1 {{ font-size:25px !important; }}
    .card {{ max-width:100% !important; }}
    .card img {{ max-width:100% !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background:#ecebe6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">Fuhrparkpflege und Aufbereitung vor der Leasingrückgabe – wir holen in {ort} ab und bringen zurück.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ecebe6;">
<tr><td align="center" style="padding:24px 10px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

<tr><td style="background:{INK};border-radius:16px 16px 0 0;padding:26px 32px 22px;" class="px">
  <a href="{home}" style="text-decoration:none;"><img src="{LOGO}" width="180" alt="CARCURA Fahrzeugaufbereitung" style="display:block;width:180px;height:auto;border:0;color:#ffffff;font-family:{FONT};font-size:22px;font-weight:700;"></a>
</td></tr>
<tr><td style="background:{YELLOW};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>

<tr><td style="background:#ffffff;padding:34px 32px 6px;" class="px">
  <p style="margin:0 0 10px;font-family:{FONT};font-size:12px;line-height:1.4;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6b6c70;">Für {firma} · {ort}</p>
  <h1 class="h1" style="margin:0 0 22px;font-family:{FONT};font-size:29px;line-height:1.2;font-weight:800;color:{INK};">Firmenwagen gepflegt.<br><span style="background:linear-gradient(transparent 62%,{YELLOW} 62%);">Leasingautos rückgabefertig.</span></h1>
  <p style="{p}">{e(greeting(r))}</p>
  <p style="{p}">wir möchten uns kurz bei Ihnen vorstellen: Wir sind Richy Schumacher und Alexander Fuchs von der Carcura GbR, Fahrzeugaufbereitung aus Walterschen. In unserer eigenen Halle bereiten wir Fahrzeuge von Hand auf, ohne Waschstraße.</p>
  <p style="{p}">Für Unternehmen mit Firmenwagen übernehmen wir vor allem zwei Dinge:</p>
</td></tr>
<tr><td style="background:#ffffff;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
{feature("Fuhrparkpflege im festen Rhythmus", "Innen- und Außenreinigung Ihrer Firmenwagen, zum Beispiel alle zwei oder vier Wochen. Ihr Team fährt gepflegte Autos, und beim Kunden steht ein Wagen, der zu Ihrem Unternehmen passt.")}
{feature("Aufbereitung vor der Leasingrückgabe", "Bei der Rückgabe wird das Fahrzeug begutachtet: Lack, Innenraum, Geruch. Wir bereiten es vorher gründlich auf, von Polstern und Innenraum über die Ozonbehandlung gegen Rauch- und Tiergeruch bis zu Scheinwerfern und Politur. Was sich mit Pflege beheben lässt, beheben wir vor dem Termin.")}
</table></td></tr>

<tr><td style="background:#ffffff;padding:6px 32px 18px;" class="px">
  <p style="margin:0 0 8px;font-family:{FONT};font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b6c70;">Außerdem</p>
  {chips}
</td></tr>

<tr><td style="background:#ffffff;padding:6px 32px 8px;" class="px">
  <p style="margin:0 0 14px;font-family:{FONT};font-size:19px;line-height:1.3;font-weight:800;color:{INK};">So läuft es</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    {step(1, f"Wir holen die Fahrzeuge an Ihrem Standort in {ort} ab.")}
    {step(2, "Wir bereiten sie in unserer Halle in Walterschen auf.")}
    {step(3, "Sie bekommen sie zum vereinbarten Termin zurück.")}
  </table>
  <p style="{p}">Ihr Standort liegt nur wenige Kilometer von unserer Halle entfernt. <strong style="color:{INK};">Im Umkreis von 10&nbsp;km holen wir kostenlos ab.</strong></p>
  <p style="{p}">Die Konditionen richten sich nach Anzahl der Fahrzeuge und Rhythmus. Am besten überzeugen Sie sich an einem Fahrzeug selbst.</p>
</td></tr>

<tr><td style="background:#ffffff;padding:4px 32px 10px;" class="px">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="background:{YELLOW};border-radius:10px;">
      <a href="{cta}" style="display:inline-block;padding:15px 26px;font-family:{FONT};font-size:16px;font-weight:800;color:{INK};text-decoration:none;border-radius:10px;">Termin vereinbaren&nbsp;→</a>
    </td>
  </tr></table>
  <p style="margin:14px 0 0;font-family:{FONT};font-size:15px;line-height:1.6;color:#3a3b3f;">Oder direkt anrufen: <a href="tel:+491706669516" style="color:{INK};font-weight:700;text-decoration:none;">0170&nbsp;6669516</a> · <a href="{e(whatsapp(r))}" style="color:{INK};font-weight:700;">WhatsApp</a></p>
</td></tr>

<tr><td style="background:#ffffff;padding:24px 32px 34px;" class="px">
  <p style="margin:0 0 4px;font-family:{FONT};font-size:16px;line-height:1.6;color:#2a2b2e;">Viele Grüße</p>
  <p style="margin:0;font-family:{FONT};font-size:16px;line-height:1.5;font-weight:700;color:{INK};">Richy Schumacher und Alexander Fuchs</p>
  <p style="margin:0;font-family:{FONT};font-size:14px;line-height:1.5;color:#6b6c70;">Carcura GbR · Fahrzeugaufbereitung</p>
</td></tr>

<tr><td align="center" style="background:#111113;border-radius:0 0 16px 16px;padding:26px 14px 28px;">
  <p style="margin:0 0 12px;font-family:{FONT};font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#9a9ca3;">Unsere Visitenkarte</p>
  <!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><![endif]-->
  {card_img(CARD_FRONT, "Carcura Visitenkarte – Vorderseite", home)}{card_img(CARD_BACK, "Carcura Visitenkarte – Rückseite: carcura.info, 0170 6669516, Hauptstr. 7, 57632 Walterschen", anfrage)}
  <!--[if mso]></tr></table><![endif]-->
  <p style="margin:16px 0 0;font-family:{FONT};font-size:14px;line-height:1.8;color:#cfd0d4;">
    <a href="{VCARD}" style="color:{YELLOW};font-weight:700;text-decoration:none;">Kontakt speichern</a>
    &nbsp;·&nbsp; <a href="tel:+491706669516" style="color:{YELLOW};font-weight:700;text-decoration:none;">0170&nbsp;6669516</a>
    &nbsp;·&nbsp; <a href="{home}" style="color:{YELLOW};font-weight:700;text-decoration:none;">carcura.info</a>
  </p>
</td></tr>

<tr><td align="center" style="padding:18px 20px 6px;">
  <p style="margin:0 0 6px;font-family:{FONT};font-size:12px;line-height:1.6;color:#7a7b80;">Carcura GbR – Alexander Fuchs und Richy Schumacher · Hauptstr. 7 · 57632 Walterschen · <a href="mailto:carcura@web.de" style="color:#7a7b80;">carcura@web.de</a></p>
  <p style="margin:0;font-family:{FONT};font-size:12px;line-height:1.6;color:#7a7b80;">Sie möchten keine weiteren Infos von uns? Eine kurze Antwort auf diese Mail genügt.</p>
</td></tr>

</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>"""


def curl(args):
    auth = []
    if os.environ.get("CARCURA_WP_USER") and os.environ.get("CARCURA_WP_APP_PASSWORD"):
        auth = ["-u", f"{os.environ['CARCURA_WP_USER']}:{os.environ['CARCURA_WP_APP_PASSWORD']}"]
    r = subprocess.run(["curl", "-sS", "-m", "60", "-w", "\n%{http_code}"] + auth + args, capture_output=True, text=True)
    body, _, code = r.stdout.rpartition("\n")
    return code.strip(), body.strip() or r.stderr.strip()


def status():
    for _ in range(3):
        code, body = curl([RELAY + "/status"])
        if code == "200":
            return json.loads(body)
        time.sleep(5)
    return None


def send(recipients, result_path):
    st = status()
    if not st or not st.get("html"):
        sys.exit("Mail-Relay 1.1.0 ist noch nicht installiert (kein HTML). Abbruch, nichts gesendet.")
    if st["heute_gesendet"] + len(recipients) > st["tageslimit"]:
        sys.exit(f"Tageslimit reicht nicht: {st['heute_gesendet']} gesendet, {len(recipients)} geplant, Limit {st['tageslimit']}.")
    results = []
    for i, r in enumerate(recipients):
        if i:
            time.sleep(GAP_SECONDS)
        before = (status() or {}).get("heute_gesendet")
        payload = json.dumps({"to": r["email"], "subject": subject(r), "text": text_version(r), "html": html_version(r),
                              "reply_to": "carcura@web.de", "bcc_self": True}, ensure_ascii=False)
        code, body = curl(["-X", "POST", "-H", "Content-Type: application/json; charset=utf-8", "--data-binary", payload, RELAY + "/send"])
        state = "gesendet" if code == "200" and '"ok":true' in body else None
        if state is None:
            # Antwort verloren? Am Tageszähler sehen, ob die Mail trotzdem raus ist, statt doppelt zu senden.
            time.sleep(6)
            after = (status() or {}).get("heute_gesendet")
            if before is not None and after is not None and after > before:
                state = "gesendet (Antwort kam nicht durch, Zähler bestätigt)"
            else:
                state = f"FEHLER HTTP {code}: {body[:200]}"
        results.append({**r, "status": state})
        print(f"{r['firma']} | {r['email']} | {state}", flush=True)
    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "demo":
        demo = {"firma": "Musterbau GmbH", "ort": "Altenkirchen", "email": "carcura@web.de", "anrede": "Herr Mustermann"}
        with open(sys.argv[2], "w", encoding="utf-8") as f:
            f.write(html_version(demo))
        print(subject(demo))
    elif len(sys.argv) == 4 and sys.argv[1] == "senden":
        with open(sys.argv[2], encoding="utf-8") as f:
            send(json.load(f), sys.argv[3])
    else:
        sys.exit(__doc__)
