// Upload format tests: GIF (animated, first-frame thumb), JPEG, and empty groupId
// (as the desktop useUpload always appends a groupId field, possibly empty).
const fs = require("fs");
const path = require("path");

const BASE = "http://127.0.0.1:3100";

function formDataWithFile(fieldName, filename, buf, extra) {
  const boundary = "----ohmymeme" + Date.now() + Math.random();
  const parts = [];
  for (const [k, v] of Object.entries(extra || {})) {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
  }
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`
  );
  const head = Buffer.from(parts.join(""), "utf8");
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return { body: Buffer.concat([head, buf, tail]), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function main() {
  const envPath = path.resolve(__dirname, "..", "..", "nuxt-app", ".env");
  const envContent = fs.readFileSync(envPath, "utf8");
  const accessToken = envContent
    .split("\n")
    .find((l) => l.startsWith("NUXT_ACCESS_TOKEN="))
    .split("=")
    .slice(1)
    .join("=")
    .trim();

  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: accessToken }),
  });
  const { token } = await loginRes.json();
  const headers = { Authorization: `Bearer ${token}` };

  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  const jpeg = Buffer.from(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==",
    "base64"
  );

  let fail = 0;
  const check = (name, cond, detail) => {
    if (!cond) fail++;
    console.log(cond ? "PASS" : "FAIL", name, detail || "");
  };

  // 1. GIF upload with EMPTY groupId (desktop always appends it)
  const fd1 = formDataWithFile("files", "anim.gif", gif, { groupId: "" });
  const res1 = await fetch(`${BASE}/api/memes`, {
    method: "POST",
    headers: { ...headers, "Content-Type": fd1.contentType },
    body: fd1.body,
  });
  const body1 = await res1.json();
  check("gif upload created", body1.results?.[0]?.status === "created", JSON.stringify(body1));

  // find the gif meme (it lands in ungrouped)
  const listRes = await fetch(`${BASE}/api/memes?limit=100`, { headers });
  const listBody = await listRes.json();
  const gifMeme = listBody.items.find((m) => m.mimeType === "image/gif");
  check("gif meme found", !!gifMeme, JSON.stringify(gifMeme));
  check("gif mimeType", gifMeme?.mimeType === "image/gif");
  check("gif thumbUrl present", !!gifMeme?.thumbUrl);

  if (gifMeme) {
    const thumbRes = await fetch(`${BASE}${gifMeme.thumbUrl}`, { headers });
    const ct = thumbRes.headers.get("content-type");
    const buf = Buffer.from(await thumbRes.arrayBuffer());
    check("gif thumb is webp", thumbRes.status === 200 && ct === "image/webp", `${ct} bytes=${buf.length}`);
    // thumb bytes must start with RIFF....WEBP
    const webpMagic = buf.length > 12 && buf.slice(0, 4).toString("latin1") === "RIFF" && buf.slice(8, 12).toString("latin1") === "WEBP";
    check("gif thumb webp magic", webpMagic, buf.slice(0, 12).toString("hex"));
    const fileRes = await fetch(`${BASE}${gifMeme.url}`, { headers });
    const fileBuf = Buffer.from(await fileRes.arrayBuffer());
    check("gif file roundtrip", fileBuf.equals(gif), `bytes=${fileBuf.length}`);
  }

  // 2. JPEG upload
  const fd2 = formDataWithFile("files", "photo.jpg", jpeg, { groupId: "" });
  const res2 = await fetch(`${BASE}/api/memes`, {
    method: "POST",
    headers: { ...headers, "Content-Type": fd2.contentType },
    body: fd2.body,
  });
  const body2 = await res2.json();
  check("jpeg upload created", body2.results?.[0]?.status === "created", JSON.stringify(body2));

  const listRes2 = await fetch(`${BASE}/api/memes?limit=100`, { headers });
  const jpegMeme = (await listRes2.json()).items.find((m) => m.mimeType === "image/jpeg");
  check("jpeg mimeType", jpegMeme?.mimeType === "image/jpeg");
  if (jpegMeme) {
    const thumbRes = await fetch(`${BASE}${jpegMeme.thumbUrl}`, { headers });
    const ct = thumbRes.headers.get("content-type");
    const buf = Buffer.from(await thumbRes.arrayBuffer());
    check("jpeg thumb is webp", thumbRes.status === 200 && ct === "image/webp", `${ct} bytes=${buf.length}`);
  }

  // 3. no-groupId at all (field omitted)
  const fd3 = formDataWithFile("files", "solo.png", gif, {});
  const res3 = await fetch(`${BASE}/api/memes`, {
    method: "POST",
    headers: { ...headers, "Content-Type": fd3.contentType },
    body: fd3.body,
  });
  const body3 = await res3.json();
  check("no-groupId upload ok", body3.results?.[0]?.status === "created", JSON.stringify(body3));

  // cleanup: delete all memes created here
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
