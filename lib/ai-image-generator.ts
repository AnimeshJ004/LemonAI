import { getInsforgeAdminClient } from "@/lib/insforge-server";

export type ImageAspectRatio = "1:1" | "9:16" | "16:9" | "4:5";

/**
 * Supported brand profile categories for targeted visual prompt generation.
 */
export type ProfileCategory =
  | "software_tech"
  | "influencer_creator"
  | "philosopher_thinker"
  | "writer_author"
  | "fitness_health"
  | "ecommerce_fashion"
  | "finance_consulting"
  | "food_restaurant"
  | "real_estate"
  | "spiritual_mystical"
  | "general";

/**
 * Per-category art direction instructions injected into the AI prompt enhancer.
 * Each entry contains a visual style guide and example scene anchors.
 */
const CATEGORY_VISUAL_STYLES: Record<ProfileCategory, {
  label: string;
  systemContext: string;
  exampleScenes: string[];
  fallbackCategory: string;
}> = {
  software_tech: {
    label: "Software / SaaS / Tech",
    systemContext: `You are a creative director for a premium technology brand.
Visual style: Dark minimalist developer environments, glowing holographic UI dashboards on ultra-wide monitors, sleek mechanical keyboards, code terminal glow, server room abstract lighting, deep navy and electric cyan color palette, product screen mockups on premium MacBook Pro, tech office with floor-to-ceiling glass walls and ambient LEDs.
Mood: Intelligent, innovative, premium dark-mode aesthetic.
Camera: Hasselblad H6D-100c, 35mm f/1.4, deep shadows, selective focus on glowing screens, real physical world.`,
    exampleScenes: [
      "Sleek dark-mode developer workstation with dual monitors displaying glowing code, mechanical keyboard, soft blue ambient LED strip lighting, minimal dark desk",
      "Modern tech office with floor-to-ceiling glass walls at dusk, holographic UI projection on glass, clean architectural lines, city lights below",
      "Close-up of a MacBook Pro screen with a modern SaaS dashboard UI glowing in a dark room, single overhead directional light, premium desk accessories",
    ],
    fallbackCategory: "tech",
  },
  influencer_creator: {
    label: "Influencer / Content Creator",
    systemContext: `You are a creative director for a top-tier social media influencer.
Visual style: Professional studio ring-light portrait photography, golden hour lifestyle outdoor scenes, curated aesthetic bedroom/studio with neon accents, trendy flat-lay content setups, brand collaborations with luxury props, warm candid moments of authentic creator lifestyle.
Mood: Aspirational, authentic, vibrant, personal brand energy.
Camera: Canon EOS R5, 85mm f/1.2 portrait lens, golden bokeh, warm skin tones, lifestyle editorial feel.`,
    exampleScenes: [
      "Creator lifestyle flat-lay on a marble surface with aesthetic props, camera, ring light, coffee, styled notebook — warm morning light",
      "Golden hour portrait of a stylish young professional in a curated urban setting, candid authentic smile, warm bokeh background",
      "Premium photography studio setup with large softboxes, white backdrop, styled aesthetic props, camera gear in foreground",
    ],
    fallbackCategory: "influencer",
  },
  philosopher_thinker: {
    label: "Philosopher / Thought Leader",
    systemContext: `You are a creative director for a philosophical thought leader brand.
Visual style: Moody editorial libraries with floor-to-ceiling bookshelves, dramatic single window light casting long shadows on ancient manuscripts, candle-lit study rooms, classical sculptures in dramatic chiaroscuro lighting, philosophical minimalism with deep blacks and warm amber tones, leather-bound books, aged wood desks.
Mood: Deep, contemplative, intellectual, timeless.
Camera: Leica M11, 50mm f/1.4 Summilux, dramatic moody lighting, deep shadow contrast, film grain, warm amber editorial color grading.`,
    exampleScenes: [
      "Dramatic moody library with floor-to-ceiling ancient bookshelves, single ray of warm afternoon light through tall arched window casting long shadows across a leather reading desk",
      "Aged wooden study desk with open leather-bound manuscripts, candle flame close-up, quill pen, dramatic chiaroscuro lighting, dark philosophical atmosphere",
      "Classical marble sculpture bust in dramatic directional light against dark backdrop, intellectual minimalism, high contrast film photography",
    ],
    fallbackCategory: "philosophy",
  },
  writer_author: {
    label: "Writer / Author",
    systemContext: `You are a creative director for a literary author brand.
Visual style: Cozy literary aesthetics — open books with golden pages, vintage typewriters on worn wooden desks, independent bookstore shelves with warm pendant lighting, café table writing scenes, autumn leaves manuscript aesthetic, minimalist writing studio with natural light, ink and paper textures.
Mood: Warm, intimate, literary, creative.
Camera: Fujifilm GFX 100S, 63mm f/2.8, warm soft daylight through linen curtains, shallow depth of field on book pages, authentic editorial warmth.`,
    exampleScenes: [
      "Open vintage book with golden-hour sunlight falling across worn pages, reading glasses and old fountain pen on a rustic wooden table, cozy soft bokeh background",
      "Vintage Remington typewriter on an aged oak writing desk by a rain-streaked window, blank manuscript paper, warm lamp light, literary atmosphere",
      "Cozy independent bookstore interior with warm Edison pendant lights, overflowing wooden shelves of books, reading nook with armchair, authentic intimate atmosphere",
    ],
    fallbackCategory: "writing",
  },
  fitness_health: {
    label: "Fitness / Health Coach",
    systemContext: `You are a creative director for a premium fitness and wellness brand.
Visual style: Dynamic gym photography with dramatic directional lighting, outdoor sunrise running shots in motion blur, clean macro nutrition photography of vibrant healthy food, sweat-authentic athlete portraits, minimalist gym equipment against concrete walls, outdoor trail movement photography, wellness spa aesthetics.
Mood: Energetic, powerful, authentic, aspirational health.
Camera: Sony A1, 24-70mm f/2.8 GM, high speed 1/1600 shutter capturing motion, dramatic Rembrandt gym lighting, high contrast athletic photography.`,
    exampleScenes: [
      "Athletic person mid-motion at a premium gym, dramatic Rembrandt overhead lighting, sweat authentic, dark concrete walls, motivational atmosphere",
      "Sunrise outdoor running trail, motion blur of athlete in dynamic stride, golden warm sunrise light, misty forest path, authentic documentary photography",
      "Clean macro flatlay of vibrant nutrition meal prep with colorful vegetables, bright natural daylight, white marble surface, fresh healthy aesthetic",
    ],
    fallbackCategory: "fitness",
  },
  ecommerce_fashion: {
    label: "E-Commerce / Fashion",
    systemContext: `You are a creative director for a luxury fashion and e-commerce brand.
Visual style: High-end editorial product flatlay on marble and linen textures, luxury model lookbook photography with couture styling, premium packaging unboxing aesthetics, architectural fashion photography with dramatic shadows, minimalist product isolation on gradient backgrounds.
Mood: Aspirational, luxury, editorial, fashion-forward.
Camera: Phase One XF IQ4, 80mm f/2.8 lens, controlled studio strobes, perfect skin rendering, luxury editorial color grading, Vogue-level production quality.`,
    exampleScenes: [
      "Luxury fashion product editorial flatlay on Italian Carrara marble — premium accessories, minimal clean aesthetic, soft directional studio strobe light",
      "High-end luxury fashion lookbook: elegant model in couture attire in a minimalist architectural setting, dramatic shadow play, editorial magazine quality",
      "Premium e-commerce product photography: hero product on textured linen with warm directional window light, clean minimal composition, commercial brand quality",
    ],
    fallbackCategory: "fashion",
  },
  finance_consulting: {
    label: "Finance / Consulting",
    systemContext: `You are a creative director for a premium finance and consulting firm.
Visual style: Premium glass-and-steel boardroom photography with city skyline views, sophisticated executive portraits with dramatic Rembrandt lighting, luxury financial objects — engraved fountain pens, leather portfolios, premium watches, architectural wealth photography.
Mood: Authoritative, sophisticated, trust-building, premium.
Camera: Hasselblad H6D-100c, 80mm f/2.8, controlled professional lighting, rich neutral tones, premium corporate editorial photography.`,
    exampleScenes: [
      "Luxury glass-walled executive boardroom overlooking a glittering city skyline at dusk, long polished conference table, premium leather chairs, architectural precision",
      "Sophisticated executive portrait with dramatic Rembrandt studio lighting, dark neutral background, tailored suit, confident authentic expression, professional editorial",
      "Premium financial flatlay: engraved fountain pen on leather portfolio, luxury watch, crisp white linen, directional morning window light, wealth aesthetic",
    ],
    fallbackCategory: "finance",
  },
  food_restaurant: {
    label: "Food / Restaurant",
    systemContext: `You are a creative director for a premium culinary and restaurant brand.
Visual style: Professional macro food photography with dramatic directional light revealing textures, artistic plating on premium ceramic dishes, warm kitchen atmosphere with copper accents, steam and movement food moments, ingredient macro close-ups, candlelit restaurant ambience.
Mood: Appetizing, artisan, warm, indulgent.
Camera: Canon EOS R5, 100mm f/2.8L macro, dramatic side directional daylight, warm editorial color grading, James Beard Award visual quality.`,
    exampleScenes: [
      "Artisan gourmet dish dramatically lit from the side on a dark slate surface, steam rising from plating, fine dining restaurant atmosphere, macro food photography",
      "Warm cozy restaurant interior at golden hour — candlelit tables, exposed brick, copper pendant lights, authentic intimate dining atmosphere",
      "Macro close-up of fresh culinary ingredients on a rustic wooden chopping board — vibrant colors, morning window light, farm-to-table aesthetic",
    ],
    fallbackCategory: "food",
  },
  real_estate: {
    label: "Real Estate / Architecture",
    systemContext: `You are a creative director for a luxury real estate brand.
Visual style: Architectural photography of luxury minimalist interiors with floor-to-ceiling windows and warm afternoon light, exterior aerial photography of premium properties, luxury material close-ups (marble, oak, glass), twilight property photography with interior glow, aspirational lifestyle pool terrace shots.
Mood: Aspirational, sophisticated, architectural precision, luxury living.
Camera: Phase One XF IQ4 100MP, 28mm tilt-shift, real estate architectural lens correction, golden hour exterior, luxury interior warm lighting.`,
    exampleScenes: [
      "Luxury minimalist penthouse living room with floor-to-ceiling glass walls, warm afternoon light flooding the space, premium marble floors, curated art, architectural precision",
      "Twilight architectural exterior of a modern luxury villa with warm interior glow through glass walls, dramatic sky, pristine landscaping, aspirational real estate",
      "Close-up of premium architectural materials: Italian Carrara marble countertop, warm solid oak cabinetry, brushed brass fixtures, luxury interior detail photography",
    ],
    fallbackCategory: "realestate",
  },
  spiritual_mystical: {
    label: "Spiritual / Mystical",
    systemContext: `You are a creative director for a premium spiritual, esoteric, and holistic healing brand.
Visual style: Mystical dark aesthetics, elegant gold accents, glowing auras, professional tarot card spreads on rich dark velvet, ancient wisdom symbols, subtle smoky incense, balanced harmonious compositions, soft magical lighting, premium cinematic quality.
Mood: Mystical, elegant, profound, healing, aligned, premium.
Camera: Canon EOS R5, 50mm f/1.4, rich dark shadows, glowing highlights, soft depth of field, mystical elegant color grading.`,
    exampleScenes: [
      "Elegant dark mystical scene with gold glowing aura, sacred geometry subtle in background, premium spiritual atmosphere",
      "Professional tarot cards beautifully laid out on dark textured velvet, soft warm candlelight, mystical healing energy, elegant composition",
      "Vastu harmony concept with balanced dark aesthetic, glowing central energy point, polished natural stones, elegant mystical lighting",
    ],
    fallbackCategory: "spiritual",
  },
  general: {
    label: "General / Brand",
    systemContext: `You are an award-winning commercial creative director for top-tier global brands.
Visual style: Premium modern commercial photography with architectural minimalism, soft diffused natural daylight, rich editorial color grading, authentic real-world commercial settings that feel aspirational.
Mood: Professional, modern, premium.
Camera: Hasselblad H6D-100c, 50mm f/1.8 lens, natural daylight, rich editorial color grading, 8k commercial photography.`,
    exampleScenes: [
      "Minimalist concrete architectural workspace with warm afternoon window shadows and clean open wall for text overlay, editorial commercial photography",
      "Premium modern office corner with soft diffused natural light, editorial neutral tones, aspirational professional atmosphere",
    ],
    fallbackCategory: "business",
  },
};

