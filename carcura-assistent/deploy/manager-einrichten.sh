#!/usr/bin/env bash
# Carcura Manager auf dem Hetzner-Server einrichten oder aktualisieren (app.carcura.info).
# Aufruf auf dem Server als root:
#   curl -fsSL https://raw.githubusercontent.com/carcura-ai/amazon-KDP/claude/amazon-kdp-kinderbuch-setup-374xk0/carcura-assistent/deploy/manager-einrichten.sh -o /root/manager-einrichten.sh && bash /root/manager-einrichten.sh
# Kann beliebig oft laufen: Vorhandenes (Daten, .env, Schlüssel) bleibt erhalten.
set -euo pipefail

REPO=https://github.com/carcura-ai/amazon-KDP.git
MGR_BRANCH=claude/kind-curie-4rhi0y
MGR_ROOT=${MGR_ROOT:-/opt/carcura-manager}
ASS_ROOT=${ASS_ROOT:-/opt/carcura}
APP_DOMAIN=${APP_DOMAIN:-app.carcura.info}
MGR_DEPLOY=$MGR_ROOT/carcura-manager/deploy
ASS_DIR=$ASS_ROOT/carcura-assistent
GATE_DIR=$ASS_DIR/deploy/gemeinsam

schritt() { printf '\n\033[1;33m==> %s\033[0m\n' "$1"; }
ok()      { printf '\033[1;32m    OK: %s\033[0m\n' "$1"; }
warnung() { printf '\033[1;31m    ACHTUNG: %s\033[0m\n' "$1"; }
abbruch() { printf '\n\033[1;31mABBRUCH: %s\033[0m\n' "$1"; exit 1; }

[ "$(id -u)" = 0 ] || abbruch "Bitte als root ausführen."
command -v docker >/dev/null || abbruch "Docker fehlt. Erst installieren: curl -fsSL https://get.docker.com | sh"
docker compose version >/dev/null 2>&1 || abbruch "docker compose fehlt."
command -v git >/dev/null || { apt-get update -qq && apt-get install -y -qq git; }

