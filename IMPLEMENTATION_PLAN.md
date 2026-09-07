# LEMON AI - Master Feature Implementation Plan
## Complete Product Roadmap: Sir's Requirements & Autonomous Multi-Agent SaaS Architecture

> **Document Version:** 2.0 (New Feature Roadmap)  
> **Target Scope:** 10 Core Modules from `LEMON AI.txt` & Sir's Directives  
> **Benchmark Competitor:** GoHighLevel (AI-Native Social, Marketing, Calling & CRM Alternative)  

---

## Executive Summary & Autonomous Flywheel Architecture

Lemon AI is designed as a fully autonomous marketing and sales engine. Instead of disconnected tools, Lemon AI connects the entire customer acquisition lifecycle into a self-reinforcing, multi-agent flywheel:

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                    LEMON AI MULTI-AGENT FLYWHEEL                       │
  │                                                                        │
  │  [1. Research Agent]    →  Scrapes competitors, trends & viral hooks   │
  │         ↓                                                              │
  │  [2. Strategy Agent]    →  Builds 30-day cross-platform content plans  │
  │         ↓                                                              │
  │  [3. Content Studio]    →  Generates Reels, Carousels, Posts & Ads     │
  │         ↓                                                              │
  │  [4. Distribution]      →  Auto-schedules & publishes across 6 socials │
  │         ↓                                                              │
  │  [5. Ads Intelligence]  →  Turns top organic posts into Meta Ad campaigns│
  │         ↓                                                              │
  │  [6. Sales / DM Agent]  →  Captures replies, qualifies leads via chat  │
  │         ↓                                                              │
  │  [7. Calling Agent]     →  Outbound AI voice calls to qualified leads  │
  │         ↓                                                              │
  │  [8. CRM & Pipeline]    →  Tracks deals, book appointments on calendar │
  │         ↓                                                              │
  │  [9. Analytics Agent]   →  Attributes revenue & conversion to content  │
  │         ↓                                                              │
  │ [10. Optimizer Agent]   →  Allocates budget to winners & loops back    │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## PHASE 1: SIR'S IMMEDIATE CORE REQUIREMENTS (P0)

---

### Feature 1.1: Competition Researcher & Trend Hijacking Engine

#### Sir's Specification
> *"AI engine client ki details lega, market mein jaayega, deep research karega. Top hashtags, top pick nikalega. Competition research karke jo number one pe hai, trend mein hai - wo cheez nikalega, wahi post generate karega aur schedule karega."*

#### Architecture & Component Breakdown

```
app/(routes)/(dashboard)/competition-researcher/
  ├── page.tsx                             // Main competition research page
components/competition/
  ├── research-form.tsx                    // Form: Niche, competitor handles/URLs, geography
  ├── research-results-dashboard.tsx       // Visual dashboard for research output
  ├── competitor-card.tsx                  // Competitor breakdown (strengths, weaknesses, angles)
  ├── trending-hooks-panel.tsx             // Top 5 trending hooks (Pain point / Story / Contrarian)
  ├── recommended-hashtags.tsx             // Categorized hashtags with 1-click copy/apply
  └── schedule-from-research-dialog.tsx    // 1-Click "Generate & Schedule Posts" modal
app/api/ai/competitor-analyze/
  └── route.ts                             // Deep competitor analysis endpoint
lib/competitor-researcher.ts               // Core scraping + Gemini reasoning logic
```

#### Workflow & User Experience
1. **User Input (`research-form.tsx`)**:
   - Business Niche & Industry.
   - Target Audience & Location (India, US, UK, Global).
   - Competitor Social Handles or Website URLs (Instagram handle, LinkedIn page, Website).
   - Content Goal (Brand Awareness, Lead Generation, Direct Sales).
2. **Deep Research Engine (`lib/competitor-researcher.ts`)**:
   - Queries market trends using Google Gemini with Search Grounding.
   - Extracts viral hooks, pain points, competitor weaknesses to exploit, and high-engagement content angles.
   - Curates tiered hashtags: Mega (1M+), Macro (100k-1M), Niche (<100k).
3. **Research Results Dashboard (`research-results-dashboard.tsx`)**:
   - **Trending Hooks Panel**: Formatted with hook formulas (e.g., *"Why 90% of [Target Audience] fail at [Problem]"*).
   - **Competitor Flaws & Opportunity Gaps**: Direct opportunities where competitor content is lacking.
   - **Content Angle Recommendations**: Reels ideas, Carousel slides, and Meta Ad hooks.
