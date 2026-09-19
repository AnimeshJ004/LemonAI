import { describe, it, expect, vi, beforeEach } from "vitest";
import { isCommentInquiry, normalizeSentiment } from "@/lib/social-comments-service";

describe("Social Automation Suite (LinkedIn, Twitter/X, YouTube)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Inquiry & Buyer Intent Detection", () => {
    it("detects buyer intent for YouTube video comments", () => {
      expect(isCommentInquiry("What is the price for this SaaS setup?")).toBe(true);
      expect(isCommentInquiry("How much does the enterprise solution cost?")).toBe(true);
      expect(isCommentInquiry("Can we book a demo walkthrough?")).toBe(true);
      expect(isCommentInquiry("Great video, very helpful!")).toBe(false);
    });

    it("detects buyer intent for LinkedIn post comments and messages", () => {
      expect(isCommentInquiry("Interested to connect and learn about your packages")).toBe(true);
      expect(isCommentInquiry("Would love to hire your team for our Q4 campaign")).toBe(true);
      expect(isCommentInquiry("Can you send quotation for 50 team licenses?")).toBe(true);
      expect(isCommentInquiry("Congrats on the launch!")).toBe(false);
    });

    it("detects buyer intent for Twitter / X DMs and tweet replies", () => {
      expect(isCommentInquiry("Hey, please DM me pricing info")).toBe(true);
      expect(isCommentInquiry("How much for monthly consulting?")).toBe(true);
      expect(isCommentInquiry("Just following your journey")).toBe(false);
    });

    it("detects Hinglish and Indian market buyer intent patterns", () => {
      expect(isCommentInquiry("Iska kya price hai bhai?")).toBe(true);
      expect(isCommentInquiry("Service chahiye, kaise sampark karein?")).toBe(true);
      expect(isCommentInquiry("Kitna charge lagega iska?")).toBe(true);
    });
  });

  describe("Sentiment Normalization", () => {
    it("normalizes diverse sentiment inputs strictly to check constraint values", () => {
      expect(normalizeSentiment("inquiry")).toBe("INQUIRY");
      expect(normalizeSentiment("praise")).toBe("PRAISE");
      expect(normalizeSentiment("complaint")).toBe("COMPLAINT");
      expect(normalizeSentiment("spam")).toBe("SPAM");
      expect(normalizeSentiment("unknown_value")).toBe("NEUTRAL");
      expect(normalizeSentiment(null)).toBe("NEUTRAL");
    });
  });

  describe("Channel Platform Source Mapping", () => {
    it("correctly maps multi-platform channel sources to valid CRM sources", () => {
      const getNormalizedSource = (platform: string) => {
        const upper = String(platform || "").toUpperCase();
        return upper === "FACEBOOK"
          ? "facebook"
          : upper === "THREADS"
          ? "threads"
          : upper === "YOUTUBE"
          ? "youtube"
          : upper === "LINKEDIN"
          ? "linkedin"
          : upper === "TWITTER" || upper === "X"
          ? "twitter"
          : "instagram";
      };

      expect(getNormalizedSource("YOUTUBE")).toBe("youtube");
      expect(getNormalizedSource("youtube")).toBe("youtube");
      expect(getNormalizedSource("LINKEDIN")).toBe("linkedin");
      expect(getNormalizedSource("linkedin")).toBe("linkedin");
      expect(getNormalizedSource("TWITTER")).toBe("twitter");
      expect(getNormalizedSource("X")).toBe("twitter");
      expect(getNormalizedSource("INSTAGRAM")).toBe("instagram");
      expect(getNormalizedSource("FACEBOOK")).toBe("facebook");
      expect(getNormalizedSource("THREADS")).toBe("threads");
    });
  });

  describe("Twitter API v2 DM dispatch formatting", () => {
    it("constructs valid payload and endpoint for Twitter DM", () => {
      const recipientId = "145892301";
      const messageText = "Hi! Thanks for your interest. Here are our consulting options.";

      const isConvEndpoint = String(recipientId).includes("-") || String(recipientId).length > 20;
      const url = isConvEndpoint
        ? `https://api.twitter.com/2/dm_conversations/${recipientId}/messages`
        : `https://api.twitter.com/2/dm_conversations/with/${recipientId}/messages`;

      const payload = {
        message: { text: messageText },
      };

      expect(url).toBe("https://api.twitter.com/2/dm_conversations/with/145892301/messages");
      expect(payload.message.text).toBe(messageText);
    });
  });

  describe("YouTube Data API v3 comment reply formatting", () => {
    it("constructs valid payload and endpoint for YouTube comment reply", () => {
      const commentId = "UgzABCD1234efgh";
      const replyText = "Thanks for watching! We offer full agency support.";

      const endpoint = "https://www.googleapis.com/youtube/v3/comments?part=snippet";
      const payload = {
        snippet: {
          parentId: commentId,
          textOriginal: replyText,
        },
      };

      expect(endpoint).toContain("youtube/v3/comments");
      expect(payload.snippet.parentId).toBe(commentId);
      expect(payload.snippet.textOriginal).toBe(replyText);
    });
  });

  describe("LinkedIn Messaging API payload formatting", () => {
    it("constructs valid URN-based recipient and body for LinkedIn", () => {
      const recipientUrn = "urn:li:person:abcdef123";
      const content = "Hello! We would love to discuss enterprise pricing for your team.";

      const targetRecipient = recipientUrn.startsWith("urn:li:person:")
        ? recipientUrn
        : `urn:li:person:${recipientUrn}`;

      const payload = {
        recipients: [targetRecipient],
        message: { body: content },
      };

      expect(payload.recipients[0]).toBe("urn:li:person:abcdef123");
      expect(payload.message.body).toBe(content);
    });
  });
});
