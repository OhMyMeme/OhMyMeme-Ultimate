// Local sparse registry mirror: serves crates.io sparse index over plain HTTP,
// forwarding each request to the real HTTPS index via Node TLS (OpenSSL/BoringSSL).
// Usage: node scripts/sparse-mirror.js [port]
const http = require("http");
const https = require("https");

const PORT = Number(process.argv[2] || 7898);
const UPSTREAM = "https://index.crates.io";

const server = http.createServer((req, res) => {
  const path = req.url.split("?")[0]; // e.g. /index/co/nf/config.json
  const upstreamPath = path.startsWith("/index/") ? path.slice("/index".length) : path;

  const upstreamReq = https.get(UPSTREAM + upstreamPath, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode, {
      "content-type": upstreamRes.headers["content-type"] || "application/json",
      "content-length": upstreamRes.headers["content-length"],
    });
    upstreamRes.pipe(res);
  });
  upstreamReq.on("error", (err) => {
    console.error(`[mirror] ${upstreamPath} -> ${err.message}`);
    res.writeHead(502, { "content-type": "text/plain" });
    res.end("upstream error");
  });
});

server.listen(PORT, () => {
  console.log(`[mirror] sparse index on http://127.0.0.1:${PORT}/index/`);
});
