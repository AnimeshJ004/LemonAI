"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Building2,
  Target,
  Megaphone,
  Briefcase,
  Users,
  Compass,
  Film,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── 8 Universal Questions for Any Creator, Business, Agency, or Brand ──────────

export interface OnboardingQuestion {
  id:
    | "business_name"
    | "profile_type"
    | "niche"
    | "target_audience"
    | "brand_tone"
    | "main_offer"
    | "competitors"
    | "preferred_formats";
  title: string;
  subtitle: string;
  placeholder?: string;
  hint: string;
  type: "text" | "textarea" | "options";
  options?: string[];
  required?: boolean;
  icon: React.ElementType;
}

const QUESTIONS: OnboardingQuestion[] = [
  {
    id: "business_name",
    title: "What is your Brand, Channel, Business, or Name?",
    subtitle: "The public name or handle Lemon AI will represent across all posts, captions, and signatures.",
    placeholder: "e.g. Aura Wellness, Apex Media, Lumina Labs, Nova Skincare, Peak Athletics...",
    hint: "Used in signatures, brand hashtags, creator credits, and post mentions",
    type: "text",
    required: true,
    icon: Building2,
  },
  {
    id: "profile_type",
    title: "Who are you creating content for?",
    subtitle: "Select your profile type so Lemon AI adapts the content strategy, voice, and conversion hooks.",
    hint: "Tailors AI between creator storytelling, local foot-traffic, or business conversions",
    type: "options",
    options: [
      "🏬 Local Business & Store / Clinic (Gym, Dental, Salon, Cafe)",
      "🎥 Content Creator / YouTuber / Influencer",
      "🛍️ E-commerce & D2C Brand / Product",
      "🚀 Company / Startup / B2B Services",
      "💼 Agency, Freelancer & Consultant",
      "👤 Personal Brand, Coach & Educator",
    ],
    required: true,
    icon: Users,
  },
  {
    id: "niche",
    title: "What is your niche, industry, or main topic?",
    subtitle: "What do you do or talk about? AI will discover viral trends and competitor secrets in this space.",
    placeholder: "e.g. Cosmetic Dentistry, High-Ticket Fitness, AI Tools & Tech, Luxury Real Estate, Streetwear Fashion...",
    hint: "AI identifies winning trends, viral hooks, and high-engagement topics for this industry",
    type: "text",
    required: true,
    icon: Compass,
  },
  {
    id: "target_audience",
    title: "Who is your ideal customer, viewer, or audience?",
    subtitle: "Describe who you want to reach (demographics, daily struggles, desires).",
    placeholder: "e.g. Local residents wanting teeth whitening, Gen-Z tech enthusiasts, busy corporate executives aged 30-50...",
    hint: "AI tunes copy to trigger pain points, curiosity, and high engagement for this audience",
    type: "textarea",
    required: true,
    icon: Target,
  },
  {
    id: "brand_tone",
    title: "What is your content tone & voice style?",
    subtitle: "How should your posts sound when people read, watch, or listen to them?",
    hint: "Determines vocabulary, pacing, emoji usage, and presentation style in your scripts and captions",
    type: "options",
    options: [
      "⚡ High-Energy & Engaging (Fast-paced, exciting, hook-driven)",
      "💡 Educational & Actionable (Step-by-step, insightful)",
      "🎯 Bold & Contrarian (Direct, thought-provoking, authority)",
      "🤗 Friendly & Relatable (Conversational, storytelling)",
      "👔 Professional & Polished (Corporate, credible, standard)",
      "🎭 Humorous & Witty (Entertaining, memes, clever)",
      "💎 Luxury & Sophisticated (Aspirational, minimal, premium)",
    ],
    required: true,
    icon: Megaphone,
  },
  {
    id: "main_offer",
    title: "What is your primary goal or main offer?",
    subtitle: "What action should people take after seeing your posts?",
    placeholder: "e.g. Book an appointment/consultation, Subscribe to YouTube, Buy product on website, DM for pricing...",
    hint: "AI creates high-converting call-to-actions (CTAs) and natural offers",
    type: "textarea",
    required: true,
    icon: Briefcase,
  },
  {
    id: "competitors",
    title: "Benchmark accounts, creators, or competitors?",
    subtitle: "Handles (@username), YouTube links, or websites. (Optional - if left blank, AI auto-discovers market leaders!)",
    placeholder: "e.g. @competitor_brand, youtube.com/@creator, competitor.com (or leave blank for auto-discovery)",
    hint: "AI reverse-engineers their winning hooks and exploits gaps in their strategy",
    type: "textarea",
    required: false,
    icon: Sparkles,
  },
  {
    id: "preferred_formats",
    title: "What formats & post types do you want to create?",
    subtitle: "Choose the types of content Lemon AI should generate for your social channels.",
    hint: "AI synthesizes multi-channel assets based on your format selection",
    type: "options",
    options: [
      "🌟 All-in-One Balanced Mix (Reels, Carousels & Posts)",
      "🎬 Vertical Video (Reels & YouTube Shorts with scripts)",
      "📑 Educational Carousels (Multi-slide breakdowns)",
      "📸 Single Image & Feed Posts (Graphic + Captions)",
      "⚡ High-Reach Text & Threads (X / LinkedIn style)",
    ],
    required: true,
    icon: Film,
  },
];

