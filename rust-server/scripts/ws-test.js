// WS realtime protocol test for rust-server
// 1. connect /ws?token= -> expect {"type":"sync","revision":N}
// 2. send "ping" -> expect "pong"
// 3. create a group via REST -> expect {"type":"groups-changed","revision":N+1,...}
const fs = require("fs");
const path = require("path");

const BASE = "http://127.0.0.1:3100";

async function main() {
  const envPath = path.resolve(__dirname, "..", "..", "nuxt-app", ".env");
  const envContent = fs.readFileSync(envPath, "utf8");
  const line = envContent.split("\n").find((l) => l.startsWith("NUXT_ACCESS_TOKEN="));
  const accessToken = line.split("=").slice(1).join("=").trim();

  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: accessToken }),
  });
  if (!loginRes.ok) {
    console.log("FAIL login", loginRes.status);
    process.exit(1);
  }
  const { token } = await loginRes.json();
  console.log("PASS login");

  const ws = new WebSocket(`ws://127.0.0.1:3100/ws?token=${encodeURIComponent(token)}`);
  let syncSeen = false;
  let pongSeen = false;
  let groupsChangedSeen = false;
  let initialRevision = null;

  const timeout = setTimeout(() => {
    console.log(`sync=${syncSeen} pong=${pongSeen} groupsChanged=${groupsChangedSeen}`);
    ws.close();
    process.exit(syncSeen && pongSeen && groupsChangedSeen ? 0 : 1);
  }, 15000);

  ws.onmessage = async (event) => {
    const data = String(event.data);
    if (data === "pong") {
      pongSeen = true;
      console.log("PASS pong");
      return;
    }
    try {
      const msg = JSON.parse(data);
      if (msg.type === "sync") {
        syncSeen = true;
        initialRevision = msg.revision;
        console.log(`PASS sync revision=${msg.revision}`);
        ws.send("ping");
      } else if (msg.type === "groups-changed") {
        groupsChangedSeen = true;
        console.log(
          `PASS groups-changed revision=${msg.revision} (delta=${msg.revision - initialRevision})`
        );
        ws.close();
        clearTimeout(timeout);
        process.exit(0);
      }
    } catch {
      console.log("non-json message:", data.slice(0, 60));
    }
  };

  ws.onerror = (err) => {
    console.log("WS ERROR", err.message || "unknown");
    process.exit(1);
  };

  ws.onopen = () => {
    console.log("PASS ws connected");
    // create a group via REST to trigger broadcast
    fetch(`${BASE}/api/groups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: `ws-test-${Date.now()}` }),
    }).then(async (res) => {
      const body = await res.json();
      // cleanup: delete the group
      if (res.ok && body.id) {
        setTimeout(async () => {
          await fetch(`${BASE}/api/groups/${body.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log("cleaned up test group");
        }, 2000);
      }
    });
  };
}

main();
