// Downloads all crates from Cargo.lock into ./vendor (with .cargo-checksum.json),
// using Node TLS (OpenSSL/BoringSSL) and Windows tar.exe for extraction.
// Usage: node scripts/vendor-download.js
const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const VENDOR_DIR = path.join(ROOT, "vendor");
const CONCURRENCY = 8;

function parseLock() {
  const content = fs.readFileSync(path.join(ROOT, "Cargo.lock"), "utf8");
  const packages = [];
  const blocks = content.split(/(?=\[\[package\]\])/);
  for (const block of blocks) {
    const nameMatch = block.match(/^name = "([^"]+)"/m);
    const versionMatch = block.match(/^version = "([^"]+)"/m);
    const sourceMatch = block.match(/^source = "([^"]+)"/m);
    const checksumMatch = block.match(/^checksum = "([^"]+)"/m);
    if (!nameMatch || !versionMatch || !checksumMatch) continue;
    const source = sourceMatch ? sourceMatch[1] : "";
    if (!source.startsWith("registry+")) continue;
    packages.push({
      name: nameMatch[1],
      version: versionMatch[1],
      checksum: checksumMatch[1],
    });
  }
  return packages;
}

function download(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "user-agent": "ohmymeme-vendor" } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.setTimeout(60000, () => req.destroy(new Error("timeout " + url)));
  });
}

async function fetchCrate(pkg) {
  const { name, version, checksum } = pkg;
  const dir = path.join(VENDOR_DIR, `${name}-${version}`);
  const marker = path.join(dir, ".cargo-checksum.json");
  if (fs.existsSync(marker)) {
    return; // already vendored
  }
  const crateFile = path.join(ROOT, ".tmp", `${name}-${version}.crate`);
  fs.mkdirSync(path.dirname(crateFile), { recursive: true });
  fs.mkdirSync(dir, { recursive: true });

  const url = `https://static.crates.io/crates/${name}/${name}-${version}.crate`;
  const data = await download(url);
  const actual = crypto.createHash("sha256").update(data).digest("hex");
  if (actual !== checksum) {
    throw new Error(`checksum mismatch for ${name}-${version}: got ${actual}, want ${checksum}`);
  }
  fs.writeFileSync(crateFile, data);
  execFileSync("tar.exe", ["-xzf", crateFile, "-C", dir, "--strip-components=1"], { stdio: "ignore" });
  fs.unlinkSync(crateFile);
  fs.writeFileSync(
    path.join(dir, ".cargo-checksum.json"),
    JSON.stringify({ files: {}, package: checksum })
  );
  console.log(`ok ${name}-${version}`);
}

async function main() {
  const packages = parseLock();
  console.log(`[vendor] ${packages.length} crates to fetch`);
  fs.mkdirSync(path.join(ROOT, ".tmp"), { recursive: true });

  let index = 0;
  let failed = 0;
  async function worker() {
    while (index < packages.length) {
      const pkg = packages[index++];
      try {
        await fetchCrate(pkg);
      } catch (err) {
        failed++;
        console.error(`FAIL ${pkg.name}-${pkg.version}: ${err.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`[vendor] done, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
