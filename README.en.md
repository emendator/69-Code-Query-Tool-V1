# 69 Code Query Tool

[简体中文](README.md) | **English**

[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)

A self-hosted tool for managing and looking up product barcodes ("69 codes"): import a product list from Excel into a local SQLite database, let the app detect the model / name / code columns automatically, and then look products up by full or partial code — with batch queries, Excel export and multi-tenant (multi-company) data isolation.

> **About "69 codes"**: a 69 code is a Chinese product barcode (EAN-13 with the `69` prefix). This tool **never queries any third-party barcode service** — it only searches the data you imported.

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Usage walkthrough](#usage-walkthrough)
- [Accounts and permissions](#accounts-and-permissions)
- [Data and backups](#data-and-backups)
- [API reference](#api-reference)
- [Project layout](#project-layout)
- [Self-hosting / deployment](#self-hosting--deployment)
- [FAQ](#faq)
- [Changelog](#changelog)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## Overview

Small teams often keep product lists in Excel, where finding a barcode by hand is slow. This tool turns that into import once, query forever:

1. **Import** — upload `.xlsx` / `.xls` / `.csv`; the app detects which column holds the model, the product name and the 69 code, lets you correct the mapping, and can remember it as a reusable "semantic mapping".
2. **Query** — paste codes line by line; each line is matched exactly and then fuzzily, results are labelled and can be exported.
3. **Collaborate** — three-tier roles, invite-code registration, account expiry and per-company data isolation, so a team can share one instance while companies stay separated.

All data lives in local SQLite files — **no database server to install**.

## Features

**Import**

- `.xlsx` / `.xls` / `.csv`, parsed and previewed right after upload
- Automatic column detection: built-in CN/EN keywords → company semantic mappings → fuzzy string similarity, reported as high / medium / low confidence; mapping can be corrected in the UI
- Optional "add this mapping to the semantic library" so the next file with the same layout matches automatically
- Import report with imported count and skip reasons (empty code, duplicate inside the file, code already in the database)

**Code lookup**

- Multi-line input, one code or keyword per line, queried in batch
- Exact and fuzzy matches merged and labelled per row (exact / fuzzy / not found)
- Selected rows can be exported to Excel with a chosen column set

**Data management**

- Search (300 ms debounce), pagination (50 / 100 / 200 / 500 / 1000 rows per page), per-column value filters
- Create, edit, delete single rows, batch delete
- Duplicate codes highlighted in red with a warning banner, plus one-click de-duplication (keeps the lowest id, i.e. the earliest import)

**Column configuration**

- Two independent column layouts: "data table" and "query result table"
- Drag to reorder, rename headers, set width (40–600 px), show/hide columns
- Saved per company and applied to every member of that company

**Accounts and permissions**

- Three roles: super admin (`super_admin`) > admin (`admin`) > user (`user`), plus a throwaway "guest"
- Invite-code registration: single-use codes that are deleted on successful signup, with optional code expiry and default account expiry
- Physical multi-tenant isolation: one SQLite file per company
- Account expiry: expired accounts are refused at login; admins can extend or remove accounts
- Passwords hashed with bcrypt; JWT (HS256) session tokens

**Interface**

- Dark / light themes with one-click switching, remembered across visits
- Dependency-free motion layer (canvas particle background, button ripples, magnetic hover, 3D tilt, count-up numbers, reading progress bar) that respects the system "reduce motion" preference

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18 + TypeScript 5.5 (function components and hooks; page switching via app state, no react-router) |
| UI kit | Ant Design 5 + @ant-design/icons |
| Build | Vite 5 (dev server on 5178, `/api` proxied to the backend on 8005) |
| HTTP / Excel | axios; SheetJS (xlsx 0.18, generates `.xlsx` in the browser) |
| Backend | Python 3.9+ / FastAPI (uvicorn) with interactive docs at `/docs` |
| ORM / database | SQLAlchemy 2.x; SQLite (WAL and foreign keys enabled on the master DB) |
| Spreadsheet parsing | pandas + openpyxl |
| Authentication | passlib[bcrypt] hashing + python-jose (JWT HS256) + email-validator |
| One-click start | `启动.bat` + `start.ps1` (Windows PowerShell) |

## Quick start

### Requirements

- **Python 3.9+** — <https://www.python.org/downloads/> (on Windows, tick *Add Python to PATH*)
- **Node.js 18+** — <https://nodejs.org/>
- The one-click launcher needs PowerShell (bundled with Windows); on macOS / Linux use the manual steps below

### One-click start (Windows)

1. Double-click **`启动.bat`** in the project root.
2. The script creates the virtualenv `.venv`, generates/repairs the `.env` credentials, installs backend and frontend dependencies, starts both services and opens your browser.
3. The first run downloads dependencies, so give it a moment.
4. Open **<http://localhost:5178>** — backend on <http://localhost:8005>, API docs on <http://localhost:8005/docs>.
5. Backend and frontend each run in their own console window; **closing a window stops that service**.
6. When startup finishes, the console prints the **super admin username and password** (randomly generated on the first run and stored in `.env`).

Run the same file again for later sessions; dependency installation is skipped when everything is already installed.

### Manual start (Windows / macOS / Linux)

Backend — **run from inside `backend/`**, since the code uses top-level module imports:

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS / Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8005
```

Frontend — in a second terminal:

```bash
cd frontend
npm install
npm run dev        # http://localhost:5178
```

Production build: `npm run build`, output in `frontend/dist`.

### First login

On first start the app creates its tables plus a **built-in super admin** and a **default company**.

Credentials are injected through environment variables only — the code ships **no default password and no predictable key fallback**:

| Required environment variable | Purpose |
| --- | --- |
| `JWT_SECRET_KEY` | JWT signing key (a long random string) |
| `SUPER_ADMIN_PASSWORD` | Initial password of the built-in super admin, used only on first initialisation |
| `DEFAULT_COMPANY_DB_PASSWORD` | Database password of the default company (needed by other accounts joining it) |

Two ways to configure them:

1. **Windows one-click start** — just double-click `启动.bat`. On the first run it generates `.env` in the project root with random values and prints the super admin credentials to the console.
2. **Manual setup** — copy `.env.example` to `.env` and fill in the three values, or set the same variables in the environment (process environment wins over `.env`).

> ⚠️ If any of the three is missing, the backend **exits with an error instead of starting** — deliberately, so that no predictable credential can reach a deployed instance.

After logging in, hand out invite codes from the user-management page so others can register — or use "continue as guest" to try every business feature (guest data is deleted on logout).

## Configuration

| Setting | Where | Notes |
| --- | --- | --- |
| `JWT_SECRET_KEY` | environment variable / `.env` (**required**) | JWT signing key. If missing, the backend exits with an error — there is no built-in default |
| `SUPER_ADMIN_PASSWORD` | environment variable / `.env` (**required**) | Initial password of the built-in super admin, used only on first initialisation |
| `DEFAULT_COMPANY_DB_PASSWORD` | environment variable / `.env` (**required**) | Database password of the default company |
| `SUPER_ADMIN_USERNAME` | environment variable / `.env` (optional) | Admin username, defaults to `admin` |
| `SUPER_ADMIN_EMAIL` | environment variable / `.env` (optional) | Admin email, defaults to the placeholder `admin@example.com` — override as needed |
| `DEFAULT_COMPANY_NAME` | environment variable / `.env` (optional) | Default company name, defaults to `我的公司` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | environment variable / `.env` (optional) | Token lifetime in minutes, default `720` (12 h) |
| Data directory | `backend/config.py` `DATA_DIR` | Defaults to `<project root>/data` (master DB, company DBs, upload temp dir) |
| CORS origins | `backend/main.py` | Only `http://localhost:5178` by default; update it when serving from another port or domain |
| Backend port | 8005 | Used by `start.ps1` and by running `main.py` directly; `frontend/vite.config.ts` proxies `/api` to it |
| Frontend dev port | 5178 | `frontend/vite.config.ts` |
| Expiry warning threshold | `backend/config.py` `EXPIRE_WARN_DAYS` | Default `7` days; the UI starts warning inside that window |

> `.env` lives in the **project root** and is covered by `.gitignore`, so it is safe for local or production secrets; process environment variables take precedence. The systemd unit in `deploy/` reads the same file through `EnvironmentFile`, and `deploy.sh` / `update.sh` fill in any missing key during deployment without overwriting existing values.

## Usage walkthrough

The whole flow takes about three minutes:

**1. Import** — left sidebar → "Data management" → "Import"

- Drop or pick an Excel / CSV file (**the first row must be the header**)
- The app proposes a mapping for model / name / code — fix it with the dropdowns if needed
- Ticking "add this mapping to the semantic library" is recommended
- Click "Confirm import" to see the imported count and any skip reasons

**2. Look up codes** — left sidebar → "69 code query"

```
6901234567890
6901234567891
```

Paste one code per line and click "Query": full codes are matched exactly, anything unmatched is retried fuzzily, and the merged table labels each row with its match type. The header counts exact / fuzzy / not-found.

**3. Export** — select the rows you need → "Export" → choose columns → save as Excel.

**4. Tune the view** — left sidebar → "Column config" → switch between data table and query result table → drag to reorder, rename, resize, hide columns → "Save configuration".

## Accounts and permissions

| Capability | Super admin `super_admin` | Admin `admin` | User `user` |
| --- | --- | --- | --- |
| Code lookup / data management / column config | ✅ | ✅ | ✅ |
| User management (invite codes + accounts) | ✅ | ✅ | ❌ |
| Issue level-1 invite codes (registers an admin) | ✅ | ❌ | ❌ |
| Issue level-2 invite codes (registers a user) | ✅ | ✅ | ❌ |
| Extend / remove accounts | ✅ (all) | ✅ (own invitees only) | ❌ |
| Create / join a company | ✅ | ✅ | ❌ |
| Change the company database password | ✅ | ✅ | ❌ |

- **Registration** needs an **email + invite code**. A level-1 code registers an admin (who may create or join a company); a level-2 code registers a regular user (join only).
- **Isolation**: every company has its own SQLite file. Accounts in the same company share one code library; different companies cannot see each other's data. Joining a company requires the "company database password" set by that company's admin.
- **Orphan cleanup**: a company with no registered accounts is deleted together with its database file.
- **Guest mode**: every business feature, no user-management page, and the temporary account, company and database file are removed on logout.

## Data and backups

```
data/
├── 69code.db                      master DB: users / companies / invite_codes
├── companies/company_{id}.db      per-company DB: products / semantic_mappings / column_config
└── upload/                        temporary upload directory used during import
```

- **Back up** by copying the whole `data/` directory.
- **Restore** by stopping the app, replacing `data/` with your backup, and restarting.
- **Start over**: stop the app, delete `data/69code.db` and `data/companies/`; the next start recreates the schema, the default company and the built-in admin.
- Logs go to `logs/` (`backend.log`, `frontend.log`). `data/`, `logs/`, `.env`, `.venv/`, `node_modules/` and `frontend/dist/` are covered by `.gitignore`.

## API reference

Every endpoint returns `{ success, data, message }`; validation and permission errors are raised as HTTP exceptions and surfaced uniformly by the frontend interceptor. Interactive docs are served at `/docs`.

| Module | Endpoint | Method | Purpose |
| --- | --- | --- | --- |
| Auth | `/api/auth/login` | POST | Username + password login, returns token and user info |
| Auth | `/api/auth/register/check-invite` | POST | Validate an invite code before registering, returns its level |
| Auth | `/api/auth/register` | POST | Register with email + invite code (level 1 may create/join a company, level 2 may join only) |
| Auth | `/api/auth/me` | GET | Current user |
| Auth | `/api/auth/guest/login` | POST | Guest login (creates a temporary company and account) |
| Auth | `/api/auth/logout` | POST | Log out; guests also clean up all temporary data |
| Auth | `/api/auth/company/password` | PUT | Admin changes the company database password |
| Invites | `/api/invites` | GET / POST | List / create invite codes (scoped by role) |
| Invites | `/api/invites/{id}` | DELETE | Revoke an unused invite code |
| Users | `/api/users` | GET | Account list (super admin sees all; admins see themselves and their invitees) |
| Users | `/api/users/{id}/extend` | PUT | Extend / set account expiry |
| Users | `/api/users/{id}` | DELETE | Remove an account (removing an admin cascades to the users they invited) |
| Query | `/api/query/single` | GET | Exact lookup by full 69 code |
| Query | `/api/query/fuzzy` | GET | Fuzzy search by keyword (code / model / name / source) |
| Query | `/api/query/batch` | POST | Batch exact lookup for many codes |
| Query | `/api/query/export` | POST | Fetch records for a set of codes (used by export) |
| Data | `/api/data` | GET / POST | Paginated list / create a record |
| Data | `/api/data/{id}` | PUT / DELETE | Update / delete one record |
| Data | `/api/data/batch-delete` | POST | Delete by id list |
| Data | `/api/data/duplicate-codes` | GET | List codes that appear more than once |
| Data | `/api/data/duplicates` | GET | All records belonging to duplicated codes |
| Data | `/api/data/deduplicate` | POST | One-click de-duplication (keeps the earliest import per group) |
| Import | `/api/import/upload` | POST | Upload an Excel / CSV file and return a parsed preview |
| Import | `/api/import/upload-temp` | POST | Upload into the company temp directory for the confirm step |
| Import | `/api/import/match-columns` | POST | Detect model / name / code columns with confidence |
| Import | `/api/import/confirm` | POST | Import using the confirmed mapping, optionally saving it to the semantic library |
| Semantic | `/api/semantic` | GET / POST | List / add column-name semantic mappings |
| Column config | `/api/config/columns` | GET / PUT | Read / save column layout for the `data` and `query` views |

## Project layout

```
69code-query/
├── backend/            FastAPI + SQLAlchemy
│   ├── main.py             app entry: CORS, startup hook, query / data / import / semantic / column APIs
│   ├── routers/            auth.py, invites.py, users.py
│   ├── config.py           paths, JWT, built-in admin and default company, column keyword lists
│   ├── database.py         master + per-company engines, sessions, create/drop
│   ├── models.py           ORM models (system tables + business tables)
│   ├── schemas.py          Pydantic request/response models and validation
│   ├── crud.py             data access: products, import & de-duplication, semantic, columns, accounts
│   ├── matcher.py          column auto-matching (semantic library + keywords + similarity)
│   ├── security.py         bcrypt hashing, JWT encode/decode, invite-code generation
│   ├── deps.py             auth dependencies: current user / role gates / company DB session
│   ├── init_auth.py        startup init: tables, default company and admin, legacy migration, cleanup
│   └── common.py           shared helpers (remaining days, public user info)
├── frontend/           React 18 + TypeScript + Vite
│   ├── index.html          SPA shell
│   ├── vite.config.ts      dev port 5178, /api proxied to 8005
│   └── src/
│       ├── App.tsx             app shell: auth gate, sidebar/topbar, page switching, banners
│       ├── theme.ts            antd dark/light tokens and component overrides
│       ├── index.css           global styles and theme CSS variables
│       ├── motion.css          hand-written motion styles
│       ├── api/index.ts        axios wrapper and all backend calls
│       ├── types/index.ts      TypeScript types mirroring backend schemas
│       ├── context/            theme / auth / column-config state
│       ├── components/         ThemeToggle, ImportModal, ExportDrawer, motion/*
│       └── pages/              AuthPage, QueryPage, DataManagePage, ConfigPage, UserManagePage
├── data/               runtime data (master + company DBs, git-ignored)
├── docs/               design and implementation documents
├── deploy/             self-hosting scripts (deploy.sh / update.sh / nginx.conf / systemd unit)
├── logs/               runtime logs and generated launcher scripts (git-ignored)
├── 启动.bat            Windows one-click launcher (calls start.ps1)
├── start.ps1           launcher: environment check → credential generation → install → start both services → open browser
├── .env.example        credential template (copy to .env and fill in; .env is git-ignored)
└── README.md           Chinese documentation
```

**To change a feature**, follow this chain: page component (`frontend/src/pages/`) → API function (`frontend/src/api/index.ts`) → backend route (`backend/main.py` or `backend/routers/`) → `crud.py` → `models.py`.

## Self-hosting / deployment

`deploy/` contains an Ubuntu-oriented deployment kit:

| File | Purpose |
| --- | --- |
| `deploy/deploy.sh` | Full deploy: system dependencies and Node.js → venv and backend dependencies → frontend build → systemd service and Nginx → firewall port |
| `deploy/update.sh` | Update an existing install: fix permissions → backend dependencies → rebuild frontend → restart service |
| `deploy/nginx.conf` | Nginx site template: serves `frontend/dist` and reverse-proxies `/api` |
| `deploy/69code-query.service` | systemd unit: runs uvicorn as `www-data` on `127.0.0.1:8006`, reachable only through Nginx |

```bash
# Place the project at the path the scripts expect (default /opt/69code-query)
sudo bash deploy/deploy.sh <port>      # argument: public port; see PORT in the script for the default
```

Notes:

- The systemd unit reads `.env` from the install directory via `EnvironmentFile` — put your production `JWT_SECRET_KEY` there (`.env` is git-ignored).
- On small servers `update.sh` caps the Node heap (`--max-old-space-size=1024`) and enables swap when needed; alternatively run `npm run build` locally and upload only `frontend/dist`.
- If you serve the app from an origin other than `localhost:5178`, update the CORS origins in `backend/main.py`.

## FAQ

**I forgot my password.**
There is no self-service password reset; passwords are bcrypt hashes and cannot be read back. Ask the super admin of your instance to remove the account in "User management → Accounts", then register again with a new invite code.

**Registration says the invite code is invalid.**
Invite codes are single-use and may also have expired — request a new one from an admin.

**Joining a company says the company database password is wrong.**
That password is set by the company's admin when the company is created; ask them, or have them reset it from the top bar ("Change company database password").

**Is guest data kept?**
No. The temporary account, company and database file are deleted on logout.

**"Python not found" / "Node.js not found" on start.**
Install Python 3.9+ (tick *Add Python to PATH*) and Node.js 18+ (LTS), then run `启动.bat` again.

**Ports 8005 / 5178 are in use.**
The launcher cleans up leftover processes from this project only. Otherwise close whatever holds the port, or change it: backend — the `--port 8005` argument in `start.ps1`; frontend — `--port 5178` in `start.ps1` plus the proxy target in `frontend/vite.config.ts`.

**The page will not open / the service window flashes and closes.**
Console windows stay open on failure and print the error; logs are written to `logs/backend.log` and `logs/frontend.log`. Usual causes are a busy port or an incomplete dependency install — delete `.venv` and `frontend/node_modules`, then run `启动.bat` again.

**The launcher prints garbled text.**
The scripts themselves are pure ASCII. If it still happens, switch the Windows system locale to UTF-8 (Settings → Time & language → Language & region → Administrative language settings → Change system locale → tick Beta: Use Unicode UTF-8).

**Where is the database, and how do I back it up?**
Master DB `data/69code.db` (accounts / companies / invite codes) and per-company DBs `data/companies/company_{id}.db` (codes / semantic mappings / column config). Copy the whole `data/` directory to back everything up.

## Changelog

### v2.0.0

- New interface: dark editorial-style UI, rebuilt across every page and component
- Dark / light themes with one-click switching and persistence (antd tokens + CSS variables)
- Login and registration merged into a single 3D flip card; the separate login/register pages were removed
- Dependency-free motion system: canvas particle background, button ripples, magnetic hover, 3D tilt, shimmer, count-up, blurred page entrance, reading progress bar
- Fixed login input misalignment, top-bar misalignment, blocked background events on the login page, table scrollbar styling, and autofill overriding login field colors

### v1.1.0

- Added login / registration (email + invite code) and three-tier permissions (super admin > admin > user)
- Added guest mode (all features, no data retained)
- Added multi-company isolation (one code library per company), company database passwords, orphan-company cleanup
- Added invite codes (single-use, optional expiry) and account expiry management (login blocked when expired, extend / remove)
- Added the user-management UI (invite codes + accounts) with cascading removal for admins
- Switched passwords to bcrypt hashes and sessions to JWT

### v1.0.0

- Initial release: code lookup, data management, column configuration, Excel import and export

## Contributing

Issues and pull requests are welcome.

- Before submitting, make sure `cd frontend && npm run build` passes (it includes the TypeScript type check)
- Never commit `data/`, `logs/`, `.env` or other local runtime data and credentials
- (To be added: contribution guide / commit conventions / code of conduct)

## License

(To be added: this repository does not include a `LICENSE` file yet, so the license is undetermined. Until one is chosen, all rights are reserved.)

## Contact

(To be added: maintainer / author attribution, issue tracker URL or contact email.)
