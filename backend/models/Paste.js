// models/Paste.js
import mongoose from "mongoose";

const PasteSchema = new mongoose.Schema({
  // === NEW SECURE FORMAT (X25519 hybrid) - RECOMMENDED ===
  ciphertext:   { type: String, required: true },        // base64url encrypted data
  iv:           { type: String, required: true },        // 12-byte IV
  ephemPub:     { type: String, required: false },       // Ephemeral X25519 public key (44 chars)
  salt:         { type: String, required: false },       // HKDF salt (24 chars) - only for hybrid mode

  // === LEGACY FIELDS (keep for old pastes) ===
  legacyKey:    { type: String, default: null },         // old Base58 random key (if any)
  legacySalt:   { type: String, default: null },         // old PBKDF2 salt (password mode)
  iterations:   { type: Number, default: null },         // old PBKDF2 iterations

  // === META ===
  meta: {
    expiresAt:     { type: Date, default: null },
    burnOnRead:    { type: Boolean, default: false },
    createdAt:     { type: Date, default: Date.now },
    views:         { type: Number, default: 0 },
    encryptedWith: { type: String, enum: ["x25519", "password", "legacy-random"], default: "x25519" },
    // optional: store sender/receiver user IDs if you have auth
    owner:         { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    recipient:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
});

// TTL index for auto-expiry
PasteSchema.index({ "meta.expiresAt": 1 }, { expireAfterSeconds: 0 });

// Optional: index for fast cleanup of burned pastes (if you delete on first view)
PasteSchema.index({ "meta.burnOnRead": 1, "meta.views": 1 });

export default mongoose.model("Paste", PasteSchema);