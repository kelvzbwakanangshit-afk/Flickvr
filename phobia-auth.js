"use strict";

/**
 * Phobia dashboard password gate.
 * The password is stored only as a salted scrypt hash, so the plain text is
 * not readable from this public file. To change it, run:
 *   node phobia-auth.js "new password"
 * and paste the printed values into SALT and HASH below.
 */
const crypto = require("crypto");

const SALT = "phobia-v1-97540cc56fe30e11";
const HASH = "3e7944bc2ed4c8267d32a7c3dfaf3c310a2472366f75aa13607704db1d1826ea";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;

const tokens = new Map();
const fails = new Map();

function derive(password, salt) {
  return crypto.scryptSync(String(password), salt, 32);
}

function passwordMatches(password) {
  const given = derive(password, SALT);
  const wanted = Buffer.from(HASH, "hex");
  return given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
}

function clientKey(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || (req.socket && req.socket.remoteAddress) || "unknown";
}

function login(req, password) {
  const key = clientKey(req);
  const rec = fails.get(key) || { count: 0, until: 0 };
  if (rec.until > Date.now()) {
    return { ok: false, status: 429, error: "Too many attempts. Try again in a few minutes." };
  }
  if (!passwordMatches(password)) {
    rec.count += 1;
    if (rec.count >= MAX_FAILS) { rec.count = 0; rec.until = Date.now() + LOCK_MS; }
    fails.set(key, rec);
    return { ok: false, status: 401, error: "Wrong password." };
  }
  fails.delete(key);
  const token = crypto.randomBytes(32).toString("hex");
  tokens.set(token, Date.now() + TOKEN_TTL_MS);
  return { ok: true, token, expiresInMs: TOKEN_TTL_MS };
}

function isAuthed(req) {
  const token = String(req.headers["x-phobia-token"] || "");
  const exp = tokens.get(token);
  if (!exp) return false;
  if (exp < Date.now()) { tokens.delete(token); return false; }
  return true;
}

function logout(req) {
  tokens.delete(String(req.headers["x-phobia-token"] || ""));
}

module.exports = { login, isAuthed, logout };

if (require.main === module && process.argv[2]) {
  const salt = "phobia-v1-" + crypto.randomBytes(8).toString("hex");
  console.log('const SALT = "' + salt + '";');
  console.log('const HASH = "' + derive(process.argv[2], salt).toString("hex") + '";');
}