4. **Direct Schedule Action (`schedule-from-research-dialog.tsx`)**:
   - User clicks **"Generate & Schedule from Research"**.
   - Configures: Number of days (e.g., 7 days), Posts per day (1-3), Destination channels (Instagram, Facebook, LinkedIn, X), Status (`queue` or `draft`).
   - Automatically invokes `/api/ai/auto-pilot` to batch-create posts and schedule them in the calendar.

#### New API Endpoint: `/api/ai/competitor-analyze`
- **Method:** `POST`
- **Input:**
  ```json
  {
    "niche": "High-ticket fitness coaching",
    "competitorUrls": ["instagram.com/competitor1", "competitor2.com"],
    "targetAudience": "Busy tech professionals 25-45",
    "country": "IN"
  }
  ```
- **Output:**
  ```json
  {
    "marketTrends": ["Short-form habit stacking", "Cortisol-conscious workouts"],
    "competitors": [
      {
        "name": "Competitor 1",
        "strengths": ["High energy video reels", "Strong social proof"],
        "weaknesses": ["Generic diet advice", "No community engagement in comments"],
        "winningHooks": ["Stop doing 60 min cardio", "The 15-minute desk mobility trick"]
      }
    ],
    "topHashtags": {
      "trending": ["#FitnessOver30", "#BusyExecutiveFitness"],
      "niche": ["#DeskWorkerHealth", "#TimeEfficientWorkouts"]
    },
    "recommendedAngles": [
      {
        "type": "REEL",
        "hook": "If you sit for 8 hours a day, do NOT do high-intensity cardio first.",
        "callToAction": "Comment MOBILITY for our 5-minute desk protocol"
      }
    ]
  }
  ```

---

### Feature 1.2: Meta Ads AI Intelligence & Live Ads Library Engine

#### Sir's Specification
> *"AI khud jaayega Instagram, Facebook pe, top trending Meta Ads ke hashtags wagera jo trend pe chal rahe hain - wo cheez nikale aur implement kare campaign mein."*

#### Architecture & Component Breakdown

```
lib/meta-ads-library.ts                    // Meta Ads Archive API client
app/api/meta/trending-ads/
  └── route.ts                             // Endpoint to fetch active competitor ads from Meta
components/meta-ads/
  ├── trending-ads-drawer.tsx              // Drawer/modal showing real running competitor ads
  ├── ad-intelligence-card.tsx             // Real ad breakdown: copy, headline, CTA, spend tier
  └── campaign-creation-wizard.tsx         // Enhanced 4-step wizard with real data injection
```

#### Workflow & User Experience
1. **Search Meta Ads Library (`lib/meta-ads-library.ts`)**:
   - Queries Meta Graph API `ads_archive` endpoint for active ads matching the user's niche and target country.
   - Extracts active ad creatives, headline hooks, primary text, and call-to-action types.
2. **Enhanced Campaign Wizard Integration (`campaign-creation-wizard.tsx`)**:
   - **Step 1: Goal & Intelligence**:
     - User enters brand name and objective.
     - User selects target countries (dropdown: India, United States, United Kingdom, Canada, UAE, Worldwide).
     - User clicks **"Inspect Competitor Meta Ads"** -> calls `/api/meta/trending-ads`.
     - Displays top 6 real active ads running right now in that niche.
   - **Step 2: AI Ad Creative & Copy (Data-Driven)**:
     - User clicks **"Model Winning Ad"** on any competitor ad.
     - Gemini analyzes why the competitor ad is winning and writes unique, non-plagiarized high-converting copy, headlines, and description tailored to the user's brand.
   - **Step 3: Budget, Schedule & Geo-Targeting**:
     - Dynamic budget configuration with target country passed directly to the AdSet API.
   - **Step 4: Launch & Cross-Pollinate Organic Social**:
     - Deploys campaign to Meta Ads Manager.
     - Option: **"Auto-schedule complementary organic posts to social calendar"** (turns winning ad copy into an organic Instagram/Facebook post).

---

## PHASE 2: AI CONTENT STUDIO (10 MODULES EXPANSION)

