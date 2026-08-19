// Additional edge-case verification:
// 1. upload 5 PNGs to one group -> group covers has 4 (topN)
// 2. upload a text file -> results status "failed" with format reason
// 3. upload without groupId -> lands in 未分组
const fs = require("fs");
const path = require("path");

const BASE = "http://127.0.0.1:3100";

function formDataWithFile(fieldName, filename, buf, extra) {
  const boundary = "----ohmymeme" + Date.now();
  const parts = [];
  for (const [k, v] of Object.entries(extra || {})) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`
    );
  }
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`
  );
  const head = Buffer.from(parts.join(""), "utf8");
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return {
    body: Buffer.concat([head, buf, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
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

  const png = fs.readFileSync(path.join(__dirname, "..", ".tmp", "test.png"));

  // create group
  const groupRes = await fetch(`${BASE}/api/groups`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ name: `covers-test-${Date.now()}` }),
  });
  const group = await groupRes.json();
  console.log("PASS create covers group", group.id);

  // upload 5 pngs to that group
  for (let i = 0; i < 5; i++) {
    const fd = formDataWithFile("files", `img${i}.png`, png, { groupId: group.id });
    const res = await fetch(`${BASE}/api/memes`, {
      method: "POST",
      headers: { ...headers, "Content-Type": fd.contentType },
      body: fd.body,
    });
    const body = await res.json();
    if (body.results?.[0]?.status !== "created") {
      console.log("FAIL upload img" + i, JSON.stringify(body));
      process.exit(1);
    }
  }
  console.log("PASS uploaded 5 pngs");

  // upload a text file -> failed
  const badFd = formDataWithFile("files", "note.txt", Buffer.from("hello"), { groupId: group.id });
  const badRes = await fetch(`${BASE}/api/memes`, {
    method: "POST",
    headers: { ...headers, "Content-Type": badFd.contentType },
    body: badFd.body,
  });
  const badBody = await badRes.json();
  const badOk =
    badBody.results?.[0]?.status === "failed" &&
    String(badBody.results?.[0]?.reason).includes("格式不支持");
  console.log(badOk ? "PASS bad file rejected" : "FAIL bad file", JSON.stringify(badBody));

  // upload without groupId -> ungrouped
  const noGroupFd = formDataWithFile("files", "no-group.png", png, {});
  const noGroupRes = await fetch(`${BASE}/api/memes`, {
    method: "POST",
    headers: { ...headers, "Content-Type": noGroupFd.contentType },
    body: noGroupFd.body,
  });
  const noGroupBody = await noGroupRes.json();
  const noGroupOk = noGroupBody.results?.[0]?.status === "created";
  console.log(noGroupOk ? "PASS no-group upload created" : "FAIL no-group upload", JSON.stringify(noGroupBody));

  // check groups covers
  const groups = await (await fetch(`${BASE}/api/groups`, { headers })).json();
  const target = groups.find((g) => g.id === group.id);
  console.log(
    target && target.covers.length === 4 && target.count === 5
      ? "PASS covers topN=4, count=5"
      : "FAIL covers/count",
    JSON.stringify(target)
  );

  // ungrouped group now has 1
  const ungrouped = groups.find((g) => g.isUngrouped);
  console.log(
    ungrouped && ungrouped.count >= 1 ? "PASS ungrouped count>=1" : "FAIL ungrouped count",
    JSON.stringify(ungrouped)
  );

  // cleanup: delete test group + its memes via batch
  const memesRes = await fetch(`${BASE}/api/memes?group=${group.id}&limit=100`, { headers });
  const memesBody = await memesRes.json();
  if (memesBody.items?.length) {
    await fetch(`${BASE}/api/memes/batch`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: memesBody.items.map((m) => m.id), action: "delete" }),
    });
  }
  await fetch(`${BASE}/api/groups/${group.id}`, { method: "DELETE", headers });
  console.log("cleaned up");
  process.exit(0);
}

main().catch((e) => {
  console.log("FAIL", e.message);
  process.exit(1);
});
