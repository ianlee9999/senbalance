import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || process.env.DRY_RUN !== "false";
const draftPath = getArgValue("--draft") ?? path.join(rootDir, "drafts", "example-draft.json");
const accountsPath = path.join(rootDir, "config", "accounts.json");

loadDotEnv(path.join(rootDir, ".env"));
loadWindowsUserEnv([
  "SENBALANCE_IG_USER_ID",
  "SENBALANCE_IG_ACCESS_TOKEN",
  "KAJINSHU_IG_USER_ID",
  "KAJINSHU_IG_ACCESS_TOKEN",
  "IANLEE_IG_USER_ID",
  "IANLEE_IG_ACCESS_TOKEN",
  "SENBALANCE_THREADS_USER_ID",
  "SENBALANCE_THREADS_ACCESS_TOKEN",
  "IANLEE_THREADS_USER_ID",
  "IANLEE_THREADS_ACCESS_TOKEN"
]);

const draft = readJson(draftPath);
const config = readJson(accountsPath);

validateDraft(draft);

console.log(`Draft: ${draftPath}`);
console.log(`Status: ${draft.status}`);
console.log(`Mode: ${dryRun ? "dry-run" : "publish"}`);

if (draft.status !== "approved") {
  console.log("Draft is not approved. Publish is blocked until status is \"approved\".");
  process.exit(0);
}

for (const account of config.accounts) {
  const text = draft.posts?.[account.contentKey];
  if (!text) {
    console.log(`[skip] ${account.id}: no content for ${account.contentKey}`);
    continue;
  }

  if (!account.enabled) {
    console.log(`[manual] ${account.id}: disabled in config. Content ready for manual posting.`);
    continue;
  }

  const userId = process.env[account.userIdEnv];
  const accessToken = process.env[account.tokenEnv];
  if (!userId || !accessToken) {
    console.log(`[blocked] ${account.id}: missing ${account.userIdEnv} or ${account.tokenEnv}`);
    continue;
  }

  if (dryRun) {
    console.log(`[dry-run] ${account.id} -> ${account.platform} @${account.handle}`);
    console.log(text);
    continue;
  }

  await publishAccount(account, userId, accessToken, text);
}

for (const account of config.manualAccounts ?? []) {
  console.log(`[manual-only] ${account.id}: ${account.reason}`);
}

async function publishAccount(account, userId, accessToken, text) {
  if (account.platform === "facebook-page") {
    await postForm(`https://graph.facebook.com/v20.0/${userId}/feed`, {
      message: text,
      access_token: accessToken
    }, account.id);
    return;
  }

  if (account.platform === "threads") {
    const create = await postForm(`https://graph.threads.net/v1.0/${userId}/threads`, {
      media_type: "TEXT",
      text,
      access_token: accessToken
    }, `${account.id}:create`);
    await postForm(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
      creation_id: create.id,
      access_token: accessToken
    }, `${account.id}:publish`);
    return;
  }

  if (account.platform === "instagram") {
    console.log(`[blocked] ${account.id}: Instagram API publishing needs media creation. Text-only publishing is not supported in this scaffold.`);
    return;
  }

  console.log(`[blocked] ${account.id}: unsupported platform ${account.platform}`);
}

async function postForm(url, fields, label) {
  const body = new URLSearchParams(fields);
  const response = await fetch(url, { method: "POST", body });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${JSON.stringify(json)}`);
  }
  console.log(`[published] ${label}: ${JSON.stringify(json)}`);
  return json;
}

function validateDraft(value) {
  if (!value || typeof value !== "object") throw new Error("Draft must be an object.");
  if (!value.date) throw new Error("Draft must include date.");
  if (!value.status) throw new Error("Draft must include status.");
  if (!value.posts || typeof value.posts !== "object") throw new Error("Draft must include posts.");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getArgValue(name) {
  const argsList = process.argv.slice(2);
  const index = argsList.indexOf(name);
  return index >= 0 ? argsList[index + 1] : undefined;
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function loadWindowsUserEnv(keys) {
  if (process.platform !== "win32") return;
  for (const key of keys) {
    if (process.env[key]) continue;
    const value = readWindowsUserEnv(key);
    if (value) process.env[key] = value;
  }
}

function readWindowsUserEnv(key) {
  try {
    const output = execFileSync("reg", [
      "query",
      "HKCU\\Environment",
      "/v",
      key
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const line = output.split(/\r?\n/).find((entry) => entry.includes(key));
    if (!line) return "";
    return line.trim().split(/\s{2,}/).pop() ?? "";
  } catch {
    return "";
  }
}
