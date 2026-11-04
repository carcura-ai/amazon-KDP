# Manager und Assistent auf einem Server

Ein gemeinsamer Caddy liefert beide Dienste mit HTTPS aus:

| Adresse | Dienst | Projekt |
|---|---|---|
| https://app.carcura.info | Carcura Manager | `/opt/carcura-manager/carcura-manager/deploy` (Dienst `app`) |
| https://bot.carcura.info | WhatsApp-Assistent | `/opt/carcura/carcura-assistent` (Dienst `assistent`) |

Wichtig: In beiden Projekten **nur den Dienst** starten, nie deren eigenen `caddy`
(sonst sind Port 80/443 doppelt belegt):

```
cd /opt/carcura-manager/carcura-manager/deploy && docker compose up -d --build app
cd /opt/carcura/carcura-assistent && docker compose up -d --build assistent
cd /opt/carcura/carcura-assistent/deploy/gemeinsam && docker compose up -d
```

Solange der Assistent noch nicht eingerichtet ist, legt
`docker compose up --no-start assistent` nur sein Netzwerk an; bot.carcura.info antwortet dann mit 502.
