import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChannelTypeEnum } from "@/constants/channels";

// Setup mocked Insforge DB client
const { mockAdmin, queueResponses } = vi.hoisted(() => {
  const queue: any[] = [];
  const chain = () => {
    const c: any = {
      select: vi.fn(() => c),
      update: vi.fn(() => c),
      eq: vi.fn(() => c),
      in: vi.fn(() => c),
      single: vi.fn(() => Promise.resolve(queue.shift() ?? { data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve(queue.shift() ?? { data: null, error: null })),
      then: (resolve: any) => resolve(queue.shift() ?? { data: [], error: null }),
    };
    return c;
  };

  const admin = {
    database: {
      from: vi.fn(() => chain()),
    },
  };

  return {
    mockAdmin: admin,
    queueResponses: (responses: any[]) => queue.push(...responses),
  };
});

vi.mock("@/lib/insforge-server", () => ({
  getInsforgeAdminClient: () => mockAdmin,
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: (val: string) => val,
  encrypt: (val: string) => val,
}));

vi.mock("@/lib/social-oauth", () => ({
  refreshOauthToken: vi.fn(async () => ({ accessToken: "fresh_token", expiresIn: 3600 })),
}));

import { publishPostDirectly } from "@/lib/direct-publisher";

describe("Publisher Engine Integration Tests (lib/direct-publisher.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe("Post Lifecycle & Concurrency Guard", () => {
    it("returns error when scheduled post is not found", async () => {
      queueResponses([{ data: null, error: { message: "Not found" } }]);

      const res = await publishPostDirectly("non_existent_post_id");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Post not found");
    });

    it("returns existing published_url without republishing if already published", async () => {
      queueResponses([
        {
          data: {
            id: "post_1",
            status: "published",
            published_url: "https://instagram.com/p/C_already_published",
          },
          error: null,
        },
      ]);

      const res = await publishPostDirectly("post_1");
      expect(res.success).toBe(true);
      expect(res.publishedUrl).toBe("https://instagram.com/p/C_already_published");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("skips execution safely when another concurrent worker claimed the post lock", async () => {
      // Step 1: Initial post fetch succeeds
      queueResponses([
        {
          data: {
            id: "post_locked",
            status: "queue",
            content: "Hello World",
            user_channels: {
              id: "chan_1",
              channel_types: { type: ChannelTypeEnum.TWITTER },
            },
          },
          error: null,
        },
        // Step 2: CAS lock update returns 0 rows (another instance updated status to publishing)
        { data: [], error: null },
      ]);

      const res = await publishPostDirectly("post_locked");
      expect(res.success).toBe(true);
      expect(res.skipped).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("fails cleanly when post has no channel or channel type associated", async () => {
      queueResponses([
        // Post fetch with no channel
        {
          data: {
            id: "post_no_chan",
            status: "queue",
            content: "Post without channel",
            user_id: "user_orphan",
            user_channels: null,
          },
          error: null,
        },
        // CAS lock succeeds
        { data: [{ id: "post_no_chan" }], error: null },
        // Fallback user channels query returns empty
        { data: [], error: null },
        // markPostFailed update
        { data: null, error: null },
      ]);

      const res = await publishPostDirectly("post_no_chan");
      expect(res.success).toBe(false);
      expect(res.error).toContain("missing");
    });
  });

  describe("Token Handling & Simulation Mode", () => {
    it("uses simulated sandbox URL when access token is absent or disconnected", async () => {
      queueResponses([
        {
          data: {
            id: "post_sim",
            status: "queue",
            content: "Staging sandbox preview test",
            user_channels: {
              id: "chan_sim",
              handle: "acme_growth",
              access_token: null,
              channel_types: { type: ChannelTypeEnum.LINKEDIN },
            },
          },
          error: null,
        },
        // CAS lock succeeds
        { data: [{ id: "post_sim" }], error: null },
        // markPostPublished update
        { data: null, error: null },
      ]);

      const res = await publishPostDirectly("post_sim");
      expect(res.success).toBe(true);
      expect(res.simulated).toBe(true);
      expect(res.publishedUrl).toContain("linkedin.com/acme_growth/status/");
    });
  });

  describe("Multi-Platform Provider Dispatch", () => {
    it("handles YouTube post publishing URL generation when no video attached", async () => {
      queueResponses([
        {
          data: {
            id: "post_yt",
            status: "queue",
            content: "Check out our new deep dive video",
            user_channels: {
              id: "chan_yt",
              handle: "@ApexGrowth",
              access_token: "mock_yt_token",
              channel_types: { type: ChannelTypeEnum.YOUTUBE },
            },
          },
          error: null,
        },
        // CAS lock
        { data: [{ id: "post_yt" }], error: null },
        // markPostPublished update
        { data: null, error: null },
      ]);

      const res = await publishPostDirectly("post_yt");
      expect(res.success).toBe(true);
      expect(res.publishedUrl).toContain("youtube.com/@ApexGrowth");
    });

    it("publishes video directly to YouTube using Google Data API v3 resumable protocol", async () => {
      const mockFetch = vi.fn();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: async () => new Uint8Array([0, 1, 2, 3]).buffer,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({
            location: "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=session_xyz",
          }),
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: "dQw4w9WgXcQ", snippet: { title: "Scaling to $100k" } }),
        });

      global.fetch = mockFetch as any;

      queueResponses([
        {
          data: {
            id: "post_yt_video",
            status: "queue",
            content: "Scaling to $100k MRR with Autonomous AI Agents #saas #growth",
            images: [
              {
                url: "https://storage.lemonai.com/videos/demo.mp4",
                key: "video_key",
                media_type: "video",
              },
            ],
            user_channels: {
              id: "chan_yt",
              handle: "@ApexGrowth",
              access_token: "mock_yt_token",
              channel_types: { type: ChannelTypeEnum.YOUTUBE },
            },
          },
          error: null,
        },
        // CAS lock
        { data: [{ id: "post_yt_video" }], error: null },
        // markPostPublished update
        { data: null, error: null },
      ]);

      const res = await publishPostDirectly("post_yt_video");
      expect(res.success).toBe(true);
      expect(res.publishedUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("catches network dispatch errors and marks post as failed with message", async () => {
      // Mock fetch rejection across all calls
      (global.fetch as any).mockImplementation(() => Promise.reject(new Error("Meta Graph API network error")));

      queueResponses([
        {
          data: {
            id: "post_err",
            status: "queue",
            content: "Network error test",
            user_channels: {
              id: "chan_fb",
              handle: "apexpage",
              access_token: "fb_token",
              provider_account_id: "page_123",
              channel_types: { type: ChannelTypeEnum.FACEBOOK },
            },
          },
          error: null,
        },
        // CAS lock
        { data: [{ id: "post_err" }], error: null },
        // markPostFailed update
        { data: null, error: null },
      ]);

      const res = await publishPostDirectly("post_err");
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });
});