export default function OnboardingWizard() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({
    business_name: "",
    profile_type: "🚀 Company / Startup / B2B Services",
    niche: "",
    target_audience: "",
    brand_tone: "⚡ High-Energy & Engaging (Fast-paced, exciting, hook-driven)",
    main_offer: "",
    competitors: "",
    preferred_formats: "🌟 All-in-One Balanced Mix (Reels, Carousels & Posts)",
  });
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const currentQuestion = QUESTIONS[currentIndex];
  const isLastQuestion = currentIndex === QUESTIONS.length - 1;
  const progress = Math.round(((currentIndex + 1) / QUESTIONS.length) * 100);

  // Sync input value with stored answers when navigating questions
  useEffect(() => {
    setInputValue(answers[currentQuestion.id] || "");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
  }, [currentIndex, currentQuestion.id]);

  const handleNext = async () => {
    const trimmed = inputValue.trim();

    if (currentQuestion.required && !trimmed) {
      toast.error("Please provide an answer before continuing");
      return;
    }

    const newAnswers = { ...answers, [currentQuestion.id]: trimmed };
    setAnswers(newAnswers);

    if (isLastQuestion) {
      await handleSubmit(newAnswers);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      // Save current input before moving back
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: inputValue.trim() }));
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSkip = async () => {
    if (currentQuestion.required) return;

    const newAnswers = { ...answers, [currentQuestion.id]: "" };
    setAnswers(newAnswers);

    if (isLastQuestion) {
      await handleSubmit(newAnswers);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && currentQuestion.type !== "textarea") {
      e.preventDefault();
      handleNext();
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleNext();
    }
  };

  const handleSubmit = async (finalAnswers: Record<string, string>) => {
    setIsSubmitting(true);
    try {
      const payload = {
        business_name: finalAnswers.business_name || "My Brand",
        profile_type: finalAnswers.profile_type || "Business",
        niche: finalAnswers.niche || "",
        target_audience: finalAnswers.target_audience || "",
        brand_tone: finalAnswers.brand_tone || "High-Energy & Engaging",
        main_offer: finalAnswers.main_offer || "",
        competitors: finalAnswers.competitors || "",
        preferred_formats: finalAnswers.preferred_formats || "All-in-One Balanced Mix",
      };

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save profile");
      }

      setIsComplete(true);

      // Smooth redirection into dedicated Viral Review & Approval Studio
      setTimeout(() => {
        window.location.href = "/onboarding/review";
      }, 1500);
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  // ─── Celebration Screen ───────────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md animate-in fade-in zoom-in-95 duration-500 bg-white p-8 sm:p-10 rounded-3xl border border-zinc-200/80 shadow-xl shadow-zinc-900/5">
          <div className="relative mx-auto size-20">
            <div className="size-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Check className="size-10 text-white stroke-[3]" />
            </div>
            <div className="absolute inset-0 rounded-full bg-amber-400/20 scale-125 animate-ping pointer-events-none" />
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-zinc-900">Setup Complete!</h2>
            <p className="text-zinc-600 text-sm leading-relaxed">
              Lemon AI is now launching the autonomous market research agent and crafting your viral content preview…
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-zinc-500 text-xs font-medium pt-2">
            <Loader2 className="size-4 animate-spin text-amber-500" />
            <span>Loading Viral Content Review Studio…</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Onboarding Interface ────────────────────────────────────────────
  const CurrentIcon = currentQuestion.icon;

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col lg:flex-row text-zinc-900 font-sans">
      {/* ── Left Sidebar: Profile Summary & Progress ── */}
      <aside className="hidden lg:flex flex-col w-80 xl:w-92 border-r border-zinc-200/80 bg-white p-8 shrink-0">
        {/* Lemon AI Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="size-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20">
            <Sparkles className="size-4 text-white" />
          </div>
          <span className="text-zinc-900 font-bold text-xl tracking-tight">Lemon AI</span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2.5 mb-6">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-zinc-500">Universal Strategy Setup</span>
            <span className="text-amber-600 font-bold">{progress}%</span>
          </div>
          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden p-0.5 border border-zinc-200/60">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-zinc-500 text-xs">
            Step <span className="font-semibold text-zinc-800">{currentIndex + 1}</span> of{" "}
            <span className="font-semibold text-zinc-800">{QUESTIONS.length}</span>
          </p>
        </div>

        {/* Live Answers Summary */}
        <div className="flex-1 space-y-2.5 overflow-y-auto pr-1 scrollbar-none">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Your Brand DNA
          </p>
          {QUESTIONS.map((q, idx) => {
            const val = answers[q.id];
            const isCurrent = idx === currentIndex;
            const isDone = Boolean(val && val.trim());

            return (
              <div
                key={q.id}
                onClick={() => setCurrentIndex(idx)}
                className={cn(
                  "p-2.5 rounded-xl border text-xs transition-all cursor-pointer",
                  isCurrent
                    ? "border-amber-500/60 bg-amber-50/50 shadow-sm"
                    : isDone
                    ? "border-zinc-200 bg-zinc-50/80 hover:bg-zinc-100/70"
                    : "border-dashed border-zinc-200 bg-transparent text-zinc-400"
                )}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-semibold text-zinc-700 truncate max-w-[170px]">{q.title}</span>
                  {isDone && <Check className="size-3.5 text-emerald-600 shrink-0" />}
                </div>
                <p className="text-zinc-600 line-clamp-1">
                  {val && val.trim() ? val : "Pending..."}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center gap-2 text-zinc-500 text-xs">
          <Sparkles className="size-3.5 text-amber-500 shrink-0" />
          <span>Autonomous viral trend extraction active</span>
        </div>
      </aside>

      {/* ── Main Question Panel ── */}
      <main className="flex-1 flex flex-col justify-between p-6 sm:p-12 max-w-3xl mx-auto w-full">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between mb-8 pb-4 border-b border-zinc-200">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Sparkles className="size-3.5 text-white" />
            </div>
            <span className="text-zinc-900 font-bold">Lemon AI</span>
          </div>
          <span className="text-xs font-semibold text-zinc-500">
            {currentIndex + 1} / {QUESTIONS.length}
          </span>
        </div>

        {/* Question Content Area */}
        <div className="space-y-6 my-auto">
          {/* Badge & Step Indicator */}
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
              <CurrentIcon className="size-3 text-amber-700" />
              Question {currentIndex + 1} of {QUESTIONS.length}
            </span>
            {currentQuestion.required ? (
              <span className="text-xs text-rose-500 font-medium">* Required</span>
            ) : (
              <span className="text-xs text-zinc-400 font-medium">Optional (AI auto-discovers if empty)</span>
            )}
          </div>

          {/* Question Title & Subtitle */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-zinc-900 tracking-tight leading-tight">
              {currentQuestion.title}
            </h1>
            <p className="text-zinc-600 text-sm sm:text-base leading-relaxed">
              {currentQuestion.subtitle}
            </p>
          </div>

          {/* Options List (for Profile Type, Tone, Formats) */}
          {currentQuestion.type === "options" && currentQuestion.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              {currentQuestion.options.map((option) => {
                const isSelected = inputValue === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setInputValue(option);
                      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option }));
                    }}
                    className={cn(
                      "p-3.5 rounded-xl border text-left font-medium text-xs sm:text-sm transition-all flex items-center justify-between",
                      isSelected
                        ? "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/20 font-semibold"
                        : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 text-zinc-800"
                    )}
                  >
                    <span>{option}</span>
                    {isSelected && <Check className="size-4 text-white shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Input Box for text / textarea */}
          {currentQuestion.type !== "options" && (
            <div className="pt-2">
              {currentQuestion.type === "textarea" ? (
                <textarea
                  ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                  rows={4}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={currentQuestion.placeholder}
                  className={cn(
                    "w-full rounded-2xl border-2 border-zinc-200 bg-white p-4 text-zinc-900 placeholder:text-zinc-400",
                    "text-base outline-none transition-all resize-none shadow-sm",
                    "focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                  )}
                />
              ) : (
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={currentQuestion.placeholder}
                  className={cn(
                    "w-full rounded-2xl border-2 border-zinc-200 bg-white p-4 text-zinc-900 placeholder:text-zinc-400",
                    "text-base outline-none transition-all shadow-sm",
                    "focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                  )}
                />
              )}
              <div className="flex items-center justify-between mt-2 text-xs text-zinc-400 px-1">
                <span>
                  Press <kbd className="font-semibold text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">Enter ↵</kbd> to continue
                </span>
                {currentQuestion.type === "textarea" && (
                  <span>
                    Use <kbd className="font-semibold text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">⌘+Enter</kbd> to submit
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Toolbar */}
        <div className="pt-8 border-t border-zinc-200/80 flex items-center justify-between gap-4 mt-8">
          <div>
            {currentIndex > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={isSubmitting}
                className="rounded-xl border-zinc-200 text-zinc-700 hover:bg-zinc-100 gap-1.5 text-xs font-semibold h-11 px-4"
              >
                <ArrowLeft className="size-3.5" />
                Back
              </Button>
            ) : (
              <div />
            )}
          </div>

          <div className="flex items-center gap-3">
            {!currentQuestion.required && (
              <button
                type="button"
                onClick={handleSkip}
                disabled={isSubmitting}
                className="text-xs text-zinc-500 hover:text-zinc-800 font-medium px-2 py-1 transition-colors"
              >
                Auto-Discover (Skip)
              </button>
            )}

            <Button
              type="button"
              onClick={handleNext}
              disabled={isSubmitting || (currentQuestion.required && !inputValue.trim())}
              className={cn(
                "rounded-xl h-11 px-6 text-sm font-bold gap-2 shadow-md",
                "bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-zinc-950",
                "shadow-amber-500/20 transition-all duration-200",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving & Launching AI…
                </>
              ) : isLastQuestion ? (
                <>
                  Generate Viral Content Preview
                  <Sparkles className="size-4 fill-current" />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
