// frontend/src/api/paste.js
import axios from "axios";

const api = axios.create({
  baseURL: "/api/paste", // Vite proxy (or change to full URL in production)
  timeout: 10000,
});

// Create a new paste
export const createPaste = async (payload) => {
  // payload should be { ciphertext, iv, salt?, iterations?, meta }
  const res = await api.post("/", payload);
  return res.data; // { id: "..." }
};

// Get paste by id
export const getPaste = async (id) => {
  const res = await api.get(`/${id}`);
  return res.data; // { ciphertext, iv, salt, iterations, meta }
};

// ✅ Delete paste (supports burn-after-read)
export const deletePaste = async (id, burn = false) => {
  const url = burn ? `/${id}/burn` : `/${id}`;
  const res = await api.delete(url);
  return res.data; // { success: true }
};

export default {
  createPaste,
  getPaste,
  deletePaste,
};