### Feature 2.1: Reels & Short-Form Video Script Studio
- **Route:** `/studio/reels`
- **Capabilities:**
  - Generates 3-part Reel scripts: **Hook (0-3s)**, **Body/Value (4-45s)**, **CTA (46-60s)**.
  - Visual cues & B-roll suggestions per shot.
  - On-screen text captions suggestion.
  - Voiceover audio script generation with tone settings (Energetic, Authoritative, Casual).

### Feature 2.2: Multi-Slide Carousel Creator
- **Route:** `/studio/carousels`
- **Capabilities:**
  - Generates 5-10 slide carousels for Instagram and LinkedIn.
  - Generates slide titles, bullet points, swipe prompts, and visual asset suggestions.
  - Direct export as PDF for LinkedIn document posts or multi-image carousel for Instagram.

### Feature 2.3: SEO Blog & Long-Form Article Generator
- **Route:** `/studio/blogs`
- **Capabilities:**
  - AI long-form blog writer based on the brand's verified knowledge base.
  - Includes meta tags, H1/H2/H3 hierarchy, FAQs with schema markup, and keyword density.
  - Auto-converts published blogs into 3 social post snippets.

---

## PHASE 3: SOCIAL AUTOMATION (COMMENTS & DM CONVERSATION BOT)

### Feature 3.1: Intelligent Auto-Reply to Post Comments
- **Database Table:** `social_comments`
- **Capabilities:**
  - Inngest background polling job checks published posts for new comments every 15 minutes.
  - AI analyzes comment sentiment (Inquiry, Praise, Complaint, Spam).
  - Generates brand-voice replies. For purchase intent (e.g., *"Price?"*, *"How to buy?"*), replies publicly with a friendly response and initiates a private DM.

### Feature 3.2: Social DM Lead Automation (Instagram & Facebook)
- **Database Table:** `crm_conversations` & `crm_messages`
- **Capabilities:**
  - Automated trigger when a user comments a keyword (e.g., *"Send link"*, *"LEAD"*).
  - Initiates direct message with link or question.
  - Handles continuous two-way conversation to collect email, phone number, and intent.

---

## PHASE 4: AI SALES BOTS & LEAD QUALIFICATION (OMNICHANNEL)

### Feature 4.1: Embeddable Website Chatbot
- **Route / Component:** Embeddable script tag / React component.
- **Capabilities:**
  - Grounded strictly in the user's **AI Memory & Brand Profile** (`brand_memory` table).
  - Answers product, pricing, service, and company queries 24/7.
  - Collects visitor name, email, and phone number when purchase intent is detected.

### Feature 4.2: WhatsApp Business Bot
- **Integration:** WhatsApp Cloud API (Meta for Developers).
- **Capabilities:**
  - Inbound WhatsApp concierge for client inquiries.
  - Sends automated media brochures, pricing sheets, and booking links.

### Feature 4.3: Automated Lead Scoring & Appointment Booking
- **Lead Scoring Engine:** Evaluates conversation transcript on a 1-10 intent scale based on budget, authority, need, and timeline (BANT).
- **Calendar Integration:** Seamless booking integration with Cal.com / Google Calendar / Calendly.

---

## PHASE 5: UNIFIED CRM & DEALS PIPELINE

### Feature 5.1: Leads Kanban Pipeline
- **Route:** `/crm/pipeline`
- **Stages:** `New Lead` -> `Contacted` -> `Qualified` -> `Appointment Booked` -> `Proposal Sent` -> `Closed Won / Lost`.
- Drag-and-drop Kanban interface with real-time value tallying.

### Feature 5.2: Unified Omnichannel Inbox
- **Route:** `/crm/inbox`
- **Capabilities:**
  - Single consolidated inbox for Instagram DMs, Facebook Messenger, WhatsApp messages, and Website live chats.
  - Ability for human agent to take over the chat from AI at any time.

---

## PHASE 6: AI VOICE CALLING AGENT

### Feature 6.1: Outbound AI Lead Qualification Calls
- **Integration:** Vapi.ai / Bland.ai Voice API + Twilio.
- **Trigger:** When a new high-intent lead enters the CRM (score >= 7).
- **Capabilities:**
  - AI Voice agent calls the lead within 2 minutes of form submission.
  - Speaks naturally with ultra-low latency (<600ms), asks qualification questions, and offers to book an appointment directly on the spot.

### Feature 6.2: Inbound AI Receptionist
- Handles inbound business telephone inquiries.
- Directs emergency inquiries, answers FAQs, and logs caller details into the CRM.

