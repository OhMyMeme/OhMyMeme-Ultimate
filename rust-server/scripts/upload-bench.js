// Upload performance benchmark + thumbnail dimension verification against port 3100.
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
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
        "utf8"
      )
    );
    chunks.push(buf);
    chunks.push(Buffer.from("\r\n", "utf8"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

function parseWebpSize(buf) {
  // RIFF....WEBP then chunk: 4CC + size + payload; VP8 (lossy) / VP8L (lossless) / VP8X (extended)
  if (buf.length < 30) return null;
  if (buf.slice(0, 4).toString("latin1") !== "RIFF" || buf.slice(8, 12).toString("latin1") !== "WEBP") return null;
  let off = 12;
  while (off + 8 <= buf.length) {
    const fourcc = buf.slice(off, off + 4).toString("latin1");
    const size = buf.readUInt32LE(off + 4);
    const payload = off + 8;
    if (fourcc === "VP8 ") {
      // 14 bits each, little endian, at payload+6
      const dims = buf.readUInt32LE(payload + 6);
      return { w: dims & 0x3fff, h: (dims >> 14) & 0x3fff };
    }
    if (fourcc === "VP8L") {
      const b = buf.readUInt32LE(payload + 1);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
    if (fourcc === "VP8X") {
      const b = buf.readUInt32LE(payload + 4);
      return { w: (b & 0xffffff) + 1, h: ((b >> 24) & 0xffffff) + 1 };
    }
    off = payload + size + (size % 2); // chunks are 2-byte aligned
  }
  return null;
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
  const check = (n, c, d) => {
    if (!c) fail++;
    console.log(c ? "PASS" : "FAIL", n, d || "");
  };

  const big = fs.readFileSync(path.join(__dirname, "..", ".tmp", "big-test.png"));
  const small = fs.readFileSync(path.join(__dirname, "..", ".tmp", "test.png"));

  // 1. single 2048px upload timing
  let t0 = Date.now();
  let fd = formData([{ name: "files", filename: "big.png", buf: big }], { groupId: "" });
  let res = await fetch(`${BASE}/api/memes`, {
    method: "POST",
    headers: { ...headers, "Content-Type": fd.contentType },
    body: fd.body,
  });
  let body = await res.json();
  let bigMs = Date.now() - t0;
  check("2048px upload created", body.results?.[0]?.status === "created", `${bigMs}ms`);

  // 2. tiny 1x1 upload timing (baseline)
  t0 = Date.now();
  fd = formData([{ name: "files", filename: "tiny.png", buf: small }], { groupId: "" });
  res = await fetch(`${BASE}/api/memes`, {
    method: "POST",
    headers: { ...headers, "Content-Type": fd.contentType },
    body: fd.body,
  });
  body = await res.json();
  const tinyMs = Date.now() - t0;
  check("1x1 upload created", body.results?.[0]?.status === "created", `${tinyMs}ms`);

  // 3. batch of 10 small files
  t0 = Date.now();
  const batch = Array.from({ length: 10 }, (_, i) => ({
    name: "files",
    filename: `b${i}.png`,
    buf: small,
  }));
  fd = formData(batch, { groupId: "" });
  res = await fetch(`${BASE}/api/memes`, {
    method: "POST",
    headers: { ...headers, "Content-Type": fd.contentType },
    body: fd.body,
  });
  body = await res.json();
  const batchMs = Date.now() - t0;
  const created = body.results?.filter((r) => r.status === "created").length || 0;
  check("batch of 10 created", created === 10, `${batchMs}ms (${created}/10)`);

  // 4. thumbnail dimension = 256x256 (cover)
  const list = await (await fetch(`${BASE}/api/memes?limit=100`, { headers })).json();
  const bigMeme = list.items.find((m) => m.name === "big.png");
  check("big meme found", !!bigMeme);
  if (bigMeme) {
    const thumbRes = await fetch(`${BASE}${bigMeme.thumbUrl}`, { headers });
    const buf = Buffer.from(await thumbRes.arrayBuffer());
    const size = parseWebpSize(buf);
    check("thumb is 256x256 webp", size && size.w === 256 && size.h === 256, JSON.stringify(size));
  }

  // 5. tiny meme thumb also 256x256
  const tinyMeme = list.items.find((m) => m.name === "tiny.png");
  if (tinyMeme) {
    const thumbRes = await fetch(`${BASE}${tinyMeme.thumbUrl}`, { headers });
    const buf = Buffer.from(await thumbRes.arrayBuffer());
    const size = parseWebpSize(buf);
    check("tiny thumb 256x256 (no enlargement)", size && size.w === 256 && size.h === 256, JSON.stringify(size));
  }

  console.log(`\n[timing] 2048px: ${bigMs}ms | 1x1: ${tinyMs}ms | batch10: ${batchMs}ms`);

  // cleanup
  const all = await (await fetch(`${BASE}/api/memes?limit=100`, { headers })).json();
  if (all.items?.length) {
    await fetch(`${BASE}/api/memes/batch`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: all.items.map((m) => m.id), action: "delete" }),
    });
  }
  console.log("cleaned up");
  console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILED`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.log("FAIL", e.message);
  process.exit(1);
});
