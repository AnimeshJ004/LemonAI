// LemonAI — Meta <-> CRM Integration Test Suite
// Simulates real Meta webhook payloads without a real Meta account
// Usage: node scripts/test-meta-crm.mjs

const BASE_URL = (() => {
  const idx = process.argv.indexOf("--base-url");
  return idx !== -1 ? process.argv[idx + 1] : "http://localhost:3000";
})();

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "lemon_ai_webhook";
const FAKE_IG = "17841400000000001";

let total = 0, passed = 0, failed = 0;
const failures = [];

async function test(name, fn) {
  total++;
  process.stdout.write("  Testing: " + name + " ... ");
  try {
    await fn();
    passed++;
    console.log("PASS");
  } catch (err) {
    failed++;
    console.log("FAIL (" + err.message + ")");
    failures.push({ name, error: err.message });
  }
}

function assert(c, m) {
  if (!c) throw new Error(m || "Assertion failed");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function mkdm(aid, sid, txt) {
  return {
    object: "instagram",
    entry: [{
      id: aid,
      time: Date.now(),
      messaging: [{
        sender: { id: sid },
        recipient: { id: aid },
        timestamp: Date.now(),
        message: { mid: "mid." + Date.now(), text: txt }
      }]
    }]
  };
}

function mkcmt(aid, cid, txt, handle, mid) {
  return {
    object: "instagram",
    entry: [{
      id: aid,
      time: Date.now(),
      changes: [{
        field: "comments",
        value: {
          id: cid,
          text: txt,
          from: { id: "u" + Date.now(), username: handle || "user" },
          media: { id: mid || "m1" },
          timestamp: Math.floor(Date.now() / 1000)
        }
      }]
    }]
  };
}

async function run() {
  const SEP = "=".repeat(58);
  console.log("\n" + SEP);
  console.log("  LemonAI Meta <-> CRM Integration Tests");
  console.log("  URL: " + BASE_URL);
  console.log(SEP + "\n");

  // ─── Suite 1: Webhook Verification ───────────────────────────
  console.log("[Suite 1: Webhook Verification (hub.challenge handshake)]");

  await test("valid token returns hub.challenge", async () => {
    const ch = "ch_" + Date.now();
    const url = BASE_URL + "/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=" + VERIFY_TOKEN + "&hub.challenge=" + ch;
    const r = await fetch(url);
    assert(r.status === 200, "Expected 200, got " + r.status);
    const b = await r.text();
    assert(b.trim() === ch, "Expected " + ch + ", got " + b.trim());
  });

  await test("wrong token returns 403", async () => {
    const r = await fetch(BASE_URL + "/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=WRONG&hub.challenge=x");
    assert(r.status === 403, "Expected 403, got " + r.status);
  });

  await test("/api/social/webhook valid token returns challenge", async () => {
    const ch = "sch_" + Date.now();
    const url = BASE_URL + "/api/social/webhook?hub.mode=subscribe&hub.verify_token=" + VERIFY_TOKEN + "&hub.challenge=" + ch;
    const r = await fetch(url);
    assert(r.status === 200, "Expected 200, got " + r.status);
    const b = await r.text();
    assert(b.trim() === ch, "Expected " + ch + ", got " + b.trim());
  });

  // ─── Suite 2: Edge Cases ─────────────────────────────────────
  console.log("\n[Suite 2: Edge Cases — Empty & Malformed Payloads]");

  await test("empty entry array returns 200", async () => {
    const r = await fetch(BASE_URL + "/api/webhooks/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ object: "instagram", entry: [] })
    });
    assert(r.status === 200, "Expected 200, got " + r.status);
    const d = await r.json();
    assert(d.status === "acknowledged_empty" || d.status === "acknowledged", "Got: " + d.status);
  });

  await test("malformed JSON does not crash server (no 500)", async () => {
    const r = await fetch(BASE_URL + "/api/webhooks/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad json!!!"
    });
    assert(r.status !== 500, "Server crashed with 500");
  });

  await test("unknown account ID returns 200 graceful skip", async () => {
    const r = await fetch(BASE_URL + "/api/webhooks/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mkdm("unknown_acct_99999", "s1", "hello?"))
    });
    assert(r.status === 200, "Expected 200, got " + r.status);
    const d = await r.json();
    assert(d.status === "acknowledged", "Got: " + d.status);
  });

  // ─── Suite 3: DM Payloads ────────────────────────────────────
  console.log("\n[Suite 3: DM Payloads — Price/Buy/Quote Intent -> CRM Lead]");

  await test("price keyword DM acknowledged instantly", async () => {
    const t = Date.now();
    const r = await fetch(BASE_URL + "/api/webhooks/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mkdm(FAKE_IG, "buyer_" + Date.now(), "What is the price for your premium package?"))
    });
    assert(r.status === 200, "Expected 200, got " + r.status);
    const d = await r.json();
    assert(d.status === "acknowledged", "Got: " + d.status);
    console.log("       Response time: " + (Date.now() - t) + "ms");
  });

  await test("buy keyword DM acknowledged", async () => {
    const r = await fetch(BASE_URL + "/api/webhooks/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mkdm(FAKE_IG, "b2_" + Date.now(), "I want to buy your AI solution for my business"))
    });
    assert(r.status === 200, "Expected 200, got " + r.status);
  });

  await test("quote keyword DM acknowledged", async () => {
    const r = await fetch(BASE_URL + "/api/webhooks/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mkdm(FAKE_IG, "q_" + Date.now(), "Can you send me a quote for 10 users?"))
    });
    assert(r.status === 200, "Expected 200, got " + r.status);
  });

  await test("hire keyword DM acknowledged", async () => {
    const r = await fetch(BASE_URL + "/api/webhooks/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mkdm(FAKE_IG, "h_" + Date.now(), "I want to hire you for our project"))
    });
    assert(r.status === 200, "Expected 200, got " + r.status);
  });

  // ─── Suite 4: Comment Payloads ───────────────────────────────
  console.log("\n[Suite 4: Instagram Comment Payloads]");

  await test("comment payload acknowledged immediately", async () => {
    const r = await fetch(BASE_URL + "/api/webhooks/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mkcmt(FAKE_IG, "c_" + Date.now(), "How much does it cost?", "priya_sharma", "m_" + Date.now()))
    });
    assert(r.status === 200, "Expected 200, got " + r.status);
    const d = await r.json();
    assert(d.status === "acknowledged", "Got: " + d.status);
  });

  await test("duplicate comment_id fires twice without 500", async () => {
    const cid = "dedup_" + Date.now();
    const p = JSON.stringify(mkcmt(FAKE_IG, cid, "Duplicate test!", "dup_user", "mdup"));
    const [r1, r2] = await Promise.all([
      fetch(BASE_URL + "/api/webhooks/meta", { method: "POST", headers: { "Content-Type": "application/json" }, body: p }),
      fetch(BASE_URL + "/api/webhooks/meta", { method: "POST", headers: { "Content-Type": "application/json" }, body: p })
    ]);
    assert(r1.status === 200, "r1 Expected 200, got " + r1.status);
    assert(r2.status === 200, "r2 Expected 200, got " + r2.status);
  });

  await test("/api/social/webhook comment payload works", async () => {
    const r = await fetch(BASE_URL + "/api/social/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mkcmt(FAKE_IG, "sc_" + Date.now(), "Love this post!", "fan_42", "m99"))
    });
    assert(r.status === 200, "Expected 200, got " + r.status);
  });

  // ─── Suite 5: CRM State Verification ─────────────────────────
  console.log("\n[Suite 5: CRM State Verification (after background processing)]");
  process.stdout.write("  Waiting 3s for background after() tasks...");
  await sleep(3000);
  console.log(" done");

  await test("GET /api/crm/leads reachable and returns array", async () => {
    const r = await fetch(BASE_URL + "/api/crm/leads");
    assert(r.status === 200, "Expected 200, got " + r.status);
    const d = await r.json();
    assert(Array.isArray(d.leads), "leads must be array, got: " + typeof d.leads);
  });

  await test("GET /api/crm/activities reachable and returns array", async () => {
    const r = await fetch(BASE_URL + "/api/crm/activities");
    assert(r.status === 200, "Expected 200, got " + r.status);
    const d = await r.json();
    assert(Array.isArray(d.activities), "activities must be array");
  });

  await test("GET /api/crm/conversations reachable after webhook events", async () => {
    const r = await fetch(BASE_URL + "/api/crm/conversations");
    assert(r.status === 200, "Expected 200, got " + r.status);
    const d = await r.json();
    assert(Array.isArray(d.conversations), "conversations must be array");
  });

  // ─── Suite 6: WhatsApp Webhook ────────────────────────────────
  console.log("\n[Suite 6: WhatsApp Webhook -> CRM Pipeline]");

  await test("GET /api/webhooks/whatsapp verify returns 200 or 403", async () => {
    const r = await fetch(BASE_URL + "/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=lemon_whatsapp_verify_token_secure&hub.challenge=wa_" + Date.now());
    assert(r.status === 200 || r.status === 403, "Expected 200 or 403, got " + r.status);
  });

  await test("POST /api/webhooks/whatsapp inbound message returns 200", async () => {
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{
        id: "wa_biz_001",
        changes: [{
          value: {
            messaging_product: "whatsapp",
            contacts: [{ profile: { name: "Rahul Kumar" }, wa_id: "919876543210" }],
            messages: [{
              from: "919876543210",
              id: "wamid." + Date.now(),
              timestamp: Math.floor(Date.now() / 1000),
              type: "text",
              text: { body: "I need a quote for bulk order please" }
            }]
          },
          field: "messages"
        }]
      }]
    });
    const r = await fetch(BASE_URL + "/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    assert(r.status === 200, "Expected 200, got " + r.status);
  });

  // ─── Summary ─────────────────────────────────────────────────
  console.log("\n" + SEP);
  console.log("  Meta <-> CRM Audit Summary:");
  console.log("  Total Tests : " + total);
  console.log("  Passed      : " + passed);
  console.log("  Failed      : " + failed);
  console.log("  Success     : " + Math.round((passed / total) * 100) + "%");
  console.log(SEP + "\n");

  if (failed > 0) {
    console.error("Failure details:");
    failures.forEach((f, i) => console.error("  [" + (i + 1) + "] " + f.name + " => " + f.error));
    process.exit(1);
  } else {
    console.log("ALL META <-> CRM TESTS PASSED!");
    process.exit(0);
  }
}

run().catch((e) => { console.error("Fatal:", e); process.exit(1); });
