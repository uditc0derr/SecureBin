# SecureBin Frontend

React 19 single-page client for SecureBin. Text is encrypted and decrypted in the browser
with the Web Crypto API; this package never sends plaintext to the API.

Full documentation, including the security model, API reference, setup instructions and
known limitations, lives in the [root README](../README.md).

## Quick start

```bash
npm install
npm run dev
```

The dev server proxies `/api` to `http://localhost:5000`, so the backend must be running
separately. See the root README for the complete setup.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Vite dev server with HMR and the `/api` proxy |
| `npm run build` | Production bundle into `dist/` |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | Lint with the flat ESLint config |

## Layout

| Path | Purpose |
| --- | --- |
| `src/pages/CreatePaste.jsx` | Composer, local paste history, delete confirmation |
| `src/pages/ViewPaste.jsx` | Decrypt and display, password prompt, burn timer |
| `src/utils/crypto.js` | AES-GCM, PBKDF2, Base58, X25519 helpers |
| `src/utils/helpers.js` | Expiry maths and date formatting |
| `src/api/paste.js` | Axios client and endpoint wrappers |
| `src/components/Navbar.jsx` | Sticky navigation and mobile drawer |
| `src/components/TimerSelector.jsx` | Reusable expiry dropdown, not yet mounted |
| `vite.config.js` | React plugin and `/api` dev proxy |

## Notes

- Tailwind CSS v4 is loaded from a CDN in `index.html`, so there is no Tailwind config or
  PostCSS setup.
- `src/index.css` and `src/App.css` are empty. The `font-roboto`, `font-syne` and
  `animate-fadeIn` classes referenced in components are not defined.
- Created pastes are tracked in `localStorage` under the key `securebin_pastes`, which
  includes the share URL and therefore the decryption key fragment.
