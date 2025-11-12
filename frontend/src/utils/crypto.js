// frontend/src/utils/crypto.js
// Handles AES-GCM encryption/decryption for client-side E2EE
// Supports both key-based & password-based encryption

// -----------------------------
// Base64URL Helpers
// -----------------------------
const base64UrlEncode = (buffer) => {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const base64UrlDecode = (str) => {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
};

// -----------------------------
// Base58 Helpers (shorter keys)
// -----------------------------
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(buffer) {
  let digits = [0];
  for (const byte of new Uint8Array(buffer)) {
    let carry = byte;
    for (let j = 0; j < digits.length; ++j) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  return digits.reverse().map((d) => ALPHABET[d]).join("");
}

function base58Decode(string) {
  let bytes = [0];
  for (const char of string) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) throw new Error("Invalid Base58 character");
    let carry = value;
    for (let j = 0; j < bytes.length; ++j) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  return new Uint8Array(bytes.reverse()).buffer;
}

// -----------------------------
// AES-GCM Random Key Encryption
// -----------------------------
export async function generateKey() {
  const key = crypto.getRandomValues(new Uint8Array(32)); // 256-bit
  return key;
}

export async function encryptText(plaintext) {
  const key = await generateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", true, [
    "encrypt",
  ]);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: base64UrlEncode(ciphertext),
    iv: base64UrlEncode(iv),
    key: base58Encode(key), // shorter key for URL
  };
}

export async function decryptText(ciphertextB64, ivB64, key58) {
  const decoder = new TextDecoder();
  const ctBuf = base64UrlDecode(ciphertextB64);
  const ivBuf = base64UrlDecode(ivB64);
  const keyBuf = base58Decode(key58);

  const cryptoKey = await crypto.subtle.importKey("raw", keyBuf, "AES-GCM", true, [
    "decrypt",
  ]);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuf },
      cryptoKey,
      ctBuf
    );
    return decoder.decode(decrypted);
  } catch (err) {
    console.error("Decryption failed:", err);
    return null;
  }
}

// -----------------------------
// Password-Based Encryption (PBKDF2 + AES-GCM)
// -----------------------------
export async function deriveKeyFromPassword(password, salt, iterations = 200000) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  return key;
}

export async function encryptWithPassword(plaintext, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKeyFromPassword(password, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: base64UrlEncode(ciphertext),
    iv: base64UrlEncode(iv),
    salt: base64UrlEncode(salt),
    iterations: 200000,
  };
}

export async function decryptWithPassword(ciphertext, iv, salt, iterations, password) {
  try {
    const key = await deriveKeyFromPassword(password, base64UrlDecode(salt), iterations);
    const ctBuf = base64UrlDecode(ciphertext);
    const ivBuf = base64UrlDecode(iv);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBuf }, key, ctBuf);
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error("Password decryption failed:", err);
    return null;
  }
}
