#!/usr/bin/env bash
# Fragt die Zugangsdaten nacheinander ab und traegt sie in .env ein (Werte werden nicht angezeigt).
cd "$(dirname "$0")" || exit 1
setz() { python3 - "$1" "$2" <<'PY'
import sys, re
k, v = sys.argv[1], sys.argv[2]
if "'" not in v:
    v = "'" + v + "'"
else:
    v = '"' + v.replace('\\', '\\\\').replace('"', '\\"').replace('$', '$$') + '"'
t = open('.env').read()
if re.search('^' + re.escape(k) + '=', t, re.M):
    t = re.sub('^' + re.escape(k) + '=.*$', lambda m: k + '=' + v, t, flags=re.M)
else:
    t += '\n' + k + '=' + v + '\n'
open('.env', 'w').write(t)
PY
}
echo "=== Carcura-Assistent einrichten ==="
read -r -p "Deine PRIVATE Handynummer (z. B. +49 151 1234567): " A
read -r -p "Richys PRIVATE Handynummer: " R
setz OWNERS "Alex:$A:Alex,Richy:$R:Rich|Richy"
read -r -s -p "Claude-API-Schluessel einfuegen (unsichtbar), dann Enter: " K; echo
setz ANTHROPIC_API_KEY "$K"
setz CLAUDE_MODEL claude-sonnet-5-5
read -r -p "WordPress-Benutzername: " U
setz WP_USER "$U"
read -r -s -p "WordPress-Anwendungspasswort (unsichtbar; noch keins = nur Enter): " W; echo
[ -n "$W" ] && setz WP_APP_PASSWORD "$W"
setz SMTP_USER carcura@web.de
read -r -s -p "web.de-Passwort (unsichtbar), dann Enter: " P; echo
setz SMTP_PASS "$P"
setz BOT_DOMAIN bot.carcura.info
setz WA_BOT_NUMBER +491706669516
setz KUNDEN_CHATS melden
grep -q '^LEAD_SECRET=.' .env || setz LEAD_SECRET "$(openssl rand -hex 32)"
grep -q '^WA_VERIFY_TOKEN=.' .env || setz WA_VERIFY_TOKEN "$(openssl rand -hex 24)"
chmod 600 .env
unset K W P
echo "=== Fertig. Ausgefuellt sind: ==="
grep -E '^(OWNERS|ANTHROPIC_API_KEY|CLAUDE_MODEL|WP_USER|WP_APP_PASSWORD|SMTP_USER|SMTP_PASS|LEAD_SECRET|WA_VERIFY_TOKEN|WA_BOT_NUMBER|KUNDEN_CHATS|BOT_DOMAIN)=.' .env | cut -d= -f1
