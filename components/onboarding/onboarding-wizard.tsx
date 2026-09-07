"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  ArrowRight,
  Check,
  Loader2,
  ChevronRight,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Static Core Questions ────────────────────────────────────────────────────

interface Question {
  id: string;
  question: string;
  placeholder: string;
  hint: string;
  type: "text" | "textarea";
  required?: boolean;
}

const CORE_QUESTIONS: Question[] = [
  {
    id: "company_description",
    question: "What does your company do?",
    placeholder: "e.g. We help small businesses automate their social media marketing with AI",
    hint: "This becomes the foundation of your brand's AI voice",
    type: "textarea",
    required: true,
  },
  {
    id: "products_services",
    question: "What products or services do you offer?",
    placeholder: "e.g. Social media scheduling, AI content generation, analytics dashboard",
    hint: "We'll generate content that highlights these specific offerings",
    type: "textarea",
    required: true,
  },
  {
    id: "target_customers",
    question: "Who are your target customers?",
    placeholder: "e.g. Small business owners aged 25-45, e-commerce brands, local service providers",
    hint: "The AI will write in a voice that speaks directly to these people",
    type: "textarea",
    required: true,
  },
  {
    id: "industry",
    question: "Which industry or market do you operate in?",
    placeholder: "e.g. SaaS, Health & Wellness, Real Estate, E-commerce, Finance",
    hint: "Lets the AI use the right industry-specific language and trends",
    type: "text",
    required: true,
  },
  {
    id: "differentiators",
    question: "What makes your company different from competitors?",
    placeholder: "e.g. We use AI to cut content creation time by 90%, with no contracts",
    hint: "This becomes your unique selling point in every AI-generated post",
    type: "textarea",
  },
  {
    id: "business_goals",
    question: "What are your main business goals?",
    placeholder: "e.g. Increase brand awareness, generate leads, drive traffic to our website",
    hint: "Every piece of content will be aligned to move you toward these goals",
    type: "textarea",
  },
  {
    id: "markets_locations",
    question: "Which markets or locations do you currently serve?",
    placeholder: "e.g. United States, Canada, Southeast Asia, or Global",
    hint: "Helps the AI localize content and reference relevant trends",
    type: "text",
  },
  {
    id: "expansion_plans",
    question: "Are you planning to expand into new markets?",
    placeholder: "e.g. We plan to launch in Europe by Q2 2025, or No expansion plans yet",
    hint: "We can craft forward-looking content that primes your audience for growth",
    type: "textarea",
  },
];

const MAX_AI_FOLLOWUPS = 3;

// ─── Map onboarding answers → brand_profiles fields ───────────────────────────