---

## PHASE 7: REAL GROWTH ANALYTICS & AUTONOMOUS OPTIMIZATION

### Feature 7.1: Live Platform Insights Dashboard
- **Route:** `/analytics`
- Pulls authentic metrics via Instagram Graph API & LinkedIn Insights: Reach, Impressions, Engagement Rate, Saves, Shares.
- Meta Ads Insights API: Real CTR, CPC, ROAS, Spend, and Conversions.

### Feature 7.2: Autonomous Strategy Optimization Agent
- Analyzes which content angles generated the most leads and revenue.
- Delivers automated weekly executive recommendations:
  - *"Reels about [Topic X] generated 4x more qualified leads than Carousels. Shifting 60% of next week's schedule to [Topic X] format."*
  - *"Meta Ad Set 'Entrepreneurs 25-40' has a 4.2x ROAS. Suggesting 20% budget increase."*

---

## DATABASE SCHEMA EXPANSIONS (SUPABASE SQL)

To support the above roadmap modules, the following schemas will be applied:

```sql
-- 1. COMPETITOR RESEARCH & TRENDS
CREATE TABLE IF NOT EXISTS competitor_researches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  niche TEXT NOT NULL,
  target_audience TEXT,
  country TEXT DEFAULT 'IN',
  competitor_urls TEXT[] DEFAULT '{}',
  research_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE competitor_researches ENABLE ROW LEVEL SECURITY;
CREATE POLICY competitor_researches_user_policy ON competitor_researches
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

-- 2. CRM LEADS & PIPELINE
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  source TEXT DEFAULT 'organic', -- organic, meta_ads, website, whatsapp
  stage TEXT DEFAULT 'new',       -- new, contacted, qualified, booked, closed_won, closed_lost
  score INTEGER DEFAULT 0,
  deal_value NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY leads_user_policy ON leads
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

-- 3. UNIFIED CONVERSATIONS & MESSAGES
CREATE TABLE IF NOT EXISTS crm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- instagram, facebook, whatsapp, website
  status TEXT DEFAULT 'open',
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE crm_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_conversations_user_policy ON crm_conversations
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());

CREATE TABLE IF NOT EXISTS crm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES crm_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('lead', 'ai_assistant', 'human_agent')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE crm_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_messages_user_policy ON crm_messages
  FOR ALL USING (conversation_id IN (SELECT id FROM crm_conversations WHERE user_id = requesting_user_id()));

-- 4. SOCIAL COMMENTS AUTO-REPLY LOGS
CREATE TABLE IF NOT EXISTS social_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  post_id UUID REFERENCES scheduled_posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_comment_id TEXT,
  commenter_handle TEXT,
  comment_text TEXT NOT NULL,
  reply_text TEXT,
  status TEXT DEFAULT 'replied',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE social_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY social_comments_user_policy ON social_comments
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK (user_id = requesting_user_id());
```

---

## IMPLEMENTATION TIMELINE & PHASING

| Phase | Milestone | Focus Areas | Timeline |
|---|---|---|---|
| **Phase 1 (P0)** | **Sir's Immediate 2 Features** | Competition Researcher UI + Meta Ads Library Real Scraping + Auto-Schedule flow | **Week 1** |
| **Phase 2 (P1)** | **AI Content Studio** | Reels Script Generator + Carousels Multi-Slide Studio + SEO Blogs | **Weeks 2-3** |
| **Phase 3 (P1)** | **Social Automation** | Comment Monitoring & AI Smart Reply + Instagram DM Automation | **Weeks 4-5** |
| **Phase 4 (P2)** | **AI Sales System** | Website Embed Bot + WhatsApp Bot + Lead Scoring + Cal.com Booking | **Weeks 6-8** |
| **Phase 5 (P2)** | **CRM & Unified Inbox** | Leads Kanban Board + Unified Inbox (DMs + WhatsApp + Web) | **Weeks 9-11** |
| **Phase 6 (P3)** | **AI Calling Agent** | Outbound AI Voice Qualification (Vapi.ai/Bland.ai) + Inbound Receptionist | **Weeks 12-14** |
| **Phase 7 (P3)** | **Analytics & Optimizer** | Meta Ads & Organic Social Insights + Autonomous Weekly Strategy Optimizer | **Weeks 15-16** |

---

*Authored for Lemon AI Engineering Team | Updated September 2026*