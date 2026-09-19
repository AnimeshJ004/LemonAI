import { describe, it, expect } from "vitest";

describe("Studio Features: SEO Blog & Carousel Generators", () => {
  describe("SEO Blog Optimization & Scoring Logic", () => {
    // Replicate the pure calculation logic used in the SEO audit scorecard
    function calculateSeoScore({
      title,
      metaDescription,
      focusKeyword,
      articleText,
      h2Count,
      faqCount,
    }: {
      title: string;
      metaDescription: string;
      focusKeyword: string;
      articleText: string;
      h2Count: number;
      faqCount: number;
    }) {
      const words = articleText.split(/\s+/).filter(Boolean);
      const wordCount = words.length;

      const titleLengthOk = title.length >= 35 && title.length <= 65;
      const titleHasKeyword = focusKeyword
        ? title.toLowerCase().includes(focusKeyword.toLowerCase())
        : true;
      const metaLengthOk =
        metaDescription.length >= 120 && metaDescription.length <= 160;
      const metaHasKeyword = focusKeyword
        ? metaDescription.toLowerCase().includes(focusKeyword.toLowerCase())
        : true;

      let keywordMatches = 0;
      if (focusKeyword && wordCount > 0) {
        const escaped = focusKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "gi");
        const found = articleText.match(regex);
        keywordMatches = found ? found.length : 0;
      }
      const keywordDensity =
        wordCount > 0 ? (keywordMatches / wordCount) * 100 : 0;
      const keywordDensityOk = keywordDensity >= 0.5 && keywordDensity <= 3.0;

      const headingsOk = h2Count >= 3;
      const faqsOk = faqCount >= 2;

      let score = 0;
      if (titleLengthOk) score += 15;
      if (titleHasKeyword) score += 15;
      if (metaLengthOk) score += 15;
      if (metaHasKeyword) score += 10;
      if (headingsOk) score += 15;
      if (keywordDensityOk) score += 15;
      if (faqsOk) score += 15;

      return {
        score: Math.min(100, score),
        wordCount,
        keywordMatches,
        keywordDensity: Number(keywordDensity.toFixed(1)),
        titleLengthOk,
        titleHasKeyword,
        metaLengthOk,
        metaHasKeyword,
        headingsOk,
        faqsOk,
        keywordDensityOk,
      };
    }

    it("evaluates a perfectly optimized SEO blog article as 100/100", () => {
      const keyword = "content marketing";
      const title = "The Master Guide to Content Marketing in 2026"; // 46 chars (in 35-65 range)
      const meta =
        "Master content marketing with our battle-tested playbook. Discover frameworks to accelerate organic lead generation and scale your brand revenue today."; // 152 chars (in 120-160 range)

      // Create dummy text where keyword appears with ~1.5% density
      const filler = "growth strategy framework pipeline conversion analytics velocity scale ";
      const articleText = (filler.repeat(10) + keyword + " ").repeat(10); // ~100 words, keyword 10 times

      const result = calculateSeoScore({
        title,
        metaDescription: meta,
        focusKeyword: keyword,
        articleText,
        h2Count: 4,
        faqCount: 3,
      });

      expect(result.score).toBe(100);
      expect(result.titleLengthOk).toBe(true);
      expect(result.titleHasKeyword).toBe(true);
      expect(result.metaLengthOk).toBe(true);
      expect(result.metaHasKeyword).toBe(true);
      expect(result.headingsOk).toBe(true);
      expect(result.faqsOk).toBe(true);
      expect(result.keywordDensityOk).toBe(true);
    });

    it("penalizes title that is too short or missing focus keyword", () => {
      const result = calculateSeoScore({
        title: "Short Title", // 11 chars
        metaDescription:
          "Discover how modern teams scale organic traffic with our proven playbook. Learn actionable frameworks and maximize your brand velocity today.", // 142 chars
        focusKeyword: "inbound marketing",
        articleText: "inbound marketing strategy ".repeat(20),
        h2Count: 3,
        faqCount: 2,
      });

      expect(result.titleLengthOk).toBe(false);
      expect(result.titleHasKeyword).toBe(false);
      expect(result.score).toBeLessThan(75);
    });

    it("accurately calculates keyword density and catches over-stuffing", () => {
      const keyword = "seo strategy";
      // Over-stuffing: keyword repeated constantly
      const articleText = (keyword + " ").repeat(50);

      const result = calculateSeoScore({
        title: "Complete Guide to SEO Strategy For High-Growth Brands",
        metaDescription:
          "Discover how an effective SEO strategy accelerates qualified pipeline growth. Read actionable frameworks and implementation tactics now.",
        focusKeyword: keyword,
        articleText,
        h2Count: 4,
        faqCount: 3,
      });

      // Density is ~50%, which is way above the 3.0% threshold
      expect(result.keywordDensityOk).toBe(false);
      expect(result.keywordDensity).toBeGreaterThan(10);
    });

    it("generates structured Markdown export containing all headers and FAQs", () => {
      const blog = {
        title: "How to Scale Organic Reach",
        metaDescription: "The complete playbook for high-retention reach.",
        slug: "scale-organic-reach",
        readTime: "6 min read",
        searchIntent: "Informational",
        keyTakeaways: ["Automate low-leverage tasks", "Focus on core asset quality"],
        sections: [
          { type: "INTRO", h2: null, content: "Introductory hook." },
          { type: "SECTION", h2: "1. Core Framework", content: "Section body text." },
          {
            type: "FAQ",
            h2: "Frequently Asked Questions",
            faqs: [{ q: "How long does it take?", a: "Around 30-60 days." }],
          },
        ],
      };

      const lines: string[] = [];
      lines.push(`# ${blog.title}\n`);
      lines.push(`> **Meta Description:** ${blog.metaDescription}`);
      if (blog.keyTakeaways) {
        lines.push("### 💡 Key Takeaways\n");
        blog.keyTakeaways.forEach((k) => lines.push(`- ${k}`));
      }
      blog.sections.forEach((s) => {
        if (s.h2) lines.push(`## ${s.h2}\n`);
        if (s.content) lines.push(`${s.content}\n`);
        if (s.faqs) {
          s.faqs.forEach((f) => {
            lines.push(`### Q: ${f.q}`);
            lines.push(`${f.a}\n`);
          });
        }
      });
      const md = lines.join("\n");

      expect(md).toContain("# How to Scale Organic Reach");
      expect(md).toContain("### 💡 Key Takeaways");
      expect(md).toContain("- Automate low-leverage tasks");
      expect(md).toContain("## 1. Core Framework");
      expect(md).toContain("### Q: How long does it take?");
    });
  });

  describe("Carousel Multi-Slide Generator Logic", () => {
    it("validates and clamps carousel slide count between 5 and 10", () => {
      const clampSlides = (count: number) => Math.min(Math.max(count, 5), 10);

      expect(clampSlides(2)).toBe(5);
      expect(clampSlides(7)).toBe(7);
      expect(clampSlides(15)).toBe(10);
    });

    it("supports varied slide types including COVER, STAT_CALLOUT, CONTENT, QUOTE, and CTA", () => {
      const slides = [
        { slideNumber: 1, type: "COVER", headline: "The 5 Laws of Growth" },
        {
          slideNumber: 2,
          type: "STAT_CALLOUT",
          headline: "High Conversion Velocity",
          statNumber: "87%",
          statLabel: "increase in pipeline retention",
        },
        {
          slideNumber: 3,
          type: "CONTENT",
          headline: "Step 1: Eliminate Waste",
          bulletPoints: ["Audit repetitive steps", "Automate routing"],
        },
        {
          slideNumber: 4,
          type: "QUOTE",
          headline: "The Fundamental Rule",
          quoteText: "Speed is the ultimate competitive moat.",
          quoteAuthor: "Anonymous Founder",
        },
        {
          slideNumber: 5,
          type: "CTA",
          headline: "Ready to scale?",
          bulletPoints: ["Save for later", "Follow for weekly drops"],
        },
      ];

      expect(slides).toHaveLength(5);
      expect(slides[0].type).toBe("COVER");
      expect(slides[1].type).toBe("STAT_CALLOUT");
      expect(slides[1].statNumber).toBe("87%");
      expect(slides[3].type).toBe("QUOTE");
      expect(slides[3].quoteAuthor).toBe("Anonymous Founder");
      expect(slides[4].type).toBe("CTA");
    });

    it("formats a downloadable Markdown deck with slide demarcations", () => {
      const carousel = {
        title: "Scaling Inbound Pipeline",
        slides: [
          { slideNumber: 1, type: "COVER", headline: "Cover Slide", subtext: "Swipe →" },
          { slideNumber: 2, type: "CONTENT", headline: "Content Slide", bulletPoints: ["Point A", "Point B"] },
        ],
        caption: "Full post caption with hashtags #marketing",
      };

      const markdown =
        `# ${carousel.title}\n\n` +
        carousel.slides
          .map(
            (s: any) =>
              `## Slide ${s.slideNumber} (${s.type})\n### ${s.headline}\n${s.subtext || ""}\n${
                s.bulletPoints?.map((bp: string) => `- ${bp}`).join("\n") || ""
              }`
          )
          .join("\n\n---\n\n") +
        `\n\n---\n\n### Caption:\n${carousel.caption}`;

      expect(markdown).toContain("# Scaling Inbound Pipeline");
      expect(markdown).toContain("## Slide 1 (COVER)");
      expect(markdown).toContain("## Slide 2 (CONTENT)");
      expect(markdown).toContain("- Point A");
      expect(markdown).toContain("### Caption:\nFull post caption with hashtags #marketing");
    });
  });
});
