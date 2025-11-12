import mongoose from "mongoose";

const PasteSchema = new mongoose.Schema({
  ciphertext: { type: String, required: true },
  iv: { type: String, required: true },
  salt: { type: String, default: null },
  iterations: { type: Number, default: null },
  meta: {
    expiresAt: { type: Date, default: null },
    burnOnRead: { type: Boolean, default: false },
  },
});


PasteSchema.index({ "meta.expiresAt": 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Paste", PasteSchema);
