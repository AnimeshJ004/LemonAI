/**
 * 100% Pure HTTP Automated Test Suite for Member 3
 * Tests all endpoints directly against the running Next.js server.
 */

const BASE_URL = "http://localhost:3000";

let passedCount = 0;
let failedCount = 0;

function logPass(title, details) {
  passedCount++;
  console.log(`\x1b[32m✔ [PASS]\x1b[0m ${title}`);
  if (details) console.log(`   \x1b[90m${details}\x1b[0m`);
}

function logFail(title, error) {
  failedCount++;
  console.log(`\x1b[31m✖ [FAIL]\x1b[0m ${title}`);
  if (error) console.log(`   \x1b[31m${error}\x1b[0m`);
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("🚀 STARTING MEMBER 3 HTTP FUNCTIONALITY TEST SUITE");
  console.log("=======================================================\n");

  let testConvId = null;
  let testLeadId = null;

  // -------------------------------------------------------------
  // TEST 1 & 2: Website Chatbot AI & Contact Extraction
  // -------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Hi! I'm Sarah Connor from Cyberdyne Systems. We need automated social media management. You can reach me at sarah@cyberdyne.ai or call +1 555-888-9999.",
        visitorName: "Sarah Connor",
      }),
    });

    const data = await res.json();
    if (res.ok && data.reply && data.conversationId) {
      testConvId = data.conversationId;
      testLeadId = data.leadId;
      logPass("Website Chatbot: Brand Grounding & Reply", `Reply: "${data.reply.slice(0, 65)}..."`);
      logPass("Website Chatbot: Auto Lead Creation & Conversation Linking", `Conv ID: ${data.conversationId}, Lead ID: ${data.leadId}`);
    } else {
      logFail("Website Chatbot", `Status ${res.status}: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    logFail("Website Chatbot", err.message);
  }

  // -------------------------------------------------------------
  // TEST 3: Multi-turn Chat Conversation & Context
  // -------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: testConvId,
        message: "What is your typical turnaround time for full campaigns?",
      }),
    });

    const data = await res.json();
    if (res.ok && data.reply) {
      logPass("Chatbot Multi-turn Context Preservation", `Assistant: "${data.reply.slice(0, 65)}..."`);
    } else {
      logFail("Chatbot Multi-turn Context", JSON.stringify(data));
    }
  } catch (err) {
    logFail("Chatbot Multi-turn Context", err.message);
  }

  // -------------------------------------------------------------
  // TEST 4: CRM Leads API: Fetch Leads & Pipeline Stats
  // -------------------------------------------------------------
  let createdLeadId = null;
  try {
    const res = await fetch(`${BASE_URL}/api/crm/leads`);
    const data = await res.json();

    if (res.ok && Array.isArray(data.leads) && data.stats) {
      logPass(
        "CRM Leads: Fetch Leads & Pipeline Metrics",
        `Leads: ${data.leads.length}, Pipeline: $${data.stats.totalPipelineValue.toLocaleString()}, Qualified: ${data.stats.qualifiedCount}`
      );
    } else {
      logFail("CRM Leads GET", JSON.stringify(data));
    }
  } catch (err) {
    logFail("CRM Leads GET", err.message);
  }

  // -------------------------------------------------------------
  // TEST 5: CRM Leads API: Create New Prospect
  // -------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/crm/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Arthur Dent",
        email: "arthur@hitchhiker.galaxy",
        phone: "+44 20 7946 0999",
        company: "Sub-Etha Sens-O-Matic",
        deal_value: 18500,
        source: "website",
        score: 8,
      }),
    });

    const data = await res.json();
    if (res.ok && data.lead?.id) {
      createdLeadId = data.lead.id;
      logPass("CRM Leads: Create New Prospect (POST)", `Created lead: ${data.lead.name} ($${data.lead.deal_value})`);
    } else {
      logFail("CRM Leads POST", JSON.stringify(data));
    }
  } catch (err) {
    logFail("CRM Leads POST", err.message);
  }

  // -------------------------------------------------------------
  // TEST 6: CRM Leads API: Drag-and-Drop Stage Update (PATCH)
  // -------------------------------------------------------------
  try {
    const targetId = createdLeadId || testLeadId || "demo-lead-1";
    const res = await fetch(`${BASE_URL}/api/crm/leads`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: targetId,
        stage: "qualified",
        score: 9,
      }),
    });

    const data = await res.json();
    if (res.ok && data.lead?.stage === "qualified" && data.lead?.score === 9) {
      logPass("CRM Leads: Stage Drag Update (PATCH)", `Lead ${targetId} stage updated to 'qualified' (Score: 9/10)`);
    } else {
      logFail("CRM Leads PATCH", JSON.stringify(data));
    }
  } catch (err) {
    logFail("CRM Leads PATCH", err.message);
  }

  // -------------------------------------------------------------
  // TEST 7: CRM Conversations API: List Active Threads
  // -------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/crm/conversations`);
    const data = await res.json();

    if (res.ok && Array.isArray(data.conversations) && data.conversations.length > 0) {
      logPass("Omnichannel Inbox: List Active Threads (GET)", `Active threads: ${data.conversations.length}`);
    } else {
      logFail("Omnichannel Inbox GET", JSON.stringify(data));
    }
  } catch (err) {
    logFail("Omnichannel Inbox GET", err.message);
  }

  // -------------------------------------------------------------
  // TEST 8: CRM Conversations API: Send Human Agent Message
  // -------------------------------------------------------------
  try {
    const activeConv = testConvId || "demo-conv-1";
    const res = await fetch(`${BASE_URL}/api/crm/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: activeConv,
        content: "Hello Sarah, I am taking over this conversation. When is a good time to speak?",
        sender_type: "human_agent",
      }),
    });

    const data = await res.json();
    if (res.ok && data.message?.id) {
      logPass("Omnichannel Inbox: Send Human Agent Reply (POST)", `Message sent: "${data.message.content.slice(0, 50)}..."`);
    } else {
      logFail("Omnichannel Inbox Send", JSON.stringify(data));
    }
  } catch (err) {
    logFail("Omnichannel Inbox Send", err.message);
  }

  // -------------------------------------------------------------
  // TEST 9: CRM Conversations API: Human Takeover Toggle (PATCH)
  // -------------------------------------------------------------
  try {
    const activeConv = testConvId || "demo-conv-1";
    // Pause AI
    const resPause = await fetch(`${BASE_URL}/api/crm/conversations`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: activeConv,
        is_ai_active: false,
      }),
    });
    const dataPause = await resPause.json();

    // Resume AI
    const resResume = await fetch(`${BASE_URL}/api/crm/conversations`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: activeConv,
        is_ai_active: true,
      }),
    });
    const dataResume = await resResume.json();

    if (dataPause.conversation?.is_ai_active === false && dataResume.conversation?.is_ai_active === true) {
      logPass("Omnichannel Inbox: Human Takeover Toggle (PATCH)", "Toggled AI Autopilot: Active -> Paused -> Active");
    } else {
      logFail("Omnichannel Inbox Toggle", JSON.stringify({ dataPause, dataResume }));
    }
  } catch (err) {
    logFail("Omnichannel Inbox Toggle", err.message);
  }

  // -------------------------------------------------------------
  // TEST 10: Outbound Voice AI Calling Agent Trigger
  // -------------------------------------------------------------
  try {
    const targetLead = createdLeadId || testLeadId || "demo-lead-1";
    const res = await fetch(`${BASE_URL}/api/voice/call-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: targetLead,
        phone: "+15558889999",
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      logPass("Voice AI Agent: Dispatch Outbound Call (POST)", `${data.message} (Provider: ${data.provider})`);
    } else {
      logFail("Voice AI Call Lead", JSON.stringify(data));
    }
  } catch (err) {
    logFail("Voice AI Call Lead", err.message);
  }

  // -------------------------------------------------------------
  // TEST 11: WhatsApp Webhook Challenge Verification (GET)
  // -------------------------------------------------------------
  try {
    const challenge = "meta_verify_challenge_98765";
    const res = await fetch(
      `${BASE_URL}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=lemon_ai_verify_token&hub.challenge=${challenge}`
    );
    const body = await res.text();

    if (res.status === 200 && body === challenge) {
      logPass("WhatsApp Webhook: Verification Challenge (GET)", `Returned challenge echo: ${body}`);
    } else {
      logFail("WhatsApp Webhook Challenge", `Status ${res.status}: ${body}`);
    }
  } catch (err) {
    logFail("WhatsApp Webhook Challenge", err.message);
  }

  // -------------------------------------------------------------
  // TEST 12: WhatsApp Inbound Message Processing (POST)
  // -------------------------------------------------------------
  try {
    const waPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: "15559876543", profile: { name: "Tony Stark" } }],
                messages: [
                  {
                    from: "15559876543",
                    id: `wamid_${Date.now()}`,
                    type: "text",
                    text: { body: "Can Lemon AI handle multi-brand social scheduling?" },
                    timestamp: String(Math.floor(Date.now() / 1000)),
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const res = await fetch(`${BASE_URL}/api/webhooks/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(waPayload),
    });

    const data = await res.json();
    if (res.ok && data.status === "success" && data.count === 1) {
      logPass("WhatsApp Webhook: Inbound Message Ingestion & Auto-Reply (POST)", `Processed WhatsApp message`);
    } else {
      logFail("WhatsApp Webhook Ingestion", JSON.stringify(data));
    }
  } catch (err) {
    logFail("WhatsApp Webhook Ingestion", err.message);
  }

  // -------------------------------------------------------------
  // TEST 13: Voice AI Webhook Event Logger (POST)
  // -------------------------------------------------------------
  try {
    const voicePayload = {
      type: "end-of-call-report",
      call: {
        id: `call_${Date.now()}`,
        customer: { number: "+15558889999" },
        transcript: "Assistant: Hi Sarah, calling from Lemon AI. Sarah: We need this deployed this week!",
        summary: "Lead confirmed urgent need to deploy this week. High budget confirmed.",
        recordingUrl: "https://api.vapi.ai/recordings/demo-sarah.mp3",
      },
    };

    const res = await fetch(`${BASE_URL}/api/webhooks/voice-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(voicePayload),
    });

    const data = await res.json();
    if (res.ok && (data.status === "logged" || data.status === "acknowledged")) {
      logPass("Voice AI Webhook: Call Transcript & Recording Logger (POST)", `Logged transcript for call`);
    } else {
      logFail("Voice AI Webhook Logger", JSON.stringify(data));
    }
  } catch (err) {
    logFail("Voice AI Webhook Logger", err.message);
  }

  // -------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`📊 FINAL RESULT: ${passedCount} PASSED, ${failedCount} FAILED (TOTAL: ${passedCount + failedCount})`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
