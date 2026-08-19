// Triggers every logging point against the test server (port 3100, RUST_LOG=debug)
const fs = require("fs");
const path = require("path");

const BASE = "http://127.0.0.1:3100";

function formData(files, extra = {}) {
  const boundary = "----ohmymeme" + Date.now() + Math.random();
  const chunks = [];
  for (const [k, v] of Object.entries(extra)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`, "utf8"));
  }
  for (const { name, filename, buf } of files) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`, "utf8"));
    chunks.push(buf);
    chunks.push(Buffer.from("\r\n", "utf8"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function main() {
  const envPath = path.resolve(__dirname, "..", "..", "nuxt-app", ".env");
  const accessToken = fs.readFileSync(envPath, "utf8").split("\n").find((l) => l.startsWith("NUXT_ACCESS_TOKEN=")).split("=").slice(1).join("=").trim();

  // 1. unauthenticated -> 401 (guard debug log)
  await fetch(`${BASE}/api/groups`);
  // 2. wrong login -> 401 warn
  await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: "wrong-key" }) });
  // 3. correct login -> info
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: accessToken }) })).json();
  const headers = { Authorization: `Bearer ${login.token}` };
  // 4. create group -> info
  const group = await (await fetch(`${BASE}/api/groups`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ name: "log-test" }) })).json();
  // 5. upload -> info per file
  const png = fs.readFileSync(path.join(__dirname, "..", ".tmp", "test.png"));
  const fd = formData([{ name: "files", filename: "log.png", buf: png }], { groupId: group.id });
  await fetch(`${BASE}/api/memes`, { method: "POST", headers: { ...headers, "Content-Type": fd.contentType }, body: fd.body });
  // 6. upload a bad file -> warn
  const badFd = formData([{ name: "files", filename: "bad.txt", buf: Buffer.from("hello") }], { groupId: group.id });
  await fetch(`${BASE}/api/memes`, { method: "POST", headers: { ...headers, "Content-Type": badFd.contentType }, body: badFd.body });
  // 7. delete group -> info
  await fetch(`${BASE}/api/groups/${group.id}`, { method: "DELETE", headers });
  // 8. WS connect -> info (sync message triggers debug broadcast)
  await new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:3100/ws?token=${encodeURIComponent(login.token)}`);
    ws.onopen = () => {
      setTimeout(() => { ws.close(); resolve(); }, 500);
    };
  });
  // 9. rate limit trigger -> warn (6 wrong logins)
  for (let i = 0; i < 6; i++) {
    await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: "wrong-key" }) });
  }
  console.log("log triggers done");
  process.exit(0);
}

main().catch((e) => { console.log("FAIL", e.message); process.exit(1); });
