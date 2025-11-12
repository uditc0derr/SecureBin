import crypto from "crypto";

export const generateId = (length = 10) => {
  return crypto.randomBytes(length).toString("base64url");
};
