"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Calendar, Clock, Phone, Mail, User, MessageSquare, ArrowRight, Loader2, Sparkles, ChevronDown, IndianRupee, TrendingUp, Star, Package as PackageIcon } from "lucide-react";

interface PricingPackage {
  id: string;
  name: string;
  price_display: string;
  price_amount: number | null;
  currency: string;
  billing_period: string | null;
  features: string[];
  cta_label: string | null;
  is_featured: boolean;
  display_order: number;
}

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
  const prefilledService = params.get("service") || "";

  const [brand, setBrand] = useState<{ business_name?: string; niche?: string; main_offer?: string } | null>(null);
  const [step, setStep] = useState<"form" | "success" | "booking_after_pricing">("form");
  const [loading, setLoading] = useState(false);
  // Initialize brand-loading as true only when we actually intend to fetch (userId present).
  // This avoids an in-effect `setBrandLoading(false)` shortcut that ESLint flags.
  const [brandLoading, setBrandLoading] = useState<boolean>(Boolean(userId));

  const [packages, setPackages] = useState<PricingPackage[]>([]);

  const [form, setForm] = useState({
    name: prefilledName.replace(/^@/, ""),
    email: "",
    phone: "",
    service: prefilledService,
    message: "",
    budgetRange: "",
    timeline: "",
    preferredDate: "",
    preferredTimeSlot: "",
    selectedPackageId: "",
  });

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/lead-form/brand?user=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => { if (d?.business_name) setBrand(d); })
      .catch(() => {})
      .finally(() => setBrandLoading(false));
  }, [userId]);

  // Load pricing packages when the form is in pricing mode. Loaded once so the
  // post-submit view can render them without an extra fetch.
  useEffect(() => {
    if (!userId || type !== "pricing") return;
    fetch(`/api/lead-form/pricing?user=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.packages)) setPackages(d.packages);
      })
      .catch(() => {});
  }, [userId, type]);

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

  if (brandLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f5fb]">
        <Loader2 className="animate-spin w-8 h-8 text-[#7c3aed]" />
      </div>
    );
  }

  const inputClasses = "w-full bg-white border border-slate-200 focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/15 rounded-xl px-3.5 py-3 text-[16px] sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 min-h-[44px] shadow-sm";

  return (
    <div className="min-h-screen bg-[#f4f5fb] relative flex items-center justify-center px-4 py-6 sm:py-10 font-sans text-slate-900 antialiased overflow-x-hidden">
      {/* Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-purple-400/20 rounded-full blur-[80px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[250px] sm:w-[500px] h-[250px] sm:h-[500px] bg-cyan-400/20 rounded-full blur-[80px]" />
      </div>

      <div className="relative w-full max-w-md mx-auto">
        {/* SUCCESS */}
        {step === "success" && (
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-6 sm:p-9 text-center shadow-xl shadow-slate-200/60">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-500" />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-2">You are all set! 🎉</h2>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed mb-5">
              Thanks <strong className="text-slate-900">{form.name || "there"}</strong>! The team at{" "}
              <strong style={{ color: accentColor }}>{brandName}</strong> will confirm your appointment shortly.
            </p>
            {(form.preferredDate || form.preferredTimeSlot) && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs text-slate-500 space-y-1.5">
                {form.preferredDate && <p className="m-0">📅 <span className="text-slate-800">{form.preferredDate}</span></p>}
                {form.preferredTimeSlot && <p className="m-0">🕐 <span className="text-slate-800">{form.preferredTimeSlot}</span></p>}
              </div>
            )}
          </div>
        )}

        {/* PRICING → PACKAGES + BOOK CTA */}
        {step === "booking_after_pricing" && (
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60">
            <div className="text-center mb-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-purple-50 border border-purple-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-purple-500" />
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-2">Enquiry received! ✅</h2>
              <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                Thanks <strong className="text-slate-900">{form.name || "there"}</strong>! Here&apos;s how{" "}
                <strong style={{ color: accentColor }}>{brandName}</strong> can help.
              </p>
            </div>

            {packages.length > 0 ? (
              <>
                <div className="mb-3 flex items-center gap-1.5">
                  <PackageIcon className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>
                    Our Packages
                  </span>
                </div>
                <div className="space-y-3">
                  {packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className={`relative rounded-2xl border p-4 sm:p-5 transition-colors ${
                        pkg.is_featured
                          ? "border-purple-300 bg-gradient-to-br from-purple-50 to-cyan-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      {pkg.is_featured && (
                        <div className="absolute -top-2.5 right-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-lg">
                          <Star className="w-2.5 h-2.5" fill="currentColor" /> Recommended
                        </div>
                      )}
                      <div className="flex items-baseline justify-between gap-3 mb-2">
                        <h3 className="text-base sm:text-lg font-extrabold text-slate-900">{pkg.name}</h3>
                        <div className="text-right">
                          <div className="text-lg sm:text-xl font-black text-slate-900 leading-none">
                            {pkg.price_display}
                          </div>
                          {pkg.billing_period && !pkg.price_display.toLowerCase().includes(pkg.billing_period.toLowerCase()) && (
                            <div className="text-[10px] text-slate-400 mt-0.5">per {pkg.billing_period}</div>
                          )}
                        </div>
                      </div>
                      {pkg.features.length > 0 && (
                        <ul className="space-y-1.5 mb-3">
                          {pkg.features.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs sm:text-[13px] text-slate-600">
                              <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: accentColor }} />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <a
                        href={`/lead-form?type=booking&user=${encodeURIComponent(userId)}&source=${encodeURIComponent(source)}&name=${encodeURIComponent(params.get("name") || "")}&service=${encodeURIComponent(pkg.name)}`}
                        className={`w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-semibold text-xs sm:text-sm transition-transform active:scale-[0.98] ${
                          pkg.is_featured
                            ? "text-white bg-gradient-to-r from-purple-600 to-cyan-500 shadow-md shadow-purple-600/30"
                            : "text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        {pkg.cta_label || "Book this package"}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-5 border-t border-slate-200 text-center">
                  <p className="text-slate-500 text-[11px] sm:text-xs mb-3">
                    Not sure which one fits? Talk to us — it&apos;s free.
                  </p>
                  <a
                    href={`/lead-form?type=booking&user=${encodeURIComponent(userId)}&source=${encodeURIComponent(source)}&name=${encodeURIComponent(params.get("name") || "")}`}
                    className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium text-xs hover:bg-slate-100 transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5" /> Book a free consultation
                  </a>
                </div>
              </>
            ) : (
              // Fallback for brands that haven't configured pricing packages yet.
              <div className="text-center">
                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed mb-6">
                  Our team at <strong style={{ color: accentColor }}>{brandName}</strong> will review your requirements
                  and get back to you with a custom quote. Want to fast-track it?
                </p>
                <a href={`/lead-form?type=booking&user=${encodeURIComponent(userId)}&source=${encodeURIComponent(source)}&name=${encodeURIComponent(params.get("name") || "")}`}
                  className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold text-sm shadow-lg shadow-purple-600/30 active:scale-[0.98] transition-transform">
                  <Calendar className="w-4 h-4" /> Book a Free Consultation <ArrowRight className="w-4 h-4" />
                </a>
                <p className="text-slate-400 text-[11px] mt-3">Takes 30 seconds · No obligation</p>
              </div>
            )}
          </div>
        )}

        {/* MAIN FORM */}
        {step === "form" && (
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl shadow-slate-200/60">
            {/* Header */}
            <div className={`p-5 sm:p-7 border-b border-slate-200 ${isBookingMode ? "bg-purple-50" : "bg-cyan-50"}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3.5 h-3.5" style={{ color: accentColor }} />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>
                  {isBookingMode ? "Book Appointment" : "Pricing Inquiry"}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 mb-1.5 leading-snug">
                {isBookingMode ? `Schedule your free consultation with ${brandName}` : `Get a custom quote from ${brandName}`}
              </h1>
              <p className="text-xs text-slate-500 leading-relaxed m-0">
                {isBookingMode ? `You expressed interest on ${sourceLabel}. Let's get you booked! ✨` : `You asked about pricing on ${sourceLabel}. Tell us more so we can craft the perfect plan for you.`}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 sm:p-7 flex flex-col gap-4 sm:gap-5">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" /> Full Name <span style={{ color: accentColor }}>*</span>
                </label>
                <input type="text" placeholder="Your full name" value={form.name} onChange={(e) => update("name", e.target.value)} required className={inputClasses} />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> Email Address <span style={{ color: accentColor }}>*</span>
                </label>
                <input type="email" placeholder="you@email.com" value={form.email} onChange={(e) => update("email", e.target.value)} required className={inputClasses} />
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone / WhatsApp <span style={{ color: accentColor }}>*</span>
                </label>
                <input type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={(e) => update("phone", e.target.value)} required className={inputClasses} />
              </div>

              {/* Service */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-400" /> Service Interested In <span style={{ color: accentColor }}>*</span>
                </label>
                <input type="text" placeholder={brand?.main_offer || "e.g. Social Media Management, Design"} value={form.service} onChange={(e) => update("service", e.target.value)} required className={inputClasses} />
              </div>

              {/* BOOKING-SPECIFIC */}
              {isBookingMode && <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Preferred Date <span style={{ color: accentColor }}>*</span>
                  </label>
                  <input type="date" min={today} value={form.preferredDate} onChange={(e) => update("preferredDate", e.target.value)} required className={`${inputClasses} [color-scheme:light]`} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Preferred Time Slot <span style={{ color: accentColor }}>*</span>
                  </label>
                  <div className="relative">
                    <select value={form.preferredTimeSlot} onChange={(e) => update("preferredTimeSlot", e.target.value)} required className={`${inputClasses} appearance-none pr-10 cursor-pointer`}>
                      <option value="" className="bg-white text-slate-900">Select a time slot</option>
                      {TIME_SLOTS.map((s) => <option key={s} value={s} className="bg-white text-slate-900">{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </>}

              {/* PRICING-SPECIFIC */}
              {!isBookingMode && <>
                {packages.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                      <PackageIcon className="w-3.5 h-3.5 text-slate-400" />
                      Interested in a package? <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <select
                        value={form.selectedPackageId}
                        onChange={(e) => update("selectedPackageId", e.target.value)}
                        className={`${inputClasses} appearance-none pr-10 cursor-pointer`}
                      >
                        <option value="" className="bg-white text-slate-900">Not sure yet — send me a custom quote</option>
                        {packages.map((p) => (
                          <option key={p.id} value={p.id} className="bg-white text-slate-900">
                            {p.name} — {p.price_display}{p.is_featured ? " ⭐" : ""}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 text-slate-400" /> Budget Range <span style={{ color: accentColor }}>*</span>
                  </label>
                  <div className="relative">
                    <select value={form.budgetRange} onChange={(e) => update("budgetRange", e.target.value)} required className={`${inputClasses} appearance-none pr-10 cursor-pointer`}>
                      <option value="" className="bg-white text-slate-900">Select your budget</option>
                      {BUDGET_RANGES.map((r) => <option key={r} value={r} className="bg-white text-slate-900">{r}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Timeline <span style={{ color: accentColor }}>*</span>
                  </label>
                  <div className="relative">
                    <select value={form.timeline} onChange={(e) => update("timeline", e.target.value)} required className={`${inputClasses} appearance-none pr-10 cursor-pointer`}>
                      <option value="" className="bg-white text-slate-900">When do you need this?</option>
                      {TIMELINES.map((t) => <option key={t} value={t} className="bg-white text-slate-900">{t}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </>}

              {/* Message */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" /> {isBookingMode ? "What would you like to discuss?" : "Your requirements"} <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea placeholder={isBookingMode ? "Topics or questions you'd like to cover..." : "Describe your project goals or specific requirements..."} value={form.message} onChange={(e) => update("message", e.target.value)} rows={3} className={`${inputClasses} resize-none h-auto`} />
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading} className={`mt-1 w-full min-h-[48px] py-3.5 px-4 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 border-none transition-all duration-200 active:scale-[0.98] ${loading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${isBookingMode ? "bg-gradient-to-r from-purple-600 to-purple-700 shadow-lg shadow-purple-600/40" : "bg-gradient-to-r from-cyan-600 to-blue-600 shadow-lg shadow-cyan-600/40"}`}>
                {loading ? <><Loader2 className="animate-spin w-4 h-4" /> Submitting...</> : isBookingMode ? <><Calendar className="w-4 h-4" /> Confirm Appointment <ArrowRight className="w-4 h-4" /></> : <><TrendingUp className="w-4 h-4" /> Submit Enquiry <ArrowRight className="w-4 h-4" /></>}
              </button>

              <p className="text-center text-slate-400 text-[11px] mt-1 m-0">
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
      <div className="min-h-screen flex items-center justify-center bg-[#f4f5fb]">
        <Loader2 className="animate-spin w-8 h-8 text-[#7c3aed]" />
      </div>
    }>
      <LeadFormContent />
    </Suspense>
  );
}