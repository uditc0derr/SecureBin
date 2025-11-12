import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPaste, deletePaste } from "../api/paste";
import { decryptText, decryptWithPassword } from "../utils/crypto";
import { formatDateTime } from "../utils/helpers";
import { ClipboardCopy, Lock } from "lucide-react";

export default function ViewPaste() {
  const { id } = useParams();
  const [cipherData, setCipherData] = useState(null);
  const [decryptedText, setDecryptedText] = useState("");
  const [meta, setMeta] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [burning, setBurning] = useState(false);

  useEffect(() => {
    const fetchPaste = async () => {
      try {
        const key = window.location.hash.slice(1);
        const data = await getPaste(id);

        if (!data || !data.ciphertext) {
          removeFromLocal(id);
          setError("Paste not found or expired.");
          setLoading(false);
          return;
        }

        setCipherData(data);
        setMeta(data.meta);

        if (data.salt && !key) {
          setNeedsPassword(true);
        } else {
          const decrypted = await decryptText(data.ciphertext, data.iv, key);
          if (decrypted) {
            setDecryptedText(decrypted);

            if (data.meta?.burnOnRead) {
              setTimeout(() => handleBurnAfterRead(data.meta), 1500);
            }
          } else {
            setError("Decryption failed or invalid key.");
          }
        }
      } catch (err) {
        console.error("Error fetching paste:", err);
        if (err.response && (err.response.status === 404 || err.response.status === 410)) {
          removeFromLocal(id);
          setError("This paste was deleted or expired.");
        } else {
          setError("Unable to fetch this paste.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPaste();
  }, [id]);

  const removeFromLocal = (pasteId) => {
    const stored = JSON.parse(localStorage.getItem("securebin_pastes")) || [];
    const updated = stored.filter((p) => p.id !== pasteId);
    localStorage.setItem("securebin_pastes", JSON.stringify(updated));
  };

  const handleBurnAfterRead = async (metaData) => {
    if (metaData?.burnOnRead && !burning) {
      try {
        setBurning(true);
        await deletePaste(id);
        removeFromLocal(id);

      } catch (err) {
        console.warn(" Failed to burn paste:", err.message);
      } finally {
        setBurning(false);
      }
    }
  };

  const handlePasswordDecrypt = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;

    try {
      const decrypted = await decryptWithPassword(
        cipherData.ciphertext,
        cipherData.iv,
        cipherData.salt,
        cipherData.iterations,
        password
      );

      if (!decrypted) {
        setError("Invalid password or corrupted paste.");
      } else {
        setDecryptedText(decrypted);
        setNeedsPassword(false);
        if (cipherData.meta?.burnOnRead) {
          setTimeout(() => handleBurnAfterRead(cipherData.meta), 1500);
        }
      }
    } catch (err) {
      console.error("Decryption failed:", err);
      setError("Invalid password or corrupted paste.");
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(decryptedText);
      console.log("Text copied!");
    } catch {
      console.error(" Failed to copy text.");
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen text-[#A1A1A1] bg-[#0C0C0C]">
        Loading paste...
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-[#0C0C0C]">
        <p className="font-semibold text-[#FF4D4D]">{error}</p>
        <p className="text-[#A1A1A1] text-sm mt-1">
          This paste may have been deleted, expired, or burned after reading.
        </p>
      </div>
    );

  if (needsPassword)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0C0C0C] px-4">
        <div className="bg-[#151515] shadow-[0_4px_20px_rgba(0,0,0,0.4)] rounded-[16px] p-6 max-w-sm w-full text-center mt-20">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center justify-center gap-2">
            <Lock size={18} className="text-[#FF5A00]" /> Enter Password
          </h2>
          <form onSubmit={handlePasswordDecrypt}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password..."
              className="w-full bg-[#151515] border border-[#2A2A2A] text-white placeholder-[#666666] 
                         rounded-[8px] p-2 text-sm mb-3 focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/30 outline-none"
            />
            <button
              type="submit"
              className="w-full bg-[#1E1E1E] text-white py-2 rounded-[8px] font-medium hover:bg-[#2A2A2A] transition"
            >
              Decrypt Paste
            </button>
          </form>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white px-6 py-10">
      <div className="max-w-3xl mx-auto bg-[#151515] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.4)] p-6">
        <h1 className="text-2xl font-bold text-white mb-5 text-center">
          Decrypted Paste
        </h1>

        {/* Paste Text */}
        <div className="relative bg-[#1F1F1F] border border-[#2A2A2A] rounded-[12px] p-4 overflow-x-auto">
          <pre className="whitespace-pre-wrap break-words text-[#FFFFFF] font-mono text-sm leading-relaxed">
            {decryptedText}
          </pre>

          <button
            onClick={handleCopyText}
            className="absolute top-2 right-2 flex items-center gap-1 bg-[#202020] hover:bg-[#292929] 
                       text-white text-xs px-3 py-1 rounded-[8px] transition-all"
          >
            <ClipboardCopy size={14} /> Copy
          </button>
        </div>

        {/* Metadata */}
        <div className="mt-4 text-sm text-right text-[#A1A1A1]">
          {meta?.expiresAt && (
            <p>
              Expires At:{" "}
              <span className="font-medium text-white">
                {formatDateTime(meta.expiresAt)}
              </span>
            </p>
          )}
          {meta?.burnOnRead && (
            <p className="text-[#FF5A00] font-semibold mt-1">
              🔥 This paste will self-destruct after viewing.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
