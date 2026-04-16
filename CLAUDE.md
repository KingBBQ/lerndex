# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Server starten
node server.js
# Mit abweichendem Port:
PORT=3000 node server.js
```

Es gibt keine konfigurierten Lint- oder Test-Scripts.

## Architektur

**Lerndex** ist eine mehrsprachige Lernplattform für Deutschunterricht mit KI-Tutor-Funktion. Stack: Vanilla JS (SPA) + Express.js + SQLite.

### Schichten

| Schicht | Dateien | Aufgabe |
|---|---|---|
| Frontend SPA | `index.html`, `app.js`, `style.css` | Gesamte UI, client-seitiges Routing, localStorage-Token |
| Chat-Fenster | `chat.html` | Separates Fenster für den KI-Chat |
| API-Server | `server.js` | Express-Einstiegspunkt, Route-Registrierung, Static-Serving |
| Routen | `routes/auth.js`, `routes/admin.js`, `routes/chat.js` | JWT-Auth, Admin/Lehrer-Endpoints, LLM-Proxy |
| Datenbank | `database.js` | SQLite (better-sqlite3), Schema-Init, Seeding |
| Inhalte | `topics.json` | ~50 Grammatikthemen (statische JSON) |

### Datenfluss

1. Login → JWT → `localStorage`
2. `GET /api/auth/me` → User-Rolle laden → UI-Ansicht wählen
3. Schüler in Klasse → `lock-view` (nur Chat)
4. Chat-Nachricht → `POST /api/chat/` → OpenAI-kompatible API → Antwort + DB-Speicherung
5. Lehrer/Admin → Chatverlauf per `GET /api/admin/classrooms/:id/history` (Polling alle 5 s)

### Rollen

- **admin** – voller Zugriff: Klassen/User verwalten, globale KI-Einstellungen (API-Key, Modell, Provider)
- **teacher** – Chatverlauf der eigenen Klassen einsehen
- **student** – Themen browsen; nach Klassenaufnahme nur noch Chat-Ansicht

### Authentifizierung

JWT mit Bearer-Token. Secret steht hardcodiert in `routes/auth.js` (`lerndex_secret_key_1337`) – in Produktion als Umgebungsvariable setzen.

Standard-Admin beim ersten Start: `admin@lerndex.de` / `admin123` (in `database.js` geseedet).

### Datenbank

SQLite, WAL-Modus, 4 Tabellen: `users`, `classrooms`, `messages`, `settings`.  
DB-Datei: `./lerndex.db` (relativ zum Projektroot).

### KI-Integration

Konfigurierbar über die `settings`-Tabelle:
- `ai_provider`: `internal` (eigenes OpenAI-kompatibles Endpoint) oder `external` (telli.schule-iframe)
- `base_url`, `model` (Standard: `gpt-4o-mini`), `api_key`

System-Prompts werden pro Klasse in `classrooms.system_prompt` gespeichert.

### Klassen-Join-Flow

Invite-Link: `/?join=<classroom_id>`. Nicht eingeloggte Nutzer: `pending_join` in `localStorage` → nach Login automatisch beitreten. Schüler werden danach auf `lock-view` umgeleitet.
