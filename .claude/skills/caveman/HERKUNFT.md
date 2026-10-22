# Herkunft dieses Skills

| Feld | Wert |
|---|---|
| Quelle | https://github.com/JuliusBrussee/caveman |
| Pfad | `skills/caveman/` |
| Commit | `bad48a0e1df55e05e3f52249afa35ecc1909ee76` |
| Commit-Datum | 2026-10-17 |
| Lizenz | Apache 2.0 (siehe `LICENSE`, `NOTICE`) |
| Geprüft am | 2026-10-22 |

## Übernommen

- `SKILL.md` — unverändert

## Nicht übernommen

| Skill | Grund |
|---|---|
| `caveman-setup`, `-discover`, `-evidence-review`, `-manage`, `-optimize`, `-learn`, `-stats` | Gehören zum kommerziellen Dienst „Caveman Cloud". `caveman-setup` leitet KI-Anfragen einer App über das Gateway des Anbieters (Datenschutz: Inhalte gehen an Dritte). Ohne Konto nutzlos. |
| `caveman-compress` | Überschreibt `CLAUDE.md` und Notizen mit komprimierter Kurzsprache und schickt den Inhalt dafür an ein Sprachmodell. Würde die sorgfältig formulierten deutschen Regeln dieses Projekts verschlechtern. |
| `caveman-commit` | Englische Conventional Commits und Verbot von KI-Hinweisen — widerspricht der Commit-Konvention dieses Repos. |
| `caveman-review` | Doppelt die eingebaute Code-Review. |
| `megacave`, `ultracave` | Klassisches Chinesisch bzw. Satzfragmente — unbrauchbar für deutsche Geschäftskommunikation. |
| `cavecrew`, `investigate-first`, `lean-build`, `migration`, `safe-refactor`, `surgical-patch`, `verify-and-stop`, `caveman-explore`, `caveman-help` | Kein Mehrwert gegenüber vorhandenen Werkzeugen; teils auf Codex (`openai.yaml`) zugeschnitten. |

## Sicherheitsbefund

Der übernommene `SKILL.md` ist reiner Text: keine Skripte, keine Hooks,
keine Netzwerk- oder Dateioperationen, keine Prompt-Injection-Muster.

## Einsatz in diesem Projekt

Nur auf Zuruf (`/caveman`), nie automatisch — siehe `CLAUDE.md`.
Einmal aktiviert, gilt der Modus bis „stop caveman" oder „normal mode".