/**
 * Detects the brand's profile category from their brand profile fields.
 * Uses keyword matching on niche, products_services, and main_offer.
 */
export function detectProfileCategory(
  brandProfile?: any,
  niche?: string
): ProfileCategory {
  const text = [
    brandProfile?.niche,
    brandProfile?.products_services,
    brandProfile?.main_offer,
    brandProfile?.business_name,
    niche,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Software / SaaS / Tech
  if (/\b(software|saas|tech|app|mobile app|web app|developer|coding|code|programming|startup|ai|machine learning|devops|cloud|cybersecurity|fintech|edtech|healthtech|platform|api|plugin|dashboard|crm|erp|no.?code|low.?code|data|analytics|iot|blockchain|crypto|nft|automation|digital product)\b/.test(text)) {
    return "software_tech";
  }

  // Influencer / Creator
  if (/\b(influencer|content creator|youtuber|tiktoker|instagram|social media star|personal brand|blogger|vlogger|podcaster|streamer|lifestyle creator|ugc|ugc creator|reels creator|digital creator)\b/.test(text)) {
    return "influencer_creator";
  }

  // Philosopher / Thought Leader
  if (/\b(philosopher|philosophy|thought leader|stoic|stoicism|wisdom|mindfulness|spirituality|meditation|consciousness|metaphysics|ethics|ontology|epistemology|ancient wisdom|existential|thinker|intellectual|speaker|motivational speaker|life coach|spiritual coach)\b/.test(text)) {
    return "philosopher_thinker";
  }

  // Writer / Author
  if (/\b(writer|author|novelist|poet|poetry|fiction|non-fiction|memoir|book|publishing|literary|screenplay|copywriter|ghostwriter|content writer|journalist|editor|storyteller|newsletter)\b/.test(text)) {
    return "writer_author";
  }

  // Fitness / Health
  if (/\b(fitness|gym|trainer|personal trainer|health coach|wellness|nutrition|dietitian|nutritionist|yoga|pilates|crossfit|bodybuilding|sports|athlete|running|cycling|physical therapy|physiotherapy|supplement|protein|workout|exercise|weight loss|transformation)\b/.test(text)) {
    return "fitness_health";
  }

  // E-Commerce / Fashion
  if (/\b(fashion|clothing|apparel|streetwear|luxury brand|boutique|jewelry|accessories|handbag|shoes|footwear|e-commerce|ecommerce|dropshipping|shopify|amazon seller|print on demand|merchandise|beauty|cosmetics|skincare|makeup|haircare)\b/.test(text)) {
    return "ecommerce_fashion";
  }

  // Finance / Consulting
  if (/\b(finance|financial|investment|investing|trading|stocks|forex|wealth management|financial advisor|accountant|cpa|tax|insurance|mortgage|banking|private equity|venture capital|consulting|business consultant|management consultant|strategy|advisory|executive coach)\b/.test(text)) {
    return "finance_consulting";
  }

  // Food / Restaurant
  if (/\b(food|restaurant|cafe|catering|chef|culinary|bakery|pastry|dessert|cuisine|dining|meal prep|recipe|cooking|food blog|food brand|beverage|bar|winery|brewery|coffee shop)\b/.test(text)) {
    return "food_restaurant";
  }

  // Real Estate
  if (/\b(real estate|property|properties|realtor|agent|broker|luxury home|apartment|condo|commercial property|interior design|architecture|architect|home staging|construction|renovation|development|developer)\b/.test(text)) {
    return "real_estate";
  }

  // Spiritual / Mystical
  if (/\b(spiritual|mystic|mystical|healing|vastu|tarot|aura|astrology|numerology|reiki|holistic|soul|chakra|energy healing|magic|esoteric|occult|meditation|manifestation|wellness)\b/.test(text)) {
    return "spiritual_mystical";
  }

  return "general";
}

export interface GenerateImageOptions {
  prompt: string;
  aspectRatio?: ImageAspectRatio;
  userId?: string;
  niche?: string;
  brandProfile?: any;
  numOutputs?: number;
}

export interface GeneratedImageResult {
  success: boolean;
  imageUrls: string[];
  storageKey?: string;
  aspectRatio: ImageAspectRatio;
  prompt: string;
  provider:
  | "REPLICATE_FLUX_1"
  | "BING_IMAGE_CREATOR"
  | "TOGETHER_FLUX"
  | "GOOGLE_IMAGEN_3"
  | "CURATED_EDITORIAL_PHOTOGRAPHY"
  | "HUGGING_FACE_SDXL";
  latencyMs: number;
}

export interface GeneratedVideoResult {
  success: boolean;
  videoUrl: string | null;
  storageKey?: string;
  prompt: string;
  provider: "REPLICATE_WAN_2_2" | "REPLICATE_WAN_2_1" | "CURATED_VIDEO_REEL";
  latencyMs: number;
}

function sanitizePhotorealisticPrompt(raw: string): string {
  // 1. Strip any anime, manga, cartoon, drawing, illustration words even if negated (FLUX has no negative prompt so tokens like 'anime' trigger anime aesthetics)
  let cleaned = raw
    .replace(/(no|zero|without|not|avoid|never|stop)\s+(anime|manga|cartoon|illustration|drawing|avatar|chibi|cgi|3d\s+render|comic)/gi, "")
    .replace(/\b(anime|manga|cartoon|illustration|drawing|sketch|avatar|chibi|cgi|3d\s+render|comic|pixar|disney)\b/gi, "")
    .replace(/["'“”]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // 2. Prepend strong commercial design anchors
  if (!cleaned.toLowerCase().includes("template") && !cleaned.toLowerCase().includes("poster")) {
    cleaned = `High-end commercial promotional poster template for ${cleaned}`;
  }

  // 3. Append design and realism anchors matching the reference image style
  cleaned += ", professional graphic design layout featuring three distinct glowing feature sections or cards in the center, elegant dark aesthetic with metallic accents, rich luxurious typography perfectly aligned to brand aesthetic, stylised text integration, completely empty of humans, no people, clean composition, premium marketing creative.";

  return cleaned;
}

/**
 * Creates a category-aware, industry-level commercial art-directed photography prompt
 * strictly grounded in the user's specific Brand Profile and detected profile category.
 */
async function buildBrandAlignedVisualPrompt(
  rawPrompt: string,
  brandProfile?: any,
  niche?: string
): Promise<string> {
  const brandName = brandProfile?.business_name || "";
  const brandNiche = brandProfile?.niche || niche || "";
  const products = brandProfile?.products_services || "";
  const offer = brandProfile?.main_offer || "";
  const audience = brandProfile?.target_audience || "";
  const tone = brandProfile?.brand_tone || "Modern, luxury, professional";

  // ─── Detect profile category for specialized art direction ───────────────
  const profileCategory = detectProfileCategory(brandProfile, niche);
  const categoryStyle = CATEGORY_VISUAL_STYLES[profileCategory];

  const cleanedSubject = rawPrompt
    .replace(/generate\s+(a\s+)?(post|image|picture|photo|ad|creative|banner|reel|video)\s+(for|about|of|related\s+to)?/gi, "")
    .replace(/attach\s+(this|image|it|photo)\s+(in|to)?\s+(the\s+)?(post)?/gi, "")
    .replace(/with\s+best\s+caption.*/gi, "")
    .replace(/schedule\s+(in|for|at|on)?\s+.*/gi, "")
    .replace(/to(da)?t\s+at\s+.*/gi, "")
    .replace(/tomorrow\s+at\s+.*/gi, "")
    .replace(/[#@]/g, "")
    .trim();

  // ─── AI-Enhanced Prompt (category-aware system prompt) ───────────────────
  try {
    const { callResilientCompletion } = await import("@/lib/ai-gateway");
    const aiRes = await callResilientCompletion<string>({
      messages: [
        {
          role: "system",
          content: `${categoryStyle.systemContext}

Brand Profile Context:
- Brand Name: ${brandName || "Premium Brand"}
- Profile Category: ${categoryStyle.label}
- Industry / Niche: ${brandNiche || "Modern Business"}
- Products / Services: ${products || offer || "High-end commercial offerings"}
- Target Audience: ${audience || "Discerning clients"}
- Brand Tone & Aesthetic: ${tone}

ART DIRECTION REQUIREMENTS:
1. Ground the visual scene directly in this brand's world — their specific category aesthetics, products, or lifestyle.
2. The scene MUST reflect the "${categoryStyle.label}" industry visual style described above.
3. If products appear: high-end commercial representation, minimalist surface, warm directional light, crisp textures.
4. CRITICAL: DO NOT include any people, humans, or faces. The image must be completely empty of people.
5. The image should be designed as a template, poster, or marketing creative.
6. INCLUDE stylized typography and text perfectly aligned with the brand's aesthetic. The text should be relevant and elegantly integrated into the image layout.

Output ONLY the final 2-3 sentence prompt. No markdown, quotes, or preambles.`,
        },
        {
          role: "user",
          content: `Topic / post visual idea: "${cleanedSubject || brandNiche || "Brand showcase"}"\n\nCategory scene reference examples: ${categoryStyle.exampleScenes.slice(0, 2).join(" | ")}`,
        },
      ],
      temperature: 0.5,
      maxTokens: 200,
    });

    if (aiRes?.content && aiRes.content.trim().length > 25) {
      const lower = aiRes.content.toLowerCase();
      if (!lower.includes("i'm sorry") && !lower.includes("as an ai") && !lower.includes("i cannot")) {
        return sanitizePhotorealisticPrompt(aiRes.content);
      }
    }
  } catch (err) {
    console.warn("[Image Engine] AI prompt enhancement notice:", err);
  }

  // ─── Deterministic category-aware fallback ───────────────────────────────
  const contextSubject = cleanedSubject || products || offer || brandNiche || "commercial showcase";
  const exampleScene = categoryStyle.exampleScenes[Math.floor(Math.random() * categoryStyle.exampleScenes.length)];
  return sanitizePhotorealisticPrompt(
    `High-end ${categoryStyle.label} marketing template — ${exampleScene}. Specifically designed for ${brandName || "the brand"}: ${contextSubject}. Includes relevant typography and text, ${tone.toLowerCase()} aesthetic, ${categoryStyle.label} industry visual language, no people.`
  );
}

/**
 * Poll Replicate prediction until completion
 */
async function pollReplicatePrediction(predictionUrl: string, apiToken: string, maxWaitMs = 12000): Promise<any> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const res = await fetch(predictionUrl, {
      headers: {
        Authorization: `Bearer ${apiToken.trim()}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Replicate poll failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    if (data.status === "succeeded") {
      return data;
    }
    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(`Replicate prediction ${data.status}: ${data.error || "Unknown error"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("Replicate prediction timed out");
}

/**
 * Curated High-Definition Commercial Photography Database (Emergency Safe Fallback)
 */
export const CURATED_COMMERCIAL_PHOTOS: Record<string, string[]> = {
  // ── Software / SaaS / Tech ──────────────────────────────────────────────
  tech: [
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1200&q=80",
  ],
  // ── Influencer / Content Creator ────────────────────────────────────────
  influencer: [
    "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1574267432553-4b4628081c31?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1200&q=80",
  ],
  // ── Philosopher / Thought Leader ────────────────────────────────────────
  philosophy: [
    "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80",
  ],
  // ── Writer / Author ─────────────────────────────────────────────────────
  writing: [
    "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1517770413964-df8ca61194a6?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80",
  ],
  // ── Fitness / Health ────────────────────────────────────────────────────
  fitness: [
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80",
  ],
  // ── E-Commerce / Fashion ────────────────────────────────────────────────
  fashion: [
    "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80",
  ],
  // ── Finance / Consulting ────────────────────────────────────────────────
  finance: [
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80",
  ],
  // ── Food / Restaurant ───────────────────────────────────────────────────
  food: [
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=80",
  ],
  // ── Real Estate / Architecture ──────────────────────────────────────────
  realestate: [
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80",
  ],
  // ── General Business (legacy & marketing) ───────────────────────────────
  business: [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80",
  ],
  marketing: [
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80",
  ],
  teamwork: [
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
  ],
  spiritual: [
    "https://images.unsplash.com/photo-1603503364272-6e27ab3493df?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1601614392472-e1d0f5bbd247?auto=format&fit=crop&w=1200&q=80",
  ],
  default: [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80",
  ],
};

export const CURATED_VERTICAL_REELS: string[] = [
  "/videos/reel-1.mp4",
  "/videos/reel-2.mp4",
  "/videos/reel-3.mp4",
  "https://raw.githubusercontent.com/bower-media-samples/big-buck-bunny-1080p-30s/master/video.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://www.w3schools.com/html/mov_bbb.mp4",
];

/**
 * Generate Ultra-Realistic Commercial Ad Creative Image
 * Priority order:
 * 1. Replicate FLUX.1 (if REPLICATE_API_TOKEN is available)
 * 2. Cloudflare Workers AI FLUX.1 (if CLOUDFLARE_ACCOUNT_ID & CLOUDFLARE_API_TOKEN are available - 10,000 free neurons/day)
 * 3. Together.ai FLUX.1 (if TOGETHER_API_KEY is available)
 * 4. Curated Commercial Photography Fallback (Matched to brand industry & aesthetic)
 */
export async function generateAdCreativeImage(
  options: GenerateImageOptions
): Promise<GeneratedImageResult> {
  const startTime = Date.now();
  const aspectRatio = options.aspectRatio || "1:1";

  // Automatically fetch brand profile for user if not already provided
  let brandProfile = options.brandProfile;
  if (!brandProfile && options.userId) {
    try {
      const { getBrandProfileForUser } = await import("@/lib/brand-helper");
      brandProfile = await getBrandProfileForUser(options.userId);
    } catch {
      // continue without DB profile
    }
  }

  // Synthesize industry-level commercial art-directed prompt grounded in brand details
  const photorealisticPrompt = await buildBrandAlignedVisualPrompt(
    options.prompt,
    brandProfile,
    options.niche
  );

  const dimensions: Record<ImageAspectRatio, { width: number; height: number }> = {
    "1:1": { width: 1024, height: 1024 },
    "9:16": { width: 768, height: 1344 },
    "16:9": { width: 1344, height: 768 },
    "4:5": { width: 896, height: 1120 },
  };
  const { width, height } = dimensions[aspectRatio] || { width: 1024, height: 1024 };

  // ─── Priority 1: Google Gemini (Imagen 3 / gemini-3.1-flash-image) ───────
  /*
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      const brandName = brandProfile?.business_name || "Premium Brand";
      const imagenPrompt = `${photorealisticPrompt}. MUST feature the exact text "${brandName}" legibly in elegant typography. Ensure photorealistic and commercial style.`;
      
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${geminiApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: imagenPrompt }] }]
        })
      });

      if (geminiRes.ok) {
        const json = await geminiRes.json();
        const base64Data = json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Data) {
          const imageBuffer = Buffer.from(base64Data, "base64");
          const storageKey = `creatives/${options.userId || "auto"}/${Date.now()}-gemini.jpg`;
          let finalImageUrl = `data:image/jpeg;base64,${base64Data}`;

          try {
            const { getInsforgeUploadClient } = await import("@/lib/insforge-server");
            const insforge = getInsforgeUploadClient();
            const blob = new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" });
            const { data, error } = await insforge.storage.from("lemon").upload(storageKey, blob as any);
            if (!error && data?.url) {
              finalImageUrl = data.url;
            }
          } catch (storageErr) {
            console.warn("[Image Engine] Insforge upload notice:", storageErr);
          }

          return {
            success: true,
            imageUrls: [finalImageUrl],
            storageKey,
            aspectRatio,
            prompt: imagenPrompt,
            provider: "GOOGLE_IMAGEN_3",
            latencyMs: Date.now() - startTime,
          };
        }
      } else {
        const errText = await geminiRes.text().catch(() => "");
        console.warn(`[Image Engine] Gemini Imagen 3 HTTP ${geminiRes.status}:`, errText);
      }
    }
  }
  */

  // ─── Priority 2: Replicate FLUX.1 ────────────────────────────────────────
  /* 
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (replicateToken && replicateToken.trim()) {
    // Cost guard — Replicate is 10x more expensive per call than a text
    // completion, so charge it heavier. Fails open on Redis outage.
    const { checkAiSpend } = await import("@/lib/ai-cost-guard");
    const verdict = await checkAiSpend({
      provider: "replicate",
      userId: options.userId ?? null,
      weight: 10,
    });
    if (!verdict.allowed) {
      return {
        success: false,
        imageUrls: [],
        aspectRatio,
        prompt: photorealisticPrompt,
        provider: "REPLICATE_FLUX_1",
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const fluxAspectRatio =
        aspectRatio === "9:16" ? "9:16" :
        aspectRatio === "16:9" ? "16:9" :
        aspectRatio === "4:5" ? "4:5" : "1:1";

      const createRes = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateToken.trim()}`,
          "Content-Type": "application/json",
          Prefer: "wait=10",
        },
        body: JSON.stringify({
          input: {
            prompt: photorealisticPrompt,
            aspect_ratio: fluxAspectRatio,
            output_format: "webp",
            output_quality: 90,
            num_outputs: options.numOutputs || 1,
            disable_safety_checker: false,
          },
        }),
      });

      if (createRes.ok) {
        let prediction = await createRes.json();
        if (prediction.status !== "succeeded" && prediction.urls?.get) {
          prediction = await pollReplicatePrediction(prediction.urls.get, replicateToken);
        }

        const outputs = Array.isArray(prediction.output) ? prediction.output : [prediction.output];
        const validOutputs = outputs.filter(Boolean);
        if (validOutputs.length > 0) {
          return {
            success: true,
            imageUrls: validOutputs,
            storageKey: `flux-${prediction.id || Date.now()}`,
            aspectRatio,
            prompt: photorealisticPrompt,
            provider: "REPLICATE_FLUX_1",
            latencyMs: Date.now() - startTime,
          };
        }
      }
    } catch (err) {
      console.warn("[Image Engine] Replicate FLUX.1 attempt notice:", err);
    }
  }
  */

  // ─── Priority 3: Bing Image Creator (DALL-E 3 via bimg) ──────────────────
  /*
  const bingCookie = process.env.BING_IMAGE_COOKIE;
  if (bingCookie) {
    try {
      const { generateImagesLinks } = await import("bimg");
      
      const brandName = brandProfile?.business_name || "Premium Brand";
      const dalle3Prompt = `${photorealisticPrompt}. The image MUST prominently feature the exact text "${brandName}" rendered perfectly in beautiful, legible typography. Ensure the style is a high-end commercial mix of photorealism and 3D digital art.`;
      
      const rawLinks = await generateImagesLinks(dalle3Prompt);
      // Bing's HTML changed, causing bimg to capture JS/SVG scripts. Filter for actual generated images.
      const imageLinks = rawLinks
        .filter((link: string) => link.includes("OIG"))
        .map((link: string) => link.replace(/&amp;/g, "&"));
      
      if (imageLinks && imageLinks.length > 0) {
        const finalImageUrls: string[] = [];
        const baseStorageKey = `bing-${Date.now()}`;
        
        for (let i = 0; i < imageLinks.length; i++) {
          let finalUrl = imageLinks[i];
          try {
            const imgRes = await fetch(finalUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.bing.com/images/create/",
                "Cookie": `_U=${bingCookie}`
              }
            });
            if (imgRes.ok) {
              const arrayBuffer = await imgRes.arrayBuffer();
              const blob = new Blob([new Uint8Array(arrayBuffer)], { type: "image/jpeg" });
              
              const { getInsforgeUploadClient } = await import("@/lib/insforge-server");
              const insforge = getInsforgeUploadClient();
              const storageKey = `creatives/${options.userId || "auto"}/${baseStorageKey}-${i}.jpg`;
              
              const { data, error } = await insforge.storage.from("lemon").upload(storageKey, blob as any);
              if (!error && data?.url) {
                finalUrl = data.url;
              }
            } else {
               console.warn(`[Image Engine] Bing fetch failed for ${finalUrl}: ${imgRes.status}`);
            }
          } catch (uploadErr) {
            console.warn("[Image Engine] Failed to upload Bing image to storage:", uploadErr);
          }
          finalImageUrls.push(finalUrl);
        }

        return {
          success: true,
          imageUrls: finalImageUrls,
          storageKey: baseStorageKey,
          aspectRatio,
          prompt: dalle3Prompt,
          provider: "BING_IMAGE_CREATOR",
          latencyMs: Date.now() - startTime,
        };
      }
    }
  }
  */

  // ─── Priority 3.5: Hugging Face FLUX.1-schnell (via HF's own inference servers) ─────
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfKey) {
    console.warn("[Image Engine] HUGGINGFACE_API_KEY is not set in environment variables. Skipping Hugging Face.");
  } else {
    const brandName = brandProfile?.business_name || "Premium Brand";
    const hfPrompt = `${photorealisticPrompt}. The image MUST prominently feature the exact text "${brandName}" rendered perfectly in beautiful, legible typography. Ensure the style is a high-end commercial mix of photorealism and 3D digital art.`;
    const storageKey = `creatives/${options.userId || "auto"}/${Date.now()}-hf.jpg`;

    try {
      const { InferenceClient } = await import("@huggingface/inference");
      const hfClient = new InferenceClient(hfKey.trim());
      let imageBlob: any;
      try {
        imageBlob = await hfClient.textToImage({
          model: "black-forest-labs/FLUX.1-schnell",
          inputs: hfPrompt,
        });
      } catch (fluxErr: any) {
        console.warn("[Image Engine] HF FLUX.1-schnell notice, trying FLUX.1-dev:", fluxErr?.message || fluxErr);
        try {
          imageBlob = await hfClient.textToImage({
            model: "black-forest-labs/FLUX.1-dev",
            inputs: hfPrompt,
          });
        } catch (fluxDevErr: any) {
          console.warn("[Image Engine] HF FLUX.1-dev notice, trying SD 3.5:", fluxDevErr?.message || fluxDevErr);
          imageBlob = await hfClient.textToImage({
            model: "stabilityai/stable-diffusion-3.5-large",
            inputs: hfPrompt,
          });
        }
      }

      let finalImageUrl = "";
      if (typeof imageBlob === "string") {
        finalImageUrl = imageBlob;
      } else {
        const arrayBuffer = await (imageBlob as unknown as Blob).arrayBuffer();
        finalImageUrl = `data:image/jpeg;base64,${Buffer.from(arrayBuffer).toString("base64")}`;
        try {
          const blob = new Blob([new Uint8Array(arrayBuffer)], { type: "image/jpeg" });
          const { getInsforgeUploadClient } = await import("@/lib/insforge-server");
          const insforge = getInsforgeUploadClient();
          const { data, error } = await insforge.storage.from("lemon").upload(storageKey, blob as any);
          if (!error && data?.url) finalImageUrl = data.url;
        } catch (storageErr) {
          console.warn("[Image Engine] Insforge upload notice:", storageErr);
        }
      }

      return {
        success: true,
        imageUrls: [finalImageUrl],
        storageKey,
        aspectRatio,
        prompt: hfPrompt,
        provider: "HUGGING_FACE_SDXL",
        latencyMs: Date.now() - startTime,
      };
    } catch (hfErr: any) {
      console.warn("[Image Engine] HF SDK attempt notice:", hfErr?.message || hfErr);
    }
  }

  // ─── Priority 4: Together.ai FLUX.1-schnell-Free ─────────────────────────
  const togetherKey = process.env.TOGETHER_API_KEY;
  if (togetherKey) {
    try {
      const res = await fetch("https://api.together.xyz/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${togetherKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "black-forest-labs/FLUX.1-schnell-Free",
          prompt: photorealisticPrompt,
          width,
          height,
          steps: 8,
          n: 1,
          response_format: "url",
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { data?: { url?: string }[] };
        const imageUrls = data?.data?.map(d => d.url).filter(Boolean) as string[];
        if (imageUrls && imageUrls.length > 0) {
          return {
            success: true,
            imageUrls,
            storageKey: `creatives/${options.userId || "auto"}/${Date.now()}.webp`,
            aspectRatio,
            prompt: photorealisticPrompt,
            provider: "TOGETHER_FLUX",
            latencyMs: Date.now() - startTime,
          };
        }
      }
    } catch (err) {
      console.warn("[Image Engine] Together.ai attempt notice:", err);
    }
  }

  // ─── Priority 5: Curated Commercial Photography Fallback ──────────────────
  // Use profile category detection for a semantically-matched fallback photo
  const detectedCategory = detectProfileCategory(brandProfile, options.niche);
  const categoryFallbackKey = CATEGORY_VISUAL_STYLES[detectedCategory]?.fallbackCategory || "default";
  const list = CURATED_COMMERCIAL_PHOTOS[categoryFallbackKey] || CURATED_COMMERCIAL_PHOTOS.default;
  const selectedPhoto = list[Math.floor(Math.random() * list.length)];

  return {
    success: true,
    imageUrls: [selectedPhoto],
    storageKey: `fallback-editorial-${Date.now()}`,
    aspectRatio,
    prompt: photorealisticPrompt,
    provider: "CURATED_EDITORIAL_PHOTOGRAPHY",
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Generate 9:16 Vertical Video Reel via Replicate (Wan 2.2 S2V / Wan 2.1)
 * Produces commercial cinematic video reels for Instagram Reels / YouTube Shorts.
 */
export async function generateAdCreativeVideo(options: {
  prompt: string;
  userId?: string;
  niche?: string;
  brandProfile?: any;
}): Promise<GeneratedVideoResult> {
  const startTime = Date.now();
  const replicateToken = process.env.REPLICATE_API_TOKEN;

  // Automatically fetch brand profile for user if not already provided
  let brandProfile = options.brandProfile;
  if (!brandProfile && options.userId) {
    try {
      const { getBrandProfileForUser } = await import("@/lib/brand-helper");
      brandProfile = await getBrandProfileForUser(options.userId);
    } catch {
      // continue without DB profile
    }
  }

  const photorealisticPrompt = await buildBrandAlignedVisualPrompt(options.prompt, brandProfile, options.niche);

  if (replicateToken && replicateToken.trim()) {
    // 1. Primary: Try Wan 2.2 S2V ($0.02/sec, 1080p Full HD)
    try {
      const wan22Res = await fetch("https://api.replicate.com/v1/models/alibaba-pai/wan-2.2-s2v/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateToken.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            prompt: `Cinematic 9:16 vertical commercial video reel. ${photorealisticPrompt}. 1080p full HD, natural human physics, photorealistic cinematography.`,
            aspect_ratio: "9:16",
            duration: 5,
            resolution: "1080p",
          },
        }),
      });

      if (wan22Res.ok) {
        const initialPrediction = await wan22Res.json();
        if (initialPrediction.urls?.get) {
          const finished = await pollReplicatePrediction(initialPrediction.urls.get, replicateToken, 180000);
          const videoUrl = Array.isArray(finished.output) ? finished.output[0] : finished.output;
          if (videoUrl) {
            return {
              success: true,
              videoUrl,
              storageKey: `wan22-${finished.id || Date.now()}`,
              prompt: options.prompt,
              provider: "REPLICATE_WAN_2_2",
              latencyMs: Date.now() - startTime,
            };
          }
        }
      }
    } catch (err) {
      console.warn("[Replicate Video Engine] Wan 2.2 attempt notice:", err);
    }

    // Primary: Try Wan 2.1 1.3b via Replicate
    try {
      const wan21Res = await fetch("https://api.replicate.com/v1/models/wan-video/wan-2.1-1.3b/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateToken.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            prompt: `Cinematic 9:16 vertical commercial video reel. ${photorealisticPrompt}. High resolution, smooth natural camera motion, photorealistic cinematography.`,
            aspect_ratio: "9:16",
            resolution: "720p",
          },
        }),
      });

      if (wan21Res.ok) {
        const initialPrediction = await wan21Res.json();
        if (initialPrediction.urls?.get) {
          const finished = await pollReplicatePrediction(initialPrediction.urls.get, replicateToken, 180000);
          const videoUrl = Array.isArray(finished.output) ? finished.output[0] : finished.output;
          if (videoUrl) {
            return {
              success: true,
              videoUrl,
              storageKey: `wan21-${finished.id || Date.now()}`,
              prompt: options.prompt,
              provider: "REPLICATE_WAN_2_1",
              latencyMs: Date.now() - startTime,
            };
          }
        }
      }
    } catch (err) {
      console.warn("[Replicate Video Engine] Wan 2.1 attempt notice:", err);
    }
  }

  // Fallback vertical reel
  const randomReel = CURATED_VERTICAL_REELS[Math.floor(Math.random() * CURATED_VERTICAL_REELS.length)];

  return {
    success: true,
    videoUrl: randomReel,
    storageKey: `fallback-reel-${Date.now()}`,
    prompt: options.prompt,
    provider: "CURATED_VIDEO_REEL",
    latencyMs: Date.now() - startTime,
  };
}
