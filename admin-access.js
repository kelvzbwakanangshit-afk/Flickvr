"use strict";
const fs = require("fs");
const path = require("path");

// Admin IDs are managed from the Phobia dashboard and saved here.
// BOT_ADMIN_IDS is still honoured as an optional extra source.
const STORE_PATH = path.join(__dirname, "phobia-data.json");

function parseAdminIds(value = "") {
  return [...new Set(String(value)
    .split(/[,;\s]+/)
    .map(id => id.trim())
    .filter(id => /^\d{1,30}$/.test(id)))];
}

function readStore() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")); } catch (_) { return {}; }
}

function getStoredAdminIds() {
  const data = readStore();
  return Array.isArray(data.adminIds) ? parseAdminIds(data.adminIds.join(",")) : [];
}

function setStoredAdminIds(value) {
  const ids = parseAdminIds(Array.isArray(value) ? value.join(",") : value);
  const data = readStore();
  data.adminIds = ids;
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  return ids;
}

function isBotAdmin(senderID, configuredIds) {
  const id = String(senderID || "").trim();
  if (!id) return false;
  const admins = configuredIds === undefined
    ? parseAdminIds([...getStoredAdminIds(), ...parseAdminIds(process.env.BOT_ADMIN_IDS || "")].join(","))
    : parseAdminIds(configuredIds);
  return admins.includes(id);
}

module.exports = { parseAdminIds, isBotAdmin, getStoredAdminIds, setStoredAdminIds };
