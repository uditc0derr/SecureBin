# SecureBin

SecureBin is a self-hostable, end-to-end encrypted pastebin. Text is encrypted in the
browser with the Web Crypto API before it ever leaves the machine, so the server only
ever stores an opaque ciphertext blob. Pastes can be given a password, a time-based
expiry, or a burn-after-read lifetime, and the decryption key travels in the URL
fragment, which browsers never transmit to the server.

---

## Table of Contents

- [Features](#features)
- [Security Model](#security-model)
- [How Encryption Works](#how-encryption-works)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Lifetime Semantics](#lifetime-semantics)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Security Considerations and Known Limitations](#security-considerations-and-known-limitations)
- [Troubleshooting](#troubleshooting)
- [Deployment Notes](#deployment-notes)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

- **Client-side end-to-end encryption.** All encryption and decryption happens in the
  browser via `window.crypto.subtle`. Plaintext is never sent to or logged by the server.
- **Two key modes.**
  - *Link key mode*: a random 256-bit key is generated per paste and delivered through
    the URL fragment. No password typing, no key exchange infrastructure.
  - *Password mode*: the key is derived with PBKDF2-HMAC-SHA256 (200,000 iterations) from
    a passphrase supplied by the reader.
- **AES-256-GCM authenticated encryption.** Every paste uses a fresh 96-bit IV, so
  tampering with stored ciphertext is detected on decrypt rather than silently ignored.
- **Time-based expiry.** Optional TTL from one minute up to thirty days, enforced both in
  application code and by a MongoDB TTL index.
- **Burn after reading.** The paste is deleted from the database shortly after it has been
  decrypted and displayed.
- **Manual deletion.** Any paste can be deleted by ID through the UI or the API.
- **Local paste history.** A list of the pastes created in the current browser, stored in
  `localStorage`, with copy, delete and clear-all controls, plus automatic pruning of
  entries that have already expired.
- **Responsive dark UI.** Built with Tailwind CSS, with a mobile navigation drawer and
  toast notifications.
- **Minimal, auditable backend.** Four routes, one Mongoose model, no auth, no sessions.

---

## Security Model

### What the server can see

The server is deliberately blind. For every stored paste it holds only:

- `ciphertext`: base64url-encoded AES-GCM output
- `iv`: base64url-encoded 12-byte initialisation vector
- `salt` and `iterations`: present only for password-protected pastes, used by the reader
  to re-derive the key
- `meta`: expiry timestamp and the burn-after-read flag

It cannot read paste contents, cannot recover the key, and never receives the key material
because the key is carried in the URL fragment.

### Why the URL fragment matters

A URL of the form

```
https://example.com/b/66f1c2a4b9d84e07a1c35f2b#5Kd8pQ2mZx7Rt4vN9wYs3Lh6Jg1BcEeF
```

is split by the browser into a part that is sent over the network and a part that is not:

| Part | Sent to server | Contents |
| --- | --- | --- |
| `https://example.com/b/66f1c2a4b9d84e07a1c35f2b` | Yes | Paste ID |
| `#5Kd8pQ2mZ...` | No | Base58-encoded 256-bit key |

The fragment is read client-side with `window.location.hash`. Consequently, proxy logs,
server access logs, and referrer headers never see the key.

### What the server can still do

Being honest about the trust boundary matters more than claiming perfect security. The
server operator, or anyone who compromises the database, can:

- delete or alter any paste;
- observe the creation and access *timing* of a paste (the ID is a public capability);
- respond with modified ciphertext. This is the one attack AES-GCM is designed to catch,
  and it will cause decryption to fail with an authentication error.

### Trust assumptions

- TLS is assumed in transit. A deployed instance must be served over HTTPS, otherwise the
  link key in the fragment is exposed to a network attacker.
- The client is honest. All security rests on the shipped JavaScript, which is served by
  the same origin as the UI.
- No user accounts exist. A paste ID is the only credential, and it is not secret enough to
  protect against someone who already has a link.

---

## How Encryption Works

All of the following lives in `frontend/src/utils/crypto.js`.

### Link key mode (default)

1. `crypto.getRandomValues(new Uint8Array(32))` produces a 256-bit key.
2. A 12-byte IV is generated the same way.
3. The key is imported as an `AES-GCM` `CryptoKey`.
4. `crypto.subtle.encrypt` produces the ciphertext plus a 16-byte GCM authentication tag.
5. Ciphertext and IV are base64url-encoded for transport.
6. The raw key bytes are Base58-encoded and appended to the share URL as the fragment.

On read, the fragment is Base58-decoded back into 32 raw bytes, imported as an `AES-GCM`
key, and used to decrypt. If the key is wrong or the payload was modified, the GCM tag
check fails and the UI reports a decryption error.

Base58 (rather than base64) is used for the key so the fragment survives being copied
through systems that mangle `+`, `/` and `=` characters.

### Password mode

1. A 16-byte salt is generated.
2. The passphrase is imported as raw key material.
3. `crypto.subtle.deriveKey` runs PBKDF2 with HMAC-SHA256, 200,000 iterations, producing a
   256-bit `AES-GCM` key.
4. Encryption proceeds as above.
5. `salt` and `iterations` are stored alongside the ciphertext so the reader can repeat the
   derivation. The passphrase itself is never stored or transmitted.

The frontend treats a paste as password-protected when the API response contains a `salt`
and the URL has no fragment.

### Experimental X25519 path

`crypto.js` also contains an X25519 plus HKDF hybrid construction (`generateKey`,
`setMyPrivateKey`, and the `recipientPublicKey` branch of `encryptText`). It is **not
reachable from the current UI**, because no recipient key directory exists yet. It is
retained for a future authenticated, per-user key model. Treat it as unproven code; the
shipped product uses the two modes described above.

### Base64url helpers

| Helper | Purpose |
| --- | --- |
| `base64UrlEncode(buffer)` | Standard base64 with `+` to `-`, `/` to `_`, and padding stripped |
| `base64UrlDecode(str)` | Reverses the transform and returns an `ArrayBuffer` |

---

## Architecture

```
Browser (React 19 + Vite)
  |
  |  1. encrypt(plaintext, key)   -- Web Crypto, in the page
  |  2. POST /api/paste { ciphertext, iv, ... }
  v
Express 5 API  ------------------------------------>  MongoDB (Mongoose 8)
  |                                                        |
  |  3. GET /api/paste/:id  { ciphertext, iv, ... }        | TTL index on meta.expiresAt
  |  4. decrypt(ciphertext, key) -- Web Crypto, in the page|
  v                                                        v
Paste rendered to reader                        automatic removal at expiry
```

The API performs no cryptographic operations. It is a validated, TTL-managed store for
opaque blobs.

### Data flow for a paste

Create:

1. User types text and picks a lifetime.
2. Frontend encrypts with either a fresh random key or a derived password key.
3. Frontend POSTs the ciphertext, IV, optional salt and iterations, and `meta`.
4. Backend validates that `ciphertext` and `iv` are present, normalises `meta.expiresAt`
   to an ISO string, persists the document and returns the MongoDB `_id`.
5. Frontend builds the share URL, appending the key as a fragment in link key mode.
6. Frontend records `{ id, url, createdAt, expiresAt }` in `localStorage`.

Read:

1. Reader opens the URL. The frontend reads the fragment and fetches the document.
2. If the paste has a `salt` and no fragment is present, the password prompt is shown.
3. Otherwise the payload is decrypted and rendered.
4. If `meta.burnOnRead` is set, a `DELETE` is issued about 1.5 seconds after render.

---

## Tech Stack

### Frontend

| Technology | Version | Role |
| --- | --- | --- |
| React | 19.2 | UI runtime |
| React DOM | 19.2 | DOM renderer |
| Vite | 7.2 | Dev server, build tooling, `/api` dev proxy |
| react-router-dom | 7.9 | Client-side routing |
| axios | 1.13 | HTTP client |
| react-toastify | 11.0 | Notifications |
| lucide-react | 0.553 | Icon set |
| Tailwind CSS | 4 (browser CDN) | Utility-first styling, no build step |
| ESLint | 9.39 | Linting, flat config |

### Backend

| Technology | Version | Role |
| --- | --- | --- |
| Node.js | ESM (`"type": "module"`) | Runtime |
| Express | 5.1 | HTTP framework |
| Mongoose | 8.19 | MongoDB ODM |
| MongoDB | Atlas or local | Persistence |
| dotenv | 17.2 | Environment variable loading |
| cors | 2.8 | Cross-origin headers |

Styling note: Tailwind is loaded from `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4`
inside `frontend/index.html`, so there is no Tailwind config file, no PostCSS setup, and no
Tailwind npm dependency. Custom fonts and the `animate-fadeIn` utility referenced in
`App.jsx` and `Navbar.jsx` are not currently defined in `index.css`, which is empty.

---

## Prerequisites

- Node.js 20 or newer (developed against 22.x; Vite 7 and Express 5 both require it)
- npm 10 or newer
- A MongoDB instance. Either a local `mongod` or a free MongoDB Atlas cluster
- A modern browser with Web Crypto support. X25519 and HKDF paths additionally require a
  Chromium-based or Firefox-based browser; the shipped link key and password modes only
  need baseline `crypto.subtle` support, which is universal in current browsers.

---

## Installation and Setup

The repository is a two-package workspace with no root `package.json`. Clone and install
each side independently.

```bash
git clone https://github.com/uditc0derr/SecureBin.git
cd SecureBin
```

### Backend

```bash
cd backend
npm install
cp .env.example .env    # or create .env manually, see the table below
```

Create `backend/.env` and fill in your MongoDB connection string:

```env
PORT=5000
NODE_ENV=development

MONGO_USER=your_username
MONGO_PASS=your_password
MONGO_CLUSTER=your_cluster.mongodb.net
MONGO_DB=securebin

MONGO_URI=mongodb+srv://your_username:your_password@your_cluster.mongodb.net/securebin?retryWrites=true&w=majority
```

`MONGO_URI` is read directly in `backend/config/db.js`. The individual `MONGO_USER`,
`MONGO_PASS`, `MONGO_CLUSTER` and `MONGO_DB` variables are not interpolated by the code
and are kept only as documentation of the pieces that make up the URI. If you prefer to
compose the URI in application code, replace the `mongoose.connect(process.env.MONGO_URI)`
call with a template string built from those four variables.

`backend/.env` is already covered by `backend/.gitignore`, so credentials will not be
committed. Do not remove that ignore rule.

### Frontend

```bash
cd frontend
npm install
```

The frontend needs no environment file. In development it talks to the backend through the
Vite proxy declared in `frontend/vite.config.js`, which forwards `/api` to
`http://localhost:5000`. If you change the backend port, update `target` in that file, or
add a matching `VITE_API_BASE_URL` and point `baseURL` in `frontend/src/api/paste.js` at it.

---

## Environment Variables

Backend only, read by `dotenv` in `server.js`.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | No | `5000` | Port the Express server listens on |
| `NODE_ENV` | No | unset | Conventional environment flag |
| `MONGO_URI` | Yes | none | Full MongoDB connection string. The process exits with code 1 if the connection fails |
| `MONGO_USER` | No | none | Informational. Not read by application code |
| `MONGO_PASS` | No | none | Informational. Not read by application code |
| `MONGO_CLUSTER` | No | none | Informational. Not read by application code |
| `MONGO_DB` | No | none | Informational. Not read by application code |

Frontend, optional, only if you abandon the dev proxy:

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | No | `/api/paste` | Base URL for axios in `src/api/paste.js` |

---

## Running the Application

Two terminals are required.

**Terminal 1, backend:**

```bash
cd backend
node server.js
```

Expected output:

```
 MongoDB Connected: your_cluster.mongodb.net
Server running on port 5000
```

A `GET /` request returns a plain-text health message.

**Terminal 2, frontend:**

```bash
cd frontend
npm run dev
```

Vite prints a local URL, typically `http://localhost:5173`. Open it, type some text, choose
a lifetime, and press **Create Secure Link**.

To produce a production bundle:

```bash
cd frontend
npm run build      # emits frontend/dist
npm run preview    # serves the built bundle locally
```

### Optional: add npm scripts to the backend

`backend/package.json` currently defines no `start` or `dev` script, which is why
`node server.js` is used above. You may add:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  }
}
```

`node --watch` is built in on Node 20 and later, so no extra dependency is required.

---

## API Reference

Base path: `/api/paste`. All request and response bodies are JSON. `cors()` is mounted
globally with default settings, so any origin may call the API.

### Create a paste

```
POST /api/paste
```

Request body:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `ciphertext` | string | Yes | base64url AES-GCM ciphertext with tag |
| `iv` | string | Yes | base64url 12-byte IV |
| `salt` | string | No | base64url salt. Password mode only |
| `iterations` | number | No | PBKDF2 iteration count. Password mode only |
| `meta.expiresAt` | string | No | ISO 8601 timestamp. Invalid dates are dropped |
| `meta.burnOnRead` | boolean | No | Defaults to `false` |

Example, password mode:

```bash
curl -X POST http://localhost:5000/api/paste \
  -H 'Content-Type: application/json' \
  -d '{
    "ciphertext": "k7Yv0Q9d3sJm2xA1bC8eF5gH4jK6lN0pR2tV8wZ",
    "iv": "MDEyMzQ1Njc4OWFiY2RlZg",
    "salt": "c2FsdHNhbHRzYWx0c2FsdA",
    "iterations": 200000,
    "meta": { "burnOnRead": false, "expiresAt": "2026-10-04T12:00:00.000Z" }
  }'
```

Response, `201 Created`:

```json
{ "id": "66f1c2a4b9d84e07a1c35f2b" }
```

Errors:

| Status | Body | Cause |
| --- | --- | --- |
| `400` | `{ "error": "Missing ciphertext or iv" }` | One of the required fields is missing |
| `500` | `{ "error": "Internal server error" }` | Unhandled database or server error |

### Fetch a paste

```
GET /api/paste/:id
```

`:id` must be a valid MongoDB ObjectId; it is otherwise rejected before any database access.

Response, `200 OK`:

```json
{
  "ciphertext": "k7Yv0Q9d3sJm2xA1bC8eF5gH4jK6lN0pR2tV8wZ",
  "iv": "MDEyMzQ1Njc4OWFiY2RlZg",
  "salt": null,
  "iterations": null,
  "meta": {
    "expiresAt": "2026-10-04T12:00:00.000Z",
    "burnOnRead": false,
    "createdAt": "2026-09-27T09:15:00.000Z",
    "views": 0,
    "encryptedWith": "x25519"
  }
}
```

Errors:

| Status | Body | Cause |
| --- | --- | --- |
| `400` | `{ "error": "Invalid paste ID" }` | `id` is not a valid ObjectId |
| `404` | `{ "error": "Paste not found" }` | No document with that ID |
| `410` | `{ "error": "Paste expired" }` | Past `meta.expiresAt`. The document is deleted before the response is sent |
| `500` | `{ "error": "Internal server error" }` | Unhandled server error |

### Delete a paste

```
DELETE /api/paste/:id
```

Response, `200 OK`: `{ "success": true }`. Errors: `400` invalid ID, `404` not found,
`500` server error.

### Burn a paste

```
DELETE /api/paste/:id/burn
```

Response, `200 OK`: `{ "success": true }`. Errors: `400` invalid ID, `404` not found or
already deleted, `500` server error.

This handler is behaviourally identical to the plain delete route. Both use
`findByIdAndDelete`; the separate route exists so the intent of a burn is explicit at the
call site and in logs.

### Health check

```
GET /
```

Returns a plain-text string confirming the API process is alive. It does not verify the
database connection.

---

## Data Model

`backend/models/Paste.js` defines a single Mongoose model.

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| `ciphertext` | String, required | none | base64url AES-GCM output |
| `iv` | String, required | none | base64url 12-byte IV |
| `ephemPub` | String, optional | none | Reserved for the X25519 hybrid path. Not written by the current controller |
| `salt` | String, optional | `null` | PBKDF2 salt, or HKDF salt in the hybrid path |
| `legacyKey` | String, optional | `null` | Reserved for data migrated from older formats |
| `legacySalt` | String, optional | `null` | Reserved for migrated data |
| `iterations` | Number, optional | `null` | PBKDF2 iteration count |
| `meta.expiresAt` | Date, optional | `null` | Expiry instant. Drives the TTL index |
| `meta.burnOnRead` | Boolean | `false` | Delete shortly after first successful read |
| `meta.createdAt` | Date | `Date.now` | Creation instant |
| `meta.views` | Number | `0` | Read counter. Declared but not currently incremented |
| `meta.encryptedWith` | String enum | `x25519` | Intended key-mode marker: `x25519`, `password`, or `legacy-random` |
| `meta.owner` | ObjectId ref `User` | `null` | Reserved for future per-user ownership |
| `meta.recipient` | ObjectId ref `User` | `null` | Reserved for directed pastes |

Indexes:

- `{ "meta.expiresAt": 1 }` with `expireAfterSeconds: 0`. MongoDB's background TTL monitor
  removes documents once the timestamp is reached.
- `{ "meta.burnOnRead": 1, "meta.views": 1 }`. Supports efficient cleanup queries if
  server-side burn handling is added.

The paste identifier is the MongoDB `_id`, a 24-character hex string. It is unguessable
enough for a link-shared capability but is not a secret; see the security notes below.

---

## Lifetime Semantics

### Time-based expiry

The frontend converts a relative duration in seconds to an absolute UTC instant with
`getExpiryDate()` in `frontend/src/utils/helpers.js` and sends that ISO string as
`meta.expiresAt`. All comparisons happen in UTC, so client timezone never affects
expiry. Durations are capped at thirty days by the selection list.

Excluding is enforced in two independent places:

1. **Application level.** `getPaste` in the controller compares `meta.expiresAt` against the
   current UTC time and, if the paste is past due, deletes it and replies `410 Gone`.
2. **Database level.** The TTL index deletes the document at the expiry instant, usually
   within about a minute.

The `410` path also fires in the edge case where the TTL monitor has not yet run but the
instant has passed, so a reader never receives already-expired ciphertext.

### Burn after reading

Burn-after-read is implemented client-side. After a paste decrypts successfully, the
frontend waits about 1.5 seconds and then issues `DELETE /api/paste/:id`. The delay exists
so the reader can see the content before it disappears from the server.

Consequences worth understanding before deploying this feature:

- The paste is readable as many times as the reader chooses to reload during the window
  before the delete lands.
- Closing the tab before the timer fires leaves the paste intact.
- A reader who blocks the request, or an attacker who issues `GET` directly without
  running the frontend, does not trigger a burn at all.

Server-side atomic burn would mean deleting the document as part of the read, which trades
the "display before destroy" behaviour for a real guarantee.

### Local history

`frontend/src/pages/CreatePaste.jsx` stores an array of
`{ id, url, createdAt, expiresAt }` objects under the `localStorage` key
`securebin_pastes`. The list is pruned on mount and every 60 seconds, dropping entries
whose `expiresAt` has passed. Because the key fragment is part of the stored `url`, the
local history is the only place the link key exists at rest, and clearing browser data or
pressing **Clear All** removes it. Entries are dropped from this list when a paste 404s
or 410s, and after a successful delete.

---

## Project Structure

```
SecureBin/
├── backend/
│   ├── config/
│   │   └── db.js                  # Mongoose connection, exits on failure
│   ├── controllers/
│   │   └── pasteController.js     # create, get, delete, burn handlers
│   ├── models/
│   │   └── Paste.js               # Schema, TTL and cleanup indexes
│   ├── routes/
│   │   └── PasteRoutes.js         # Express router mounted at /api/paste
│   ├── utils/
│   │   └── generateId.js          # base64url random ID helper (currently unused)
│   ├── .env                       # Local credentials, git-ignored
│   ├── .gitignore
│   ├── package.json
│   └── server.js                  # Express app, CORS, JSON body parsing, listener
└── frontend/
    ├── public/
    │   └── vite.svg
    ├── src/
    │   ├── api/
    │   │   └── paste.js           # axios instance and endpoint wrappers
    │   ├── components/
    │   │   ├── Navbar.jsx         # Sticky nav, desktop links, mobile drawer
    │   │   └── TimerSelector.jsx  # Reusable expiry dropdown (not yet mounted)
    │   ├── pages/
    │   │   ├── CreatePaste.jsx    # Composer, history list, delete confirmation
    │   │   └── ViewPaste.jsx      # Decrypt, password prompt, burn timer
    │   ├── utils/
    │   │   ├── crypto.js          # Web Crypto: AES-GCM, PBKDF2, Base58, X25519
    │   │   └── helpers.js         # Expiry maths and date formatting
    │   ├── App.jsx                # Router shell, routes, footer
    │   ├── App.css
    │   ├── index.css              # Empty; custom fonts and keyframes are missing
    │   └── main.jsx               # React root and global ToastContainer
    ├── index.html                 # Loads Tailwind v4 from CDN
    ├── eslint.config.js
    ├── vite.config.js             # React plugin and /api dev proxy
    └── package.json
```

### Routes

| Path | Component | Purpose |
| --- | --- | --- |
| `/` | `CreatePaste` | Compose a new encrypted paste, browse local history |
| `/b/:id` | `ViewPaste` | Decrypt and display a paste, prompt for password, trigger burn |

### Notable dead code

- `backend/utils/generateId.js` is exported but never imported. Paste IDs come from
  Mongoose instead.
- `frontend/src/components/TimerSelector.jsx` is a finished expiry dropdown that nothing
  renders. `CreatePaste.jsx` defines its own `expiryOptions` array inline, duplicating the
  one in `utils/helpers.js`. Note that the two lists differ in their last entry: the
  helpers version labels thirty days as "1 Month", the component labels it "30 Days".
- `frontend/src/App.css` and `frontend/src/index.css` are empty, and the `font-roboto`,
  `font-syne` and `animate-fadeIn` class names used in components resolve to nothing.
- `frontend/src/assets/react.svg` and `frontend/public/vite.svg` are template leftovers.

---

## Available Scripts

### Backend

There is currently no runnable script in `backend/package.json`; `npm test` exits 1 by
default and `node server.js` starts the server. See the optional scripts snippet above.

### Frontend

| Script | Command | Description |
| --- | --- | --- |
| `npm run dev` | `vite` | Dev server with HMR and the `/api` proxy |
| `npm run build` | `vite build` | Production bundle into `dist/` |
| `npm run preview` | `vite preview` | Serve the built bundle locally |
| `npm run lint` | `eslint .` | Lint the whole frontend using the flat config |

---

## Security Considerations and Known Limitations

This project is a working prototype, not an audited system. The following are real gaps,
listed so that anyone deploying it can make an informed decision.

### Cryptographic and protocol issues

- **No authentication or authorisation.** `DELETE /api/paste/:id` succeeds for anyone who
  knows the ID. There is no owner token. A paste can be deleted by anyone who obtains its
  link, and the ID travels in the URL, so it is not treated as a secret.
- **No rate limiting.** `POST`, `GET` and `DELETE` are all unthrottled. The 200,000-round
  PBKDF2 derivation also runs in the reader's browser, so a weak password can be brute
  forced offline by anyone who fetches the ciphertext, salt and iteration count.
- **Burn after reading is advisory.** It is enforced by a client-side timer and can be
  bypassed entirely by requesting the API directly.
- **Existence is observable.** `GET` distinguishes `404` from `410`, so an attacker can tell
  a never-existed ID from an expired one. There is also no constant-time behaviour anywhere.
- **No maximum ciphertext size.** `express.json()` applies its default 100 KB limit, but no
  explicit application-level cap exists, and there is no total collection size limit.
- **The `ephemPub` and `encryptedWith` fields are not wired up.** Pastes created today are
  stored with the schema default `encryptedWith: "x25519"` even though the X25519 path is
  never used. Do not treat that field as authoritative until it is written on create.
- **`meta.views` is never incremented.** The counter and its index are declared but no
  handler updates them, so view counts are always zero.

### Infrastructure issues

- **CORS is fully open.** `app.use(cors())` with no origin allowlist. Restrict it in any
  deployment where the API is reachable from unwanted origins.
- **No security headers, no rate limiter, no request logging policy.** There is no Helmet
  configuration and no structured logging.
- **No input sanitisation beyond presence checks.** `ciphertext`, `iv`, `salt` and
  `iterations` are stored as received. React escapes rendered text, but the API would
  accept oversized or malformed values.
- **Errors are logged server-side with paste context.** Log scrubbing should be reviewed
  before production use.
- **No HTTPS, no deployment configuration.** No Dockerfile, reverse-proxy sample, or
  environment-specific configuration is included. TLS is assumed and required.

### Client-side issues

- **The link key is stored in `localStorage`** as part of the saved paste URL. Any script
  running on the origin, or anyone with filesystem access to the browser profile, can read
  it. Clearing site data or using **Clear All** removes it.
- **Frontend only.** There is no CLI or API mode that can decrypt a paste without a browser.
- **Bundled dependencies are not pinned or audited.** No lockfile-integrity policy, no
  `npm audit` gate, and no Dependabot configuration.
- **Tailwind is loaded from a third-party CDN** at runtime. That is a supply-chain
  dependency in the page's critical rendering path. Install Tailwind as a build-time
  dependency for a hardened deployment.

### Feature gaps

- No user accounts, so the history list is per browser and per device, and cannot be
  restored or synced.
- No paste search, listing, or management API. The database can only be inspected
  directly.
- No delivery notifications and no scheduled reminders before expiry.
- No internationalisation; the UI is English only.

---

## Troubleshooting

**`Error: connect ECONNREFUSED` in the server logs, then the process exits.**
`MONGO_URI` is missing or wrong, or the cluster is not reachable. Confirm the URI in
`backend/.env`, that the IP allowlist in Atlas includes your machine or `0.0.0.0/0`, and
that the database user has read-write rights. `connectDB` calls `process.exit(1)` on
failure by design.

**The frontend shows "Unable to fetch this paste."**
The backend is not running, or is not on port 5000. Check that `node server.js` is up in the
other terminal and that `target` in `frontend/vite.config.js` matches the backend port.

**A freshly created link shows "Decryption failed or invalid key."**
The fragment was stripped. Link-sharing tools, chat clients, and some redirect flows drop
the part after `#`. Copy the full URL from the app, and keep the fragment intact when
sharing.

**The paste asks for a password unexpectedly.**
`ViewPaste` treats a paste as password-protected when the API response contains a `salt` and
the URL has no fragment. Opening a password paste in a new tab without the fragment is
correct; opening a link key paste in a tab where the fragment was lost also lands here.

**A burned paste is still readable.**
Burn is a client-side timer, roughly 1.5 seconds after render. Reloading inside that
window, or requesting the API directly, still returns the ciphertext. The document is
removed from MongoDB once the delete lands.

**`crypto.subtle` is undefined on `http://` origins.**
Web Crypto is restricted to secure contexts. Use `https://`, or `http://localhost`, which
browsers treat as secure.

**`npm run build` fails with unresolved Tailwind classes.**
Tailwind v4 is loaded from a CDN at runtime in `index.html`. Class names are not processed
at build time, so the build succeeds but styling is absent in an offline or CSP-restricted
environment. Install Tailwind as a dependency and configure it in the Vite pipeline.

**`Changes to backend files do not take effect.**
`backend/server.js` is not running under a watcher. Restart it, or add a `dev` script using
`node --watch server.js`.

**Expired pastes linger in the database for a minute or so.**
That is the MongoDB TTL monitor, which runs roughly once per minute. Reads are unaffected:
`getPaste` rejects and deletes the document itself, so an expired paste is never served.

---

## Deployment Notes

A production deployment should address at minimum:

1. **Serve everything over HTTPS.** Without TLS the link key in the URL fragment is
   exposed, and `crypto.subtle` is unavailable on non-secure origins.
2. **Build the frontend** with `npm run build` and serve `frontend/dist` from a static host
   or CDN. React Router uses `BrowserRouter`, so the host must rewrite unknown paths to
   `index.html` for `/b/:id` deep links to work.
3. **Point the frontend at the API** by replacing the relative `baseURL` in
   `frontend/src/api/paste.js` with the deployed API origin, or by proxying `/api` from the
   same origin as the static bundle, which keeps the request same-origin.
4. **Set real environment variables** in the platform's secret store rather than committing
   a `.env` file.
5. **Restrict CORS** to the deployed frontend origin.
6. **Add rate limiting** at the reverse proxy or with `express-rate-limit`, and consider
   per-IP limits on `POST` to control database growth.
7. **Move Tailwind to a build-time dependency** to remove the CDN from the trust boundary.
8. **Back up or accept data loss.** There is no backup or archival story, and pastes are
   unrecoverable once deleted or expired.

---

## Roadmap

- [ ] Per-user accounts with an `encryptedWith` marker written correctly on create
- [ ] Server-authoritative paste deletion using an owner token
- [ ] Atomic burn-after-read performed as part of the read path
- [ ] Paste size limits and an explicit maximum ciphertext length
- [ ] Rate limiting and a tightened CORS allowlist
- [ ] Security headers via Helmet, plus structured logging
- [ ] Increment `meta.views` and expose a lightweight stats view for the owner
- [ ] Wire up the X25519 hybrid path, or remove it
- [ ] A paste history keyed to an account instead of `localStorage`
- [ ] Automated tests for the API and for the crypto module

---

## License

Released under the ISC License, matching the `license` field in `backend/package.json`.
