// frontend/src/utils/helpers.js
// Handles expiry, time conversion, and UTC-safe operations

// Map of predefined expiry options (in seconds)
export const expiryOptions = [
  { label: "🔥 Burn after read", value: "burn" },
  { label: "⏱ 1 Minute", value: 60 },
  { label: "🕒 10 Minutes", value: 600 },
  { label: "🕓 30 Minutes", value: 1800 },
  { label: "🕕 1 Hour", value: 3600 },
  { label: "🕘 12 Hours", value: 43200 },
  { label: "🕛 24 Hours", value: 86400 },
  { label: "🗓 7 Days", value: 604800 },
  { label: "📅 1 Month", value: 2592000 },
];

// ✅ Convert seconds → human-readable string (for dropdown display)
export const formatExpiry = (seconds) => {
  if (!seconds || seconds === "burn") return "Burn after read";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${seconds / 60}m`;
  if (seconds < 86400) return `${seconds / 3600}h`;
  return `${seconds / 86400}d`;
};

// ✅ Compute expiry date as UTC ISO string (no timezone drift)
export const getExpiryDate = (seconds) => {
  if (!seconds || seconds === "burn") return null;
  const now = Date.now(); // always UTC internally
  const expiry = new Date(now + seconds * 1000);
  return expiry.toISOString(); // store in UTC for backend
};

// ✅ Compare UTC expiry vs. current UTC time safely
export const isExpired = (expiryIso) => {
  if (!expiryIso) return false;
  const nowUtc = Date.now();
  const expiryUtc = new Date(expiryIso).getTime();
  return expiryUtc <= nowUtc;
};

// ✅ Format UTC date to human-readable local time
export const formatDateTime = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  // Show both local time & relative info
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

// ✅ (Optional helper) Return remaining time as human string
export const timeRemaining = (expiryIso) => {
  if (!expiryIso) return "Never expires";
  const now = Date.now();
  const expiry = new Date(expiryIso).getTime();
  const diffSec = Math.max(0, Math.floor((expiry - now) / 1000));

  if (diffSec <= 0) return "Expired";
  if (diffSec < 60) return `${diffSec}s left`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m left`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h left`;
  return `${Math.floor(diffSec / 86400)}d left`;
};
