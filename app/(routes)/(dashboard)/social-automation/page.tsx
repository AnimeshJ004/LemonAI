"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, MessageSquare, Zap, CheckCircle, Send, RefreshCw, Sparkles, ShieldAlert, Heart, HelpCircle, Inbox, Clock } from "lucide-react";

export default function SocialAutomationPage() {
  const [testComment, setTestComment] = useState({ text: "", platform: "INSTAGRAM" });
  const [testResult, setTestResult] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const queryClient = useQueryClient();

  // Fetch comment logs — declared BEFORE handleSyncLiveComments to prevent ReferenceError
  const { data: commentsData, isLoading, refetch } = useQuery({
    queryKey: ["social-comments"],
    queryFn: async () => {
      const res = await fetch("/api/social/comments");
      if (!res.ok) throw new Error("Failed to load comment history");
      return res.json();
    },
    // Auto-refresh every 30 seconds to keep comment log fresh
    refetchInterval: 30000,
  });

  // Bug fix: moved BELOW useQuery so `refetch` is in scope
  const handleSyncLiveComments = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/social/sync-now", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to sync comments from Instagram");
      } else if (data.repliedCount > 0) {
        toast.success(`Successfully replied to ${data.repliedCount} new comment(s) on Instagram! 🎉`);
      } else {
        toast.info("Scanned latest posts — all comments are already replied to! 👍");
      }
    } catch (e) {
      toast.error("Network error syncing comments from Instagram");
    } finally {
      // Race condition fix: refetch THEN clear loading state
      await refetch();
      setIsSyncing(false);
    }
  };

  // Test comment AI reply
  const { mutate: testCommentReply, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/social/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentText: testComment.text,
          platform: testComment.platform,
          commenterHandle: "@test_buyer",
        }),
      });
      if (!res.ok) throw new Error("Failed to generate response");
      return res.json();
    },
    onSuccess: (data) => {
      setTestResult(data);
      toast.success("AI reply generated!");
      queryClient.invalidateQueries({ queryKey: ["social-comments"] });
    },
    onError: () => toast.error("Failed to generate AI reply"),
  });

  const comments = commentsData?.comments || [];
  const sentimentColors: Record<string, string> = {
    INQUIRY: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900",
    PRAISE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
    COMPLAINT: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900",
    SPAM: "bg-muted text-muted-foreground border-border",
    NEUTRAL: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900",
  };

  const samplePresets = [
    { text: "What is the price of this? Can I order today?", platform: "INSTAGRAM" },
    { text: "Love this product, absolute gamechanger! 🔥", platform: "INSTAGRAM" },
    { text: "Where are you located and do you deliver across India?", platform: "FACEBOOK" },
  ];

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="size-6 text-primary" /> Social Automation
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Autonomous 24/7 AI engagement for Instagram & Facebook comments and DM conversions
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm" className="gap-2 text-xs border-purple-300 text-purple-600 hover:bg-purple-50">
            <Link href="/social-automation/dm-inbox">
              <Inbox className="size-3.5" /> DM Inbox
            </Link>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSyncLiveComments}
            disabled={isSyncing}
            className="gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <RefreshCw className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Scanning Instagram..." : "Sync & Auto-Reply Now"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 text-xs">
            <RefreshCw className="size-3.5" /> Refresh Log
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Replies", value: comments.length, icon: MessageSquare, color: "text-blue-500" },
          { label: "Inquiries", value: comments.filter((c: any) => c.sentiment === "INQUIRY").length, icon: Zap, color: "text-amber-500" },
          { label: "Praises", value: comments.filter((c: any) => c.sentiment === "PRAISE").length, icon: Heart, color: "text-emerald-500" },
          { label: "DMs Triggered", value: comments.filter((c: any) => c.dm_sent).length, icon: Send, color: "text-purple-500" },
        ].map((stat, i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="pt-4 flex items-center gap-3">
              <stat.icon className={`size-5 ${stat.color} shrink-0`} />
              <div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Autonomous System Status Banner */}
      <Card className="border-emerald-200/80 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-xs">
        <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
              <CheckCircle className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">
                  Autonomous Auto-Reply Engine is Active
                </p>
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
                Whenever a comment arrives on your connected Instagram or Facebook posts, Lemon AI reads it, classifies sentiment, posts the public reply, and triggers private lead DMs automatically with zero human effort.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-xs font-mono bg-background text-foreground/80">
              Webhook: /api/social/webhook
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Test Interactive AI Panel */}
      <Card className="shadow-sm border-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Simulator Sandbox (Preview AI Responses)
          </CardTitle>
          <CardDescription>
            Use this sandbox to test how Gemini AI classifies and answers different comments. <strong>In production, real comments from Instagram & Facebook are answered 100% automatically without any manual action.</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="text-xs text-muted-foreground font-medium py-1">Quick presets:</span>
            {samplePresets.map((preset, idx) => (
              <Button
                key={idx}
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => setTestComment({ text: preset.text, platform: preset.platform })}
              >
                "{preset.text.substring(0, 32)}..."
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold">Incoming Comment</Label>
              <Input
                placeholder='e.g. "What is the price? Do you ship to Mumbai?"'
                value={testComment.text}
                onChange={(e) => setTestComment((t) => ({ ...t, text: e.target.value }))}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Platform</Label>
              <Select
                value={testComment.platform}
                onValueChange={(v) => setTestComment((t) => ({ ...t, platform: v }))}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INSTAGRAM" className="text-xs">📸 Instagram</SelectItem>
                  <SelectItem value="FACEBOOK" className="text-xs">📘 Facebook</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={() => testCommentReply()}
            disabled={isPending || !testComment.text.trim()}
            className="gap-2"
          >
            {isPending ? (
              <>
                <RefreshCw className="size-4 animate-spin" /> Analyzing & Generating...
              </>
            ) : (
              <>
                <Zap className="size-4" /> Run AI Auto-Reply
              </>
            )}
          </Button>

          {testResult && (
            <div className="p-4 rounded-xl bg-muted/40 border space-y-3 mt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs font-semibold ${sentimentColors[testResult.sentiment] || ""}`}>
                    {testResult.sentiment}
                  </Badge>
                  {testResult.shouldSendDM && (
                    <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-600 border-purple-200">
                      📩 Lead DM Triggered
                    </Badge>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">Generated in ~450ms</span>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Public Comment Reply:</p>
                <p className="text-sm font-medium bg-background p-3 rounded-lg border text-foreground">
                  💬 {testResult.reply}
                </p>
              </div>

              {testResult.dmMessage && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Private DM Copy Sent to Lead:</p>
                  <p className="text-xs bg-purple-50 dark:bg-purple-950/20 text-purple-900 dark:text-purple-200 p-2.5 rounded-lg border border-purple-200 dark:border-purple-900">
                    📩 {testResult.dmMessage}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comment History Log */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="size-4 text-primary" /> Auto-Reply Activity Log
          </CardTitle>
          <CardDescription>
            Live stream of incoming comments and autonomous AI actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="size-4 animate-spin" /> Loading recent activity...
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Bot className="size-8 mx-auto text-muted-foreground/50" />
              <p className="text-sm font-medium">No comments processed yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Use the test tool above to generate your first AI comment reply and verify the flow.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment: any) => (
                <div
                  key={comment.id}
                  className="p-3.5 rounded-xl border bg-card hover:bg-muted/30 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {comment.commenter_handle || "@customer"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        · {comment.platform}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        · {new Date(comment.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] font-semibold ${sentimentColors[comment.sentiment] || ""}`}>
                      {comment.sentiment}
                    </Badge>
                  </div>

                  <p className="text-xs text-foreground/90 bg-muted/20 p-2 rounded">
                    "{comment.comment_text}"
                  </p>

                  <div className="flex items-start gap-2 pt-0.5">
                    <span className="text-xs text-primary font-bold">AI:</span>
                    <p className="text-xs text-primary font-medium flex-1">
                      {comment.reply_text}
                    </p>
                    {comment.dm_sent && (
                      <Badge variant="secondary" className="text-[10px] shrink-0 bg-purple-500/10 text-purple-600">
                        📩 DM Sent
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform Expansion Roadmap (as per LEMON AI spec: LinkedIn, YouTube, X) */}
      <Card className="border-dashed border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" /> Expanding Platforms — Coming Soon
          </CardTitle>
          <CardDescription className="text-xs">
            Lemon AI is adding LinkedIn, YouTube, and X automation in the next release cycle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { name: "LinkedIn", icon: "💼", desc: "Company page posts, comment replies, professional DM automation", color: "border-blue-200 dark:border-blue-800" },
              { name: "YouTube", icon: "▶️", desc: "Video comment automation, subscriber engagement & reply management", color: "border-red-200 dark:border-red-800" },
              { name: "X (Twitter)", icon: "✖️", desc: "Thread replies, DM automation, trending hashtag post scheduling", color: "border-slate-200 dark:border-slate-700" },
            ].map((platform) => (
              <div key={platform.name} className={`p-4 rounded-xl border ${platform.color} bg-muted/20 space-y-2 opacity-80`}>
                <div className="flex items-center justify-between">
                  <span className="text-lg">{platform.icon}</span>
                  <Badge variant="outline" className="text-[10px]">Coming Soon</Badge>
                </div>
                <p className="text-sm font-semibold">{platform.name}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{platform.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* DM Auto-Reply Settings */}
      <Card className="border-purple-200/60 dark:border-purple-900/50 bg-purple-50/20 dark:bg-purple-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="size-4 text-purple-500" /> DM Auto-Reply Bot Settings
          </CardTitle>
          <CardDescription className="text-xs">
            Configure your Social DM Bot — automatically qualifies and nurtures prospects who DM your page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
            <div>
              <p className="text-sm font-medium">Auto-Reply on Instagram DMs</p>
              <p className="text-xs text-muted-foreground">Respond to new DMs within 30 seconds using brand-trained AI</p>
            </div>
            <Badge className="bg-emerald-600 text-white text-xs">Active</Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
            <div>
              <p className="text-sm font-medium">Auto-Reply on Facebook Messenger DMs</p>
              <p className="text-xs text-muted-foreground">Qualify leads and collect contact info automatically</p>
            </div>
            <Badge className="bg-emerald-600 text-white text-xs">Active</Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border bg-background opacity-60">
            <div>
              <p className="text-sm font-medium">WhatsApp Business DM Bot</p>
              <p className="text-xs text-muted-foreground">Configured in WhatsApp Bot settings</p>
            </div>
            <Button asChild variant="outline" size="sm" className="text-xs h-7">
              <Link href="/whatsapp-bot">Configure →</Link>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            💡 All captured DM leads are automatically saved to your <Link href="/crm/pipeline" className="text-primary underline">CRM Pipeline</Link> and the <Link href="/crm/inbox" className="text-primary underline">Unified Inbox</Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
