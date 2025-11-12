import React, { useState, useEffect } from "react";
import { encryptText, encryptWithPassword } from "../utils/crypto";
import { createPaste, deletePaste } from "../api/paste";
import { getExpiryDate } from "../utils/helpers";
import { toast, ToastContainer, Slide } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ClipboardCopy, Trash2, X } from "lucide-react";

export default function CreatePaste() {
  const [text, setText] = useState("");
  const [expiry, setExpiry] = useState("3600");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [myPastes, setMyPastes] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null });

  // Load from localStorage
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("securebin_pastes")) || [];
    const now = new Date();
    const valid = stored.filter((p) => !p.expiresAt || new Date(p.expiresAt) > now);
    if (valid.length !== stored.length)
      localStorage.setItem("securebin_pastes", JSON.stringify(valid));
    setMyPastes(valid);
  }, []);

  // Periodic cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      const stored = JSON.parse(localStorage.getItem("securebin_pastes")) || [];
      const now = new Date();
      const valid = stored.filter((p) => !p.expiresAt || new Date(p.expiresAt) > now);
      if (valid.length !== stored.length) {
        localStorage.setItem("securebin_pastes", JSON.stringify(valid));
        setMyPastes(valid);
        toast.info("🧹 Cleaned expired pastes", { autoClose: 2000 });
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const saveToLocal = (newPaste) => {
    const updated = [...myPastes, newPaste];
    setMyPastes(updated);
    localStorage.setItem("securebin_pastes", JSON.stringify(updated));
  };

  const handleCreate = async () => {
    if (!text.trim()) return toast.warn("⚠️ Please enter some text!");
    setLoading(true);

    try {
      const meta =
        expiry === "burn"
          ? { burnOnRead: true }
          : { burnOnRead: false, expiresAt: getExpiryDate(Number(expiry)) };

      let payload = {};
      if (usePassword && password.trim()) {
        const { ciphertext, iv, salt, iterations } = await encryptWithPassword(text, password);
        payload = { ciphertext, iv, salt, iterations, meta };
      } else {
        const { ciphertext, iv, key } = await encryptText(text);
        payload = { ciphertext, iv, key, meta };
      }

      const res = await createPaste(payload);
      const shareUrl = usePassword
        ? `${window.location.origin}/b/${res.id}`
        : `${window.location.origin}/b/${res.id}#${payload.key}`;

      saveToLocal({
        id: res.id,
        url: shareUrl,
        createdAt: new Date().toISOString(),
        expiresAt: meta.expiresAt,
      });

      setText("");
      setPassword("");
      setUsePassword(false);
      toast.success("Paste created successfully!");
    } catch (err) {
      console.error(err);
      toast.error(" Failed to create paste.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    const { id } = deleteModal;
    try {
      await deletePaste(id);
    } catch {
      console.warn("Backend delete failed, removing locally anyway.");
    }

    const updated = myPastes.filter((p) => p.id !== id);
    setMyPastes(updated);
    localStorage.setItem("securebin_pastes", JSON.stringify(updated));
    setDeleteModal({ open: false, id: null });
    toast.success("🗑️ Paste deleted successfully!");
  };

  const handleCopy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(" Link copied!");
    } catch {
      toast.error(" Failed to copy link.");
    }
  };

  const expiryOptions = [
    { label: " Burn after reading", value: "burn" },
    { label: "1 Minute", value: "60" },
    { label: " 10 Minutes", value: "600" },
    { label: " 30 Minutes", value: "1800" },
    { label: " 1 Hour", value: "3600" },
    { label: " 12 Hours", value: "43200" },
    { label: " 24 Hours", value: "86400" },
    { label: " 7 Days", value: "604800" },
    { label: " 30 Days", value: "2592000" },
  ];

  return (
    <div className="max-w-3xl mx-auto p-6 text-white">
      <ToastContainer
        position="bottom-right"
        autoClose={2500}
        hideProgressBar={false}
        transition={Slide}
        toastClassName="rounded-[12px] bg-[#151515] text-white shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
        bodyClassName="text-sm break-words"
      />

      <h1 className="text-3xl font-bold mb-6 text-center text-white">Create a Secure Paste </h1>

      {/* Input Card */}
      <div className="bg-[#151515] p-6 rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.4)] space-y-4">
        <textarea
          className="w-full bg-[#151515] border border-[#2A2A2A] rounded-[8px] p-3 text-sm text-white 
                     placeholder-[#666666] focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/30 outline-none resize-none h-48"
          placeholder="Type or paste your secret text..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {/* Expiry Selector */}
        <div>
          <label className="text-[#A1A1A1] text-sm font-medium">Expiration Time</label>
          <select
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="w-full mt-1 bg-[#151515] border border-[#2A2A2A] text-white rounded-[8px] p-2 text-sm
                       focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/30 outline-none"
          >
            {expiryOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#151515] text-white">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Password Protection */}
        <div className="flex items-center gap-2 mt-2">
          <input
            id="usePassword"
            type="checkbox"
            checked={usePassword}
            onChange={(e) => setUsePassword(e.target.checked)}
            className="w-4 h-4 accent-[#FF5A00]"
          />
          <label htmlFor="usePassword" className="text-sm text-[#A1A1A1]">
            Protect with password
          </label>
        </div>

        {usePassword && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#151515] border border-[#2A2A2A] rounded-[8px] p-2 text-sm text-white mt-2
                       placeholder-[#666666] focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/30 outline-none"
            placeholder="Enter password"
          />
        )}

        {/* Button */}
        <button
          onClick={handleCreate}
          disabled={loading}
          className={`w-full mt-3 font-medium py-2 rounded-[8px] bg-[#1E1E1E] hover:bg-[#2A2A2A] transition-all duration-200
                      ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          {loading ? "Encrypting..." : "Create Secure Link"}
        </button>
      </div>

      {/* My Pastes */}
      {myPastes.length > 0 && (
        <div className="mt-10">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold text-white">My Pastes</h2>
            <button
              onClick={() => {
                localStorage.removeItem("securebin_pastes");
                setMyPastes([]);
                toast.info("🧹 Cleared all pastes.");
              }}
              className="text-sm px-3 py-1 bg-[#202020] hover:bg-[#292929] text-white rounded-[8px]"
            >
              Clear All
            </button>
          </div>

          <div className="space-y-3">
            {myPastes.map((p) => (
              <div
                key={p.id}
                className="bg-[#151515] border border-[#2A2A2A] rounded-[12px] p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
              >
                <div className="flex flex-col text-sm w-full sm:w-auto">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#FF5A00] hover:underline break-all"
                  >
                    {p.url}
                  </a>
                  {p.expiresAt && (
                    <span className="text-[#A1A1A1] text-xs mt-1">
                      Expires: {new Date(p.expiresAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleCopy(p.url)}
                    className="flex items-center gap-1 bg-[#202020] hover:bg-[#292929] text-white text-xs px-3 py-1 rounded-[8px]"
                  >
                    <ClipboardCopy size={14} /> Copy
                  </button>
                  <button
                    onClick={() => setDeleteModal({ open: true, id: p.id })}
                    className="flex items-center gap-1 bg-[#1E1E1E] hover:bg-[#FF5A00] text-white text-xs px-3 py-1 rounded-[8px]"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#151515] p-6 rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.5)] text-center max-w-sm w-[90%]">
            <h3 className="text-lg font-semibold mb-4">Delete this paste?</h3>
            <div className="flex justify-center gap-3 mt-2">
              <button
                onClick={handleDeleteConfirmed}
                className="bg-[#FF5A00] hover:bg-[#FF7633] text-white px-4 py-2 rounded-[8px] transition"
              >
                Yes
              </button>
              <button
                onClick={() => setDeleteModal({ open: false, id: null })}
                className="bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white px-4 py-2 rounded-[8px] transition"
              >
                No
              </button>
            </div>
            <button
              onClick={() => setDeleteModal({ open: false, id: null })}
              className="absolute top-3 right-4 text-[#A1A1A1] hover:text-white transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
