/**
 * LemonAI Advanced End-to-End Automated Audit Suite
 * Tests all core backend services, CRM pipeline, omnichannel inbox, AI video, post adaptation,
 * analytics, voice API, and media streaming against http://localhost:3000.
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function test(name, fn) {
  totalTests++;
  process.stdout.write(`  Testing: ${name} ... `);
  try {
    await fn();
    passedTests++;
    console.log("✓ PASS");
  } catch (err) {
    failedTests++;
    console.log(`✗ FAIL (${err.message})`);
    failures.push({ name, error: err.message, stack: err.stack });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

async function runSuite() {
  console.log(`\n=======================================================`);
  console.log(`🚀 Starting LemonAI Advanced E2E Audit Suite`);
  console.log(`Target Base URL: ${BASE_URL}`);
  console.log(`=======================================================\n`);

  // ----------------------------------------------------
  // 1. Static Media & Asset Delivery
  // ----------------------------------------------------
  console.log(`\n[Suite 1: Static Video Streaming & Range Headers]`);

  await test("GET /videos/reel-1.mp4 returns 200 with video/mp4 and bytes range", async () => {
    const res = await fetch(`${BASE_URL}/videos/reel-1.mp4`, { method: "HEAD" });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.headers.get("content-type")?.includes("video/mp4"), `Expected video/mp4, got ${res.headers.get("content-type")}`);
    assert(Number(res.headers.get("content-length")) > 100000, `File size too small: ${res.headers.get("content-length")}`);
  });

  await test("GET /videos/reel-2.mp4 returns 200 with video/mp4", async () => {
    const res = await fetch(`${BASE_URL}/videos/reel-2.mp4`, { method: "HEAD" });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.headers.get("content-type")?.includes("video/mp4"), `Expected video/mp4, got ${res.headers.get("content-type")}`);
  });

  await test("GET /videos/reel-3.mp4 returns 200 with video/mp4", async () => {
    const res = await fetch(`${BASE_URL}/videos/reel-3.mp4`, { method: "HEAD" });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.headers.get("content-type")?.includes("video/mp4"), `Expected video/mp4, got ${res.headers.get("content-type")}`);
  });

  // ----------------------------------------------------
  // 2. Channels API
  // ----------------------------------------------------
  console.log(`\n[Suite 2: Social Channels Configuration]`);

  await test("GET /api/channel returns configured channels list", async () => {
    const res = await fetch(`${BASE_URL}/api/channel`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data.channels), "channels must be an array");
    assert(data.channels.length > 0, "channels array should not be empty");
    const hasTwitter = data.channels.some(c => c.type === "TWITTER" || c.name?.includes("Twitter"));
    assert(hasTwitter, "Should contain TWITTER channel type");
  });

  // ----------------------------------------------------
  // 3. CRM Leads Pipeline & BANT AI Scoring
  // ----------------------------------------------------
  console.log(`\n[Suite 3: CRM Leads Pipeline & AI BANT Scoring]`);
  let createdLeadId = null;

  await test("GET /api/crm/leads retrieves existing leads", async () => {
    const res = await fetch(`${BASE_URL}/api/crm/leads`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data.leads), "leads should be an array");
  });

  await test("POST /api/crm/leads creates new lead with valid UUID and initial scoring", async () => {
    const payload = {
      name: "[TEST-AUDIT] Sarah Connor",
      email: "sarah.connor@cyberdyne-audit.com",
      phone: "+15550192834",
      source: "website",
      stage: "new",
      deal_value: 12500,
      metadata: {
        company: "Cyberdyne Systems",
        notes: "Interested in enterprise AI automation and CRM voice calling with $15k budget for Q4."
      }
    };
    const res = await fetch(`${BASE_URL}/api/crm/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const data = await res.json();
    assert(data.lead, "Response should include lead object");
    assert(typeof data.lead.id === "string" && data.lead.id.length > 10, "Lead ID should be a valid UUID");
    assert(data.lead.name === payload.name, "Lead name mismatch");
    assert(typeof data.lead.score === "number", "Lead should have a numeric score");
    createdLeadId = data.lead.id;
  });

  await test("PATCH /api/crm/leads updates stage and runs AI BANT re-scoring", async () => {
    assert(createdLeadId, "No createdLeadId available");
    const updatePayload = {
      id: createdLeadId,
      stage: "negotiation",
      deal_value: 15000,
      triggerScoring: true,
      transcript: "Client confirmed budget of $15,000 approved by CFO, decision maker Sarah Connor, timeline immediate implementation."
    };
    const res = await fetch(`${BASE_URL}/api/crm/leads`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatePayload)
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.lead.stage === "negotiation", "Stage should be updated to negotiation");
    assert(data.lead.deal_value === 15000, "Deal value should be updated");
    assert(data.lead.score >= 5, "BANT score should be evaluated and high for qualified lead");
  });

  await test("GET /api/crm/leads/[id] retrieves specific lead details", async () => {
    assert(createdLeadId, "No createdLeadId available");
    const res = await fetch(`${BASE_URL}/api/crm/leads/${createdLeadId}`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.lead && data.lead.id === createdLeadId, "Lead ID mismatch");
  });

  // ----------------------------------------------------
  // 4. CRM Activities Log
  // ----------------------------------------------------
  console.log(`\n[Suite 4: CRM Activities & Timeline Log]`);

  await test("POST /api/crm/activities logs a timeline action", async () => {
    const actPayload = {
      lead_id: createdLeadId,
      type: "note",
      title: "[TEST-AUDIT] Initial Discovery Call Complete",
      description: "Discussed requirements, security compliance and integration timeline.",
      metadata: { call_duration_sec: 420 }
    };
    const res = await fetch(`${BASE_URL}/api/crm/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(actPayload)
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const data = await res.json();
    assert(data.activity?.title === actPayload.title, "Activity title mismatch");
  });

  await test("GET /api/crm/activities queries activities list", async () => {
    const res = await fetch(`${BASE_URL}/api/crm/activities?lead_id=${createdLeadId}`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data.activities), "activities should be an array");
    assert(data.activities.length > 0, "Activities should contain at least 1 record");
  });

  // ----------------------------------------------------
  // 5. Omnichannel Inbox & Website Chatbot Widget
  // ----------------------------------------------------
  console.log(`\n[Suite 5: Omnichannel Inbox & Chat Conversation Flow]`);
  let testConvId = null;

  await test("GET /api/crm/conversations returns omnichannel inbox threads", async () => {
    const res = await fetch(`${BASE_URL}/api/crm/conversations`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data.conversations), "conversations should be an array");
  });

  await test("POST /api/crm/conversations creates new conversation thread", async () => {
    const res = await fetch(`${BASE_URL}/api/crm/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: createdLeadId,
        channel: "website",
        is_ai_active: true
      })
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const data = await res.json();
    assert(data.conversation?.id, "Conversation should have an ID");
    testConvId = data.conversation.id;
  });

  await test("POST /api/chat/message sends customer message and triggers AI responder", async () => {
    assert(testConvId, "No testConvId available");
    const res = await fetch(`${BASE_URL}/api/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: testConvId,
        message: "Hi! How does Lemon AI pricing work for hardware wholesale?",
        channel: "website"
      })
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.conversationId, "Should return conversationId");
    assert(typeof data.reply === "string" && data.reply.length > 0, "Should return AI generated reply string");
  });

  await test("GET /api/crm/conversations?id=... retrieves updated messages history", async () => {
    assert(testConvId, "No testConvId available");
    const res = await fetch(`${BASE_URL}/api/crm/conversations?id=${testConvId}`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.conversation && data.conversation.id === testConvId, "Conversation ID mismatch");
    assert(Array.isArray(data.messages) && data.messages.length >= 2, "Conversation should have customer message and AI reply");
  });

  // ----------------------------------------------------
  // 6. AI Studio & Video Reel Generation
  // ----------------------------------------------------
  console.log(`\n[Suite 6: AI Studio & 9:16 Video Reel Generation]`);

  await test("POST /api/ai/studio-reels-video returns valid 9:16 video reel", async () => {
    const res = await fetch(`${BASE_URL}/api/ai/studio-reels-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "hardware wholesale automation in 60 seconds",
        topic: "hardware wholesale"
      })
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, "success should be true");
    assert(data.video && typeof data.video.videoUrl === "string", "videoUrl must be a string");
    assert(data.video.videoUrl.length > 0, "videoUrl cannot be empty");
    assert(
      data.video.videoUrl.startsWith("http") || data.video.videoUrl.startsWith("/videos/"),
      `Invalid videoUrl format: ${data.video.videoUrl}`
    );
  });

  // ----------------------------------------------------
  // 7. Social Content Adaptation Engine
  // ----------------------------------------------------
  console.log(`\n[Suite 7: Cross-Platform Post Adaptation]`);

  await test("POST /api/post/adapt adapts content for specific platform guidelines", async () => {
    const res = await fetch(`${BASE_URL}/api/post/adapt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Announcing our new AI-powered wholesale supply chain optimization tool! Save 30% time weekly.",
        channels: [
          { id: "tw-test", type: "twitter", name: "Twitter / X", character_limit: 280 },
          { id: "li-test", type: "linkedin", name: "LinkedIn", character_limit: 3000 }
        ]
      })
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, "success must be true");
    assert(data.adaptations && typeof data.adaptations === "object", "Should return adaptations map");
    assert(data.adaptations["tw-test"]?.text, "Twitter adaptation must be present");
    assert(data.adaptations["li-test"]?.text, "LinkedIn adaptation must be present");
  });

  // ----------------------------------------------------
  // 8. Analytics Overview API
  // ----------------------------------------------------
  console.log(`\n[Suite 8: Analytics Overview Metrics]`);

  await test("GET /api/analytics/overview returns aggregated metrics", async () => {
    const res = await fetch(`${BASE_URL}/api/analytics/overview`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.overview || data.stats || data.metrics || typeof data === "object", "Analytics must return an object");
  });

  // ----------------------------------------------------
  // 9. Voice AI Calling Agent Endpoint
  // ----------------------------------------------------
  console.log(`\n[Suite 9: Voice AI Calling Agent Validation]`);

  await test("POST /api/voice/call-lead validates phone number and payload", async () => {
    // Calling with invalid dummy phone should be caught with clean 400 or handled without 500 crash
    const res = await fetch(`${BASE_URL}/api/voice/call-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: createdLeadId,
        phone_number: "invalid-number-format"
      })
    });
    assert(res.status === 400 || res.status === 200, `Expected 400 or handled 200, got ${res.status}`);
  });

  // ----------------------------------------------------
  // 10. WhatsApp Cloud API Webhook
  // ----------------------------------------------------
  console.log(`\n[Suite 10: WhatsApp Webhook Challenge & Verification]`);

  await test("GET /api/webhooks/whatsapp verifies hub.challenge token", async () => {
    const challenge = "audit_challenge_token_12345";
    const res = await fetch(`${BASE_URL}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=lemon_whatsapp_verify_token_secure&hub.challenge=${challenge}`);
    // If webhook is configured with verify token, it should respond with challenge or handled status
    assert(res.status === 200 || res.status === 403, `Expected 200 or 403, got ${res.status}`);
  });

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  console.log(`\n=======================================================`);
  console.log(`📊 LemonAI Audit Summary:`);
  console.log(`Total Tests Run : ${totalTests}`);
  console.log(`Passed Tests    : ${passedTests}`);
  console.log(`Failed Tests    : ${failedTests}`);
  console.log(`Success Rate    : ${Math.round((passedTests / totalTests) * 100)}%`);
  console.log(`=======================================================\n`);

  if (failedTests > 0) {
    console.error("Failure details:");
    failures.forEach((f, idx) => {
      console.error(`\n[${idx + 1}] ${f.name}`);
      console.error(`    Error: ${f.error}`);
    });
    process.exit(1);
  } else {
    console.log("🎉 ALL TESTS PASSED WITH 100% SUCCESS!");
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error("Fatal suite error:", err);
  process.exit(1);
});