schritt "1/7 Arbeitsspeicher prüfen"
mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
swap_mb=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
echo "    RAM: ${mem_mb} MB, Swap: ${swap_mb} MB"
[ "$mem_mb" -ge 1700 ] || abbruch "Weniger als 2 GB RAM. Server in der Hetzner-Konsole erst hochstufen (Skalieren)."
if [ "$swap_mb" -lt 1000 ] && [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap -q /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "2 GB Swap angelegt (Reserve fürs Bauen)"
else
  ok "Arbeitsspeicher reicht"
fi

schritt "2/7 Manager-Programm holen bzw. aktualisieren"
if [ -d "$MGR_ROOT/.git" ]; then
  git -C "$MGR_ROOT" pull -q --ff-only && ok "aktualisiert"
else
  git clone -q --depth 1 --filter=blob:none --sparse -b "$MGR_BRANCH" "$REPO" "$MGR_ROOT"
  git -C "$MGR_ROOT" sparse-checkout set carcura-manager
  ok "heruntergeladen nach $MGR_ROOT"
fi
[ -f "$MGR_DEPLOY/docker-compose.yml" ] || abbruch "Manager-Dateien fehlen in $MGR_DEPLOY."

schritt "3/7 Einstellungen (.env) und geheimer Schlüssel"
cd "$MGR_DEPLOY"
[ -f .env ] || cp .env.example .env
chmod 600 .env
if ! grep -q '^APP_SECRET=.\{40,\}' .env; then
  secret=$(openssl rand -base64 48 | tr -d '\n/+=' )
  sed -i "s|^APP_SECRET=.*|APP_SECRET=${secret}|" .env
  ok "neuer geheimer Schlüssel erzeugt – bitte später sichern (siehe Ende)"
else
  ok "geheimer Schlüssel vorhanden (bleibt unverändert)"
fi
sed -i "s|^DOMAIN=.*|DOMAIN=${APP_DOMAIN}|" .env
grep -q '^APP_SECRET=.\{40,\}' .env || abbruch "APP_SECRET konnte nicht gesetzt werden."

schritt "4/7 Manager bauen (beim ersten Mal 10–20 Minuten, einfach laufen lassen)"
docker compose build app
ok "gebaut"

schritt "5/7 Manager starten"
# Belegte Ports 80/443 durch einzelne Caddy-Dienste der Projekte freimachen (nur der gemeinsame Eingang darf sie nutzen)
for c in $(docker ps --format '{{.Names}}' | grep -E '^(deploy-caddy|carcura-assistent-caddy)' || true); do
  docker stop "$c" >/dev/null && docker rm "$c" >/dev/null && echo "    alter Einzel-Eingang $c entfernt"
done
docker compose up -d app
for i in $(seq 1 60); do
  if docker compose exec -T app node -e "fetch('http://127.0.0.1:4800/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    ok "Manager läuft"; break
  fi
  [ "$i" = 60 ] && { docker compose logs --tail 40 app; abbruch "Manager startet nicht (Protokoll oben)."; }
  sleep 3
done

schritt "6/7 Gemeinsamen HTTPS-Eingang für app. und bot.carcura.info starten"
if [ -d "$ASS_ROOT/.git" ]; then
  git -C "$ASS_ROOT" pull -q --ff-only || warnung "Assistent-Ordner ließ sich nicht aktualisieren – nutze vorhandene Dateien."
else
  git clone -q --depth 1 --filter=blob:none --sparse -b claude/amazon-kdp-kinderbuch-setup-374xk0 "$REPO" "$ASS_ROOT"
  git -C "$ASS_ROOT" sparse-checkout set carcura-assistent
fi
[ -f "$GATE_DIR/docker-compose.yml" ] || abbruch "Gemeinsamer Eingang fehlt in $GATE_DIR."
# Netzwerk des Assistenten anlegen, ohne ihn zu starten (er braucht erst WhatsApp)
cd "$ASS_DIR"
[ -f .env ] || { cp .env.example .env; chmod 600 .env; }
docker compose create assistent >/dev/null 2>&1 || docker compose up --no-start assistent
cd "$GATE_DIR"
docker compose up -d
ok "Eingang gestartet"

schritt "7/7 Erreichbarkeit von außen prüfen (HTTPS-Zertifikat holen dauert bis zu 2 Minuten)"
https_ok=0
for i in $(seq 1 40); do
  if curl -fsS -m 10 -o /dev/null "https://${APP_DOMAIN}/api/health" 2>/dev/null; then https_ok=1; break; fi
  sleep 3
done
if [ "$https_ok" = 1 ]; then
  ok "https://${APP_DOMAIN} ist erreichbar, Zertifikat gültig"
else
  warnung "https://${APP_DOMAIN} antwortet noch nicht. Mögliche Ursachen: DNS, Hetzner-Firewall (Ports 80 und 443 müssen offen sein)."
  docker compose logs --tail 15 caddy || true
fi

cd "$MGR_DEPLOY"
code=""
if docker compose exec -T app node -e "fetch('http://127.0.0.1:4800/api/setup/status').then(r=>r.json()).then(j=>process.exit(j.needsSetup?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
  code=$(docker compose logs app 2>/dev/null | grep -o 'Einrichtungscode: [A-Za-z0-9_-]*' | tail -1 | cut -d' ' -f2 || true)
fi
printf '\n\033[1;32m============================================================\033[0m\n'
printf '\033[1;32m  FERTIG – Carcura Manager läuft auf https://%s\033[0m\n' "$APP_DOMAIN"
printf '\033[1;32m============================================================\033[0m\n'
if [ -n "$code" ]; then
  printf '\n  Einrichtungscode (nur für die Ersteinrichtung):  \033[1;36m%s\033[0m\n' "$code"
  echo "  → https://${APP_DOMAIN} im Browser öffnen, Code eingeben, Firma und Administrator anlegen."
else
  echo "  Ersteinrichtung ist bereits erledigt – einfach anmelden."
fi
echo
echo "  Geheimen Schlüssel EINMAL in den Passwortmanager kopieren (ohne ihn sind gespeicherte"
echo "  Zugangsdaten nach einer Wiederherstellung nicht lesbar). Anzeigen mit:"
echo "    grep ^APP_SECRET= $MGR_DEPLOY/.env"
echo
echo "  Danach am Laptop: Windows-App installieren und als Server https://${APP_DOMAIN} eintragen."
