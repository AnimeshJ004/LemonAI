"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Calendar, Clock, Phone, Mail, User, MessageSquare, ArrowRight, Loader2, Sparkles, ChevronDown, IndianRupee, TrendingUp } from "lucide-react";

const TIME_SLOTS = [
  "10:00 AM – 10:30 AM",
  "11:30 AM – 12:00 PM",
  "2:00 PM – 2:30 PM",
  "3:30 PM – 4:00 PM",
  "5:00 PM – 5:30 PM",
  "7:00 PM – 7:30 PM",
];

const BUDGET_RANGES = [
  "Under ₹5,000",
  "₹5,000 – ₹20,000",
  "₹20,000 – ₹50,000",
  "₹50,000 – ₹1,00,000",
  "₹1,00,000+",
];

const TIMELINES = [
  "ASAP (Within a week)",
  "This month",
  "Next 2–3 months",
  "Just exploring options",
];

function LeadFormContent() {
  const params = useSearchParams();
  const type = (params.get("type") || "booking") as "booking" | "pricing";
  const userId = params.get("user") || "";
  const source = params.get("source") || "instagram";
  const prefilledName = params.get("name") || "";

  const [brand, setBrand] = useState<{ business_name?: string; niche?: string; main_offer?: string } | null>(null);
  const [step, setStep] = useState<"form" | "success" | "booking_after_pricing">("form");
  const [loading, setLoading] = useState(false);
  const [brandLoading, setBrandLoading] = useState(true);

  const [form, setForm] = useState({
    name: prefilledName.replace(/^@/, ""),
    email: "",
    phone: "",
    service: "",
    message: "",
    budgetRange: "",
    timeline: "",
    preferredDate: "",
    preferredTimeSlot: "",
  });

  useEffect(() => {
    if (!userId) { setBrandLoading(false); return; }
    fetch(`/api/lead-form/brand?user=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => { if (d?.business_name) setBrand(d); })
      .catch(() => {})
      .finally(() => setBrandLoading(false));
  }, [userId]);

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/lead-form/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, userId, type, source }),
      });
      if (!res.ok) throw new Error("failed");
      setStep(type === "pricing" ? "booking_after_pricing" : "success");
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const brandName = brand?.business_name || "Us";
  const sourceLabel = source === "facebook" ? "Facebook" : "Instagram";
  const isBookingMode = type === "booking";
  const today = new Date().toISOString().split("T")[0];
  const accentColor = isBookingMode ? "#7c3aed" : "#0891b2";
  const accentLight = isBookingMode ? "#a78bfa" : "#22d3ee";

  if (brandLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="animate-spin w-8 h-8 text-[#a78bfa]" />
      </div>
    );
  }

  const inputClasses = "w-full bg-white/5 border border-white/10 focus:border-[#7c3aed] focus:bg-white/10 rounded-xl px-3.5 py-3 text-[16px] sm:text-sm text-white placeholder:text-white/30 outline-none transition-all duration-200 min-h-[44px]";

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative flex items-center justify-center px-4 py-6 sm:py-10 font-sans text-white antialiased overflow-x-hidden">
      {/* Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-purple-600/20 rounded-full blur-[80px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[250px] sm:w-[500px] h-[250px] sm:h-[500px] bg-cyan-600/15 rounded-full blur-[80px]" />
      </div>

      <div className="relative w-full max-w-md mx-auto">
        {/* SUCCESS */}
        {step === "success" && (
          <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/10 rounded-2xl sm:rounded-3xl p-6 sm:p-9 text-center shadow-2xl">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-2">You are all set! 🎉</h2>
            <p className="text-white/60 text-xs sm:text-sm leading-relaxed mb-5">
              Thanks <strong className="text-white">{form.name || "there"}</strong>! The team at{" "}
              <strong style={{ color: accentLight }}>{brandName}</strong> will confirm your appointment shortly.
            </p>
            {(form.preferredDate || form.preferredTimeSlot) && (
              <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 text-left text-xs text-white/50 space-y-1.5">
                {form.preferredDate && <p className="m-0">📅 <span className="text-white/80">{form.preferredDate}</span></p>}
                {form.preferredTimeSlot && <p className="m-0">🕐 <span className="text-white/80">{form.preferredTimeSlot}</span></p>}
              </div>
            )}
          </div>
        )}

        {/* PRICING → BOOK CTA */}
        {step === "booking_after_pricing" && (
          <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/10 rounded-2xl sm:rounded-3xl p-6 sm:p-9 text-center shadow-2xl">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-purple-500/10 border border-purple-500/30 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-2.5">Enquiry received! ✅</h2>
            <p className="text-white/60 text-xs sm:text-sm leading-relaxed mb-6">
              Our team at <strong style={{ color: accentLight }}>{brandName}</strong> will review your requirements and get back to you with a custom quote. Want to fast-track it?
            </p>
            <a href={`/lead-form?type=booking&user=${encodeURIComponent(userId)}&source=${encodeURIComponent(source)}&name=${encodeURIComponent(params.get("name") || "")}`}
              className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold text-sm shadow-lg shadow-purple-600/30 active:scale-[0.98] transition-transform">
              <Calendar className="w-4 h-4" /> Book a Free Consultation <ArrowRight className="w-4 h-4" />
            </a>
            <p className="text-white/30 text-[11px] mt-3">Takes 30 seconds · No obligation</p>
          </div>
        )}

        {/* MAIN FORM */}
        {step === "form" && (
          <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className={`p-5 sm:p-7 border-b border-white/10 ${isBookingMode ? "bg-purple-600/10" : "bg-cyan-600/10"}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3.5 h-3.5" style={{ color: accentLight }} />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider" style={{ color: accentLight }}>
                  {isBookingMode ? "Book Appointment" : "Pricing Inquiry"}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-white mb-1.5 leading-snug">
                {isBookingMode ? `Schedule your free consultation with ${brandName}` : `Get a custom quote from ${brandName}`}
              </h1>
              <p className="text-xs text-white/50 leading-relaxed m-0">
                {isBookingMode ? `You expressed interest on ${sourceLabel}. Let's get you booked! ✨` : `You asked about pricing on ${sourceLabel}. Tell us more so we can craft the perfect plan for you.`}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 sm:p-7 flex flex-col gap-4 sm:gap-5">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-white/40" /> Full Name <span style={{ color: accentLight }}>*</span>
                </label>
                <input type="text" placeholder="Your full name" value={form.name} onChange={(e) => update("name", e.target.value)} required className={inputClasses} />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-white/40" /> Email Address <span style={{ color: accentLight }}>*</span>
                </label>
                <input type="email" placeholder="you@email.com" value={form.email} onChange={(e) => update("email", e.target.value)} required className={inputClasses} />
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-white/40" /> Phone / WhatsApp <span style={{ color: accentLight }}>*</span>
                </label>
                <input type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={(e) => update("phone", e.target.value)} required className={inputClasses} />
              </div>

              {/* Service */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-white/40" /> Service Interested In <span style={{ color: accentLight }}>*</span>
                </label>
                <input type="text" placeholder={brand?.main_offer || "e.g. Social Media Management, Design"} value={form.service} onChange={(e) => update("service", e.target.value)} required className={inputClasses} />
              </div>

              {/* BOOKING-SPECIFIC */}
              {isBookingMode && <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-white/40" /> Preferred Date <span style={{ color: accentLight }}>*</span>
                  </label>
                  <input type="date" min={today} value={form.preferredDate} onChange={(e) => update("preferredDate", e.target.value)} required className={`${inputClasses} [color-scheme:dark]`} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-white/40" /> Preferred Time Slot <span style={{ color: accentLight }}>*</span>
                  </label>
                  <div className="relative">
                    <select value={form.preferredTimeSlot} onChange={(e) => update("preferredTimeSlot", e.target.value)} required className={`${inputClasses} appearance-none pr-10 cursor-pointer`}>
                      <option value="" className="bg-[#12121a]">Select a time slot</option>
                      {TIME_SLOTS.map((s) => <option key={s} value={s} className="bg-[#12121a]">{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                  </div>
                </div>
              </>}

              {/* PRICING-SPECIFIC */}
              {!isBookingMode && <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 text-white/40" /> Budget Range <span style={{ color: accentLight }}>*</span>
                  </label>
                  <div className="relative">
                    <select value={form.budgetRange} onChange={(e) => update("budgetRange", e.target.value)} required className={`${inputClasses} appearance-none pr-10 cursor-pointer`}>
                      <option value="" className="bg-[#12121a]">Select your budget</option>
                      {BUDGET_RANGES.map((r) => <option key={r} value={r} className="bg-[#12121a]">{r}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-white/40" /> Timeline <span style={{ color: accentLight }}>*</span>
                  </label>
                  <div className="relative">
                    <select value={form.timeline} onChange={(e) => update("timeline", e.target.value)} required className={`${inputClasses} appearance-none pr-10 cursor-pointer`}>
                      <option value="" className="bg-[#12121a]">When do you need this?</option>
                      {TIMELINES.map((t) => <option key={t} value={t} className="bg-[#12121a]">{t}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                  </div>
                </div>
              </>}

              {/* Message */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-white/40" /> {isBookingMode ? "What would you like to discuss?" : "Your requirements"} <span className="text-white/30 font-normal">(optional)</span>
                </label>
                <textarea placeholder={isBookingMode ? "Topics or questions you'd like to cover..." : "Describe your project goals or specific requirements..."} value={form.message} onChange={(e) => update("message", e.target.value)} rows={3} className={`${inputClasses} resize-none h-auto`} />
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading} className={`mt-1 w-full min-h-[48px] py-3.5 px-4 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 border-none transition-all duration-200 active:scale-[0.98] ${loading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${isBookingMode ? "bg-gradient-to-r from-purple-600 to-purple-700 shadow-lg shadow-purple-600/40" : "bg-gradient-to-r from-cyan-600 to-blue-600 shadow-lg shadow-cyan-600/40"}`}>
                {loading ? <><Loader2 className="animate-spin w-4 h-4" /> Submitting...</> : isBookingMode ? <><Calendar className="w-4 h-4" /> Confirm Appointment <ArrowRight className="w-4 h-4" /></> : <><TrendingUp className="w-4 h-4" /> Submit Enquiry <ArrowRight className="w-4 h-4" /></>}
              </button>

              <p className="text-center text-white/30 text-[11px] mt-1 m-0">
                🔒 Your info is private and only shared with {brandName}
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeadFormPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="animate-spin w-8 h-8 text-[#a78bfa]" />
      </div>
    }>
      <LeadFormContent />
    </Suspense>
  );
}