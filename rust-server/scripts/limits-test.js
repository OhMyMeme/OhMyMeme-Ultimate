// Limits & pagination tests:
// 1. 21MB file -> per-file "文件超过 20MB" failure (does not block the batch)
// 2. mixed batch: 2 valid + 1 oversize -> 2 created + 1 failed
// 3. pagination: limit/offset semantics
const fs = require("fs");
const path = require("path");

const BASE = "http://127.0.0.1:3100";

function formData(files, extra = {}) {
  const boundary = "----ohmymeme" + Date.now() + Math.random();
  const parts = [];
  for (const [k, v] of Object.entries(extra)) {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
  }
  for (const { name, filename, buf } of files) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`
    );
    parts.push({ buf });
    parts.push("\r\n");
  }
  parts.push(`--${boundary}--\r\n`);
  const head = Buffer.from(parts.filter((p) => typeof p === "string").join(""), "utf8");
  const body = Buffer.concat([head, ...parts.filter((p) => typeof p === "object").map((p) => p.buf), Buffer.from(parts.filter((p) => typeof p === "string").join(""), "utf8")]);
  // rebuild properly: strings and buffers interleaved
  const chunks = [];
  for (const p of parts) {
    if (typeof p === "string") chunks.push(Buffer.from(p, "utf8"));
    else chunks.push(p.buf);
  }
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function main() {
  const envPath = path.resolve(__dirname, "..", "..", "nuxt-app", ".env");
  const accessToken = fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .find((l) => l.startsWith("NUXT_ACCESS_TOKEN="))
    .split("=")
    .slice(1)
    .join("=")
    .trim();

  const { token } = await (await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: accessToken }),
  })).json();
  const headers = { Authorization: `Bearer ${token}` };

  let fail = 0;
  const check = (name, cond, detail) => {
    if (!cond) fail++;
    console.log(cond ? "PASS" : "FAIL", name, detail || "");
  };

  const png = fs.readFileSync(path.join(__dirname, "..", ".tmp", "test.png"));
  const big = fs.readFileSync(path.join(__dirname, "..", ".tmp", "big.png"));
  check("big file is 21MB", big.length > 20 * 1024 * 1024, `${big.length} bytes`);

  // 1. oversize-only batch
  let fd = formData([{ name: "files", filename: "huge.png", buf: big }], { groupId: "" });
  let res = await fetch(`${BASE}/api/memes`, {
    method: "POST",
    headers: { ...headers, "Content-Type": fd.contentType },
    body: fd.body,
  });
  let body = await res.json();
  check(
    "oversize -> failed w/ reason",
    body.results?.[0]?.status === "failed" && /20MB/.test(body.results?.[0]?.reason || ""),
    JSON.stringify(body)
  );

  // 2. mixed batch: 2 valid + 1 oversize
  fd = formData(
    [
      { name: "files", filename: "ok1.png", buf: png },
      { name: "files", filename: "huge.png", buf: big },
      { name: "files", filename: "ok2.png", buf: png },
    ],
    { groupId: "" }
  );
  res = await fetch(`${BASE}/api/memes`, {
    method: "POST",
    headers: { ...headers, "Content-Type": fd.contentType },
    body: fd.body,
  });
  body = await res.json();
  const statuses = body.results?.map((r) => r.status) || [];
  check("mixed batch: 2 created + 1 failed", statuses.filter((s) => s === "created").length === 2 && statuses.filter((s) => s === "failed").length === 1, JSON.stringify(body));

  // 3. pagination: after batch 1 (0 created) + batch 2 (2 created), total = 2
  let page = await (await fetch(`${BASE}/api/memes?limit=2&offset=0`, { headers })).json();
  check("page1 size 2", page.items.length === 2 && page.total === 2 && page.limit === 2 && page.offset === 0, JSON.stringify({ n: page.items.length, total: page.total }));
  page = await (await fetch(`${BASE}/api/memes?limit=2&offset=2`, { headers })).json();
  check("page2 size 0 (past end)", page.items.length === 0 && page.total === 2 && page.offset === 2, JSON.stringify({ n: page.items.length, total: page.total }));
  page = await (await fetch(`${BASE}/api/memes`, { headers })).json();
  check("default limit 48", page.items.length === 2 && page.limit === 48, JSON.stringify({ n: page.items.length, limit: page.limit }));
  page = await (await fetch(`${BASE}/api/memes?limit=999`, { headers })).json();
  check("limit clamped to 100", page.limit === 100, `limit=${page.limit}`);
  page = await (await fetch(`${BASE}/api/memes?offset=-5`, { headers })).json();
  check("negative offset clamped to 0", page.offset === 0, `offset=${page.offset}`);

  // 4. multi-page walk: upload 3 more -> total 5, walk pages of 2
  fd = formData(
    [
      { name: "files", filename: "p1.png", buf: png },
      { name: "files", filename: "p2.png", buf: png },
      { name: "files", filename: "p3.png", buf: png },
    ],
    { groupId: "" }
  );
  res = await fetch(`${BASE}/api/memes`, {
    method: "POST",
    headers: { ...headers, "Content-Type": fd.contentType },
    body: fd.body,
  });
  body = await res.json();
  const createdNow = body.results?.filter((r) => r.status === "created").length || 0;
  check("3 more created", createdNow === 3, JSON.stringify(body.results));

  page = await (await fetch(`${BASE}/api/memes?limit=2&offset=0`, { headers })).json();
  check("walk p0 size 2 total 5", page.items.length === 2 && page.total === 5, JSON.stringify({ n: page.items.length, total: page.total }));
  page = await (await fetch(`${BASE}/api/memes?limit=2&offset=2`, { headers })).json();
  check("walk p1 size 2 total 5", page.items.length === 2 && page.total === 5, JSON.stringify({ n: page.items.length, total: page.total }));
  page = await (await fetch(`${BASE}/api/memes?limit=2&offset=4`, { headers })).json();
  check("walk p2 size 1 total 5", page.items.length === 1 && page.total === 5, JSON.stringify({ n: page.items.length, total: page.total }));

  // distinct ids across pages
  const ids = new Set();
  for (let off = 0; off < 5; off += 2) {
    const p = await (await fetch(`${BASE}/api/memes?limit=2&offset=${off}`, { headers })).json();
    p.items.forEach((m) => ids.add(m.id));
  }
  check("pages cover 5 distinct ids", ids.size === 5, `distinct=${ids.size}`);

  // invalid id -> 404 (not 400) for group filter
  const badGroup = await fetch(`${BASE}/api/memes?group=000000000000000000000000`, { headers });
  check("unknown group -> 404", badGroup.status === 404, `status=${badGroup.status}`);
  const invalidId = await fetch(`${BASE}/api/memes?group=notanid`, { headers });
  check("invalid group id -> ignored (all memes)", invalidId.status === 200 && (await invalidId.json()).total === 5, `status=${invalidId.status}`);

  // cleanup
  const all = await (await fetch(`${BASE}/api/memes?limit=100`, { headers })).json();
  if (all.items?.length) {
    await fetch(`${BASE}/api/memes/batch`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: all.items.map((m) => m.id), action: "delete" }),
    });
    console.log("cleaned up");
  }

  console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILED`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.log("FAIL", e.message);
  process.exit(1);
});