function mapAnswersToBrandProfile(answers: Record<string, string>) {
  const {
    company_description = "",
    products_services = "",
    target_customers = "",
    industry = "",
    differentiators = "",
    business_goals = "",
    markets_locations = "",
    expansion_plans = "",
    ...aiAnswers
  } = answers;

  // Extract business name heuristic: first few words from company description
  const descWords = company_description.trim().split(/\s+/);
  const businessName =
    descWords.length <= 5
      ? company_description.trim()
      : descWords.slice(0, 4).join(" ");

  const niche = [industry, products_services]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 300);

  const targetAudience = [target_customers, markets_locations]
    .filter(Boolean)
    .join(". ")
    .slice(0, 500);

  const mainOffer = [differentiators, business_goals]
    .filter(Boolean)
    .join(". ")
    .slice(0, 400);

  // Stash expansion plans + any AI follow-up answers as competitors field
  const extraContext = [
    expansion_plans ? `Expansion: ${expansion_plans}` : "",
    ...Object.entries(aiAnswers).map(([k, v]) => `${k}: ${v}`),
  ]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 400);

  return {
    business_name: businessName || "My Business",
    niche,
    target_audience: targetAudience,
    brand_tone: "Professional",
    main_offer: mainOffer,
    competitors: extraContext || null,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const router = useRouter();
  const { user } = useUser();

  // Questions array (static + AI-generated follow-ups)
  const [questions, setQuestions] = useState<Question[]>(CORE_QUESTIONS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isLoadingFollowUp, setIsLoadingFollowUp] = useState(false);
  const [aiFollowUpCount, setAiFollowUpCount] = useState(0);
  const [displayedQuestion, setDisplayedQuestion] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [entered, setEntered] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const progress = Math.round((currentIndex / Math.max(totalQuestions, 1)) * 100);

  // Animate question text typing effect
  useEffect(() => {
    if (!currentQuestion) return;
    setDisplayedQuestion("");
    setIsTyping(true);
    setEntered(false);

    const text = currentQuestion.question;
    let i = 0;
    const interval = setInterval(() => {
      if (i <= text.length) {
        setDisplayedQuestion(text.slice(0, i));
        i++;
      } else {
        setIsTyping(false);
        setEntered(true);
        clearInterval(interval);
      }
    }, 22);

    return () => clearInterval(interval);
  }, [currentIndex, currentQuestion?.question]);

  // Auto-focus input after typing animation
  useEffect(() => {
    if (!isTyping && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isTyping]);

  // Fetch an AI-generated follow-up question
  const fetchAIFollowUp = useCallback(async (currentAnswers: Record<string, string>) => {
    if (aiFollowUpCount >= MAX_AI_FOLLOWUPS) return;

    setIsLoadingFollowUp(true);
    try {
      const res = await fetch("/api/onboarding/generate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIndex: aiFollowUpCount,
          answers: currentAnswers,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.question) {
          const newQ: Question = {
            id: `ai_followup_${aiFollowUpCount}`,
            question: data.question,
            placeholder: data.placeholder || "Type your answer...",
            hint: data.hint || "The AI will use this to personalize your content",
            type: "textarea",
          };
          setQuestions((prev) => [...prev, newQ]);
          setAiFollowUpCount((c) => c + 1);
        }
      }
    } catch {
      // Silent fail — AI follow-ups are optional
    } finally {
      setIsLoadingFollowUp(false);
    }
  }, [aiFollowUpCount]);

  const handleNext = async () => {
    const trimmed = inputValue.trim();

    // Validate required fields
    if (currentQuestion?.required && !trimmed) {
      toast.error("Please answer this question before continuing");
      return;
    }

    // Save the answer
    const newAnswers = { ...answers, [currentQuestion.id]: trimmed };
    setAnswers(newAnswers);

    // After question 4 (index 3), fetch an AI follow-up question asynchronously
    // so it's ready when the user gets to the end
    if (currentIndex === 3 && aiFollowUpCount === 0) {
      fetchAIFollowUp(newAnswers);
    }
    if (currentIndex === 6 && aiFollowUpCount === 1) {
      fetchAIFollowUp(newAnswers);
    }

    if (isLastQuestion) {
      // Submit the form
      await handleSubmit(newAnswers);
    } else {
      // Move to next question with slide animation
      setInputValue(answers[questions[currentIndex + 1]?.id] || "");
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleSubmit = async (finalAnswers: Record<string, string>) => {
    setIsSubmitting(true);
    try {
      const brandPayload = mapAnswersToBrandProfile(finalAnswers);

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brandPayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save your profile");
      }

      setIsComplete(true);

      // Redirect to dashboard after 2.5s celebration
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 2500);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && currentQuestion?.type !== "textarea") {
      e.preventDefault();
      handleNext();
    }
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      handleNext();
    }
  };

  const handleSkip = () => {
    if (currentQuestion?.required) return;
    const newAnswers = { ...answers, [currentQuestion.id]: "" };
    setAnswers(newAnswers);
    if (isLastQuestion) {
      handleSubmit(newAnswers);
    } else {
      setInputValue(answers[questions[currentIndex + 1]?.id] || "");
      setCurrentIndex((i) => i + 1);
    }
  };

  // ─── Completion Screen ───────────────────────────────────────────────────

  if (isComplete) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
          <div className="relative mx-auto size-24">
            <div className="size-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-yellow-500/30 animate-pulse">
              <Check className="size-12 text-white stroke-[2.5]" />
            </div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400/20 to-orange-500/20 scale-150 animate-ping" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-white">You&apos;re all set! 🍋</h2>
            <p className="text-zinc-400 text-base max-w-sm mx-auto">
              Your brand profile is saved. Taking you to your dashboard…
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm">
            <Loader2 className="size-4 animate-spin" />
            <span>Loading dashboard</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Wizard UI ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col lg:flex-row overflow-hidden">

      {/* ── LEFT PANEL: Progress & Answers ── */}
      <aside className="hidden lg:flex flex-col w-72 xl:w-80 border-r border-white/5 bg-white/[0.02] p-8 shrink-0">

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10">
          <div className="size-8 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <Sparkles className="size-4 text-white" />
          </div>
          <span className="text-white font-bold text-lg">Lemon AI</span>
        </div>

        {/* Progress */}
        <div className="space-y-3 mb-8">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium">Profile Setup</span>
            <span className="text-yellow-400 font-bold">{progress}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-zinc-500 text-xs">
            Question {currentIndex + 1} of {totalQuestions}
            {isLoadingFollowUp && (
              <span className="ml-2 text-yellow-400/70 animate-pulse">• AI generating next…</span>
            )}
          </p>
        </div>

        {/* Completed Answers */}
        <div className="flex-1 space-y-3 overflow-y-auto scrollbar-none pr-1">
          {Object.entries(answers)
            .filter(([, v]) => v?.trim())
            .map(([key, value]) => {
              const q = questions.find((q) => q.id === key);
              return (
                <div
                  key={key}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/5 animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-1">
                    {q?.question.slice(0, 40) || key}
                  </p>
                  <p className="text-zinc-300 text-xs line-clamp-2">{value}</p>
                </div>
              );
            })}
        </div>

        {/* Bottom badge */}
        <div className="mt-8 flex items-center gap-2 text-zinc-600 text-xs">
          <Brain className="size-3.5" />
          <span>Powered by Gemini AI</span>
        </div>
      </aside>

      {/* ── RIGHT PANEL: Active Question ── */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative">

        {/* Mobile header */}
        <div className="lg:hidden absolute top-6 left-6 flex items-center gap-2">
          <div className="size-7 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
            <Sparkles className="size-3.5 text-white" />
          </div>
          <span className="text-white font-bold">Lemon AI</span>
        </div>

        {/* Mobile progress */}
        <div className="lg:hidden absolute top-6 right-6 text-xs text-zinc-400">
          {currentIndex + 1}/{totalQuestions}
        </div>

        {/* Glow orbs (decorative) */}
        <div className="absolute top-1/4 -left-32 size-64 rounded-full bg-yellow-500/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -right-32 size-64 rounded-full bg-orange-500/5 blur-3xl pointer-events-none" />

        <div className="w-full max-w-xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* AI badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-semibold">
              <Sparkles className="size-3" />
              AI Interview
            </div>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          {/* Question */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-snug min-h-[4rem]">
              {displayedQuestion}
              {isTyping && (
                <span className="inline-block ml-0.5 w-0.5 h-7 bg-yellow-400 align-middle animate-pulse" />
              )}
            </h1>
            {!isTyping && currentQuestion?.hint && (
              <p className="text-zinc-500 text-sm animate-in fade-in duration-300">
                <span className="text-yellow-400/70 mr-1">✦</span>
                {currentQuestion.hint}
              </p>
            )}
          </div>

          {/* Input */}
          {!isTyping && (
            <div
              className={cn(
                "group rounded-2xl border bg-white/[0.03] transition-all duration-300",
                "border-white/10 focus-within:border-yellow-500/40 focus-within:bg-white/[0.05]",
                "focus-within:shadow-[0_0_0_3px_rgba(234,179,8,0.07)]",
                "animate-in fade-in slide-in-from-bottom-2 duration-300"
              )}
            >
              {currentQuestion?.type === "textarea" ? (
                <textarea
                  ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                  id="onboarding-answer"
                  rows={3}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={currentQuestion?.placeholder}
                  className={cn(
                    "w-full bg-transparent p-4 text-white placeholder-zinc-600",
                    "text-base resize-none outline-none rounded-2xl",
                    "scrollbar-none"
                  )}
                />
              ) : (
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  id="onboarding-answer"
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={currentQuestion?.placeholder}
                  className={cn(
                    "w-full bg-transparent p-4 text-white placeholder-zinc-600",
                    "text-base outline-none rounded-2xl"
                  )}
                />
              )}
              {currentQuestion?.type === "textarea" && (
                <div className="flex items-center justify-end px-4 pb-2 text-zinc-600 text-xs">
                  ⌘↵ to continue
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          {!isTyping && (
            <div
              className="flex items-center gap-3 animate-in fade-in duration-300"
            >
              <Button
                id="onboarding-next-btn"
                onClick={handleNext}
                disabled={isSubmitting || (!inputValue.trim() && currentQuestion?.required)}
                className={cn(
                  "h-12 px-6 font-bold text-sm rounded-xl gap-2",
                  "bg-gradient-to-r from-yellow-400 to-orange-500",
                  "hover:from-yellow-300 hover:to-orange-400",
                  "text-black shadow-lg shadow-yellow-500/20",
                  "transition-all duration-200",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving your profile…
                  </>
                ) : isLastQuestion ? (
                  <>
                    <Sparkles className="size-4" />
                    Complete Setup
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

              {!currentQuestion?.required && !isLastQuestion && (
                <button
                  id="onboarding-skip-btn"
                  type="button"
                  onClick={handleSkip}
                  className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                >
                  Skip this one →
                </button>
              )}
            </div>
          )}

          {/* Step dots (mobile) */}
          <div className="lg:hidden flex items-center gap-1.5 flex-wrap pt-2">
            {questions.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-full transition-all duration-300",
                  i < currentIndex
                    ? "size-1.5 bg-yellow-400"
                    : i === currentIndex
                    ? "h-1.5 w-4 bg-yellow-400"
                    : "size-1.5 bg-white/10"
                )}
              />
            ))}
            {isLoadingFollowUp && (
              <div className="size-1.5 rounded-full bg-yellow-400/30 animate-pulse" />
            )}
          </div>
        </div>

        {/* Completed answers visible on mobile in a bottom drawer-ish way */}
        {currentIndex > 0 && (
          <div className="lg:hidden mt-10 w-full max-w-xl">
            <details className="group">
              <summary className="flex items-center gap-2 text-zinc-600 text-xs cursor-pointer select-none">
                <ChevronRight className="size-3.5 group-open:rotate-90 transition-transform" />
                {Object.keys(answers).length} answer{Object.keys(answers).length !== 1 ? "s" : ""} saved
              </summary>
              <div className="mt-3 space-y-2">
                {Object.entries(answers)
                  .filter(([, v]) => v?.trim())
                  .slice(-3)
                  .map(([key, value]) => {
                    const q = questions.find((q) => q.id === key);
                    return (
                      <div key={key} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                        <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-0.5">
                          {q?.question.slice(0, 35) || key}
                        </p>
                        <p className="text-zinc-400 text-xs line-clamp-1">{value}</p>
                      </div>
                    );
                  })}
              </div>
            </details>
          </div>
        )}
      </main>
    </div>
  );
}
