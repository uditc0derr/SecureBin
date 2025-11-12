# SecureBin

**SecureBin** is a modern, end-to-end encrypted paste-sharing platform.  
It allows you to create, encrypt, and share text securely — with options like password protection, expiration timers, and “burn after reading” self-destruction.

---

## Features

- **End-to-End Encryption** — All text is encrypted in the browser before upload.
- **Password-Protected Pastes** — Add an extra security layer with user-defined passwords.
- **Burn After Reading** — Automatically delete a paste after it’s viewed once.
- **Custom Expiration** — Control how long a paste remains accessible.
- **No Plaintext Storage** — The backend never sees or stores unencrypted content.
- **Local Storage Tracking** — Pastes you create are saved locally for quick access.
- **Mobile Responsive UI** — Optimized for both desktop and mobile.
- **Clean Dark Interface** — Built using TailwindCSS with a minimal design system.

---

## Tech Stack

### Frontend
- **React.js** (Vite)
- **TailwindCSS** for styling
- **Lucide-React** for icons
- **React Router** for routing

### Backend
- **Node.js + Express**
- **MongoDB Atlas** (with Mongoose)
- **dotenv** for environment management

### Security & Encryption
- Client-side **AES-GCM encryption**
- Optional **PBKDF2-based password-derived keys**
- Paste deletion logic (manual, burn-after-read, and expiry-based)


