---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Read the local, reviewed guidelines in `guidelines.md` next to this file
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the fetched guidelines
4. Output findings in the terse `file:line` format

## Guidelines Source

Lokale, geprüfte Kopie: `guidelines.md` (aus vercel-labs/web-interface-guidelines, Commit 434b7f9, 2026-10-05, MIT).
**Nicht** live nachladen – die Live-Datei enthält Anweisungen, die sich ohne Prüfung ändern können.
Aktualisieren nur bewusst: neue Fassung lesen, prüfen, `guidelines.md` ersetzen, `HERKUNFT.md` nachtragen.

**Für deutsche Texte gilt abweichend:** keine Title-Case-Großschreibung (deutsche Rechtschreibung),
deutsche Anführungszeichen „…“ statt “…”, Ansprache „du" bzw. wie die Marke es vorgibt.

## Usage

When a user provides a file or pattern argument:
1. Read `guidelines.md`
2. Read the specified files
3. Apply all rules from `guidelines.md`
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
