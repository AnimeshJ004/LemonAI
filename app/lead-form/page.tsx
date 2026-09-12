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

function Field({ icon, label, required, children }: { icon: React.ReactNode; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.55)" }}>
        <span style={{ color: "rgba(255,255,255,0.35)" }}>{icon}</span>
        {label}
        {required && <span style={{ color: "#a78bfa" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f" }}>
        <Loader2 className="animate-spin" style={{ width: 32, height: 32, color: "#a78bfa" }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />

      {/* Background glows */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-20%", left: "-10%", width: 600, height: 600, background: "radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 70%)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: 500, height: 500, background: "radial-gradient(circle, rgba(8,145,178,0.18) 0%, transparent 70%)", borderRadius: "50%" }} />
      </div>

      <div style={{ position: "relative", width: "100%", maxWidth: 460 }}>

        {/* SUCCESS */}
        {step === "success" && (
          <div style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: 36, textAlign: "center", boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ width: 80, height: 80, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <CheckCircle style={{ width: 40, height: 40, color: "#34d399" }} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "white", margin: "0 0 8px" }}>You are all set! 🎉</h2>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>
              Thanks <strong style={{ color: "white" }}>{form.name || "there"}</strong>! The team at{" "}
              <strong style={{ color: accentLight }}>{brandName}</strong> will confirm your appointment shortly.
            </p>
            {(form.preferredDate || form.preferredTimeSlot) && (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16, textAlign: "left", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                {form.preferredDate && <p style={{ margin: "0 0 6px" }}>📅 <span style={{ color: "rgba(255,255,255,0.8)" }}>{form.preferredDate}</span></p>}
                {form.preferredTimeSlot && <p style={{ margin: 0 }}>🕐 <span style={{ color: "rgba(255,255,255,0.8)" }}>{form.preferredTimeSlot}</span></p>}
              </div>
            )}
          </div>
        )}

        {/* PRICING → BOOK CTA */}
        {step === "booking_after_pricing" && (
          <div style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: 36, textAlign: "center", boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ width: 80, height: 80, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <CheckCircle style={{ width: 40, height: 40, color: "#a78bfa" }} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "white", margin: "0 0 10px" }}>Enquiry received! ✅</h2>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" }}>
              Our team at <strong style={{ color: accentLight }}>{brandName}</strong> will review your requirements and get back to you with a custom quote. Want to fast-track it?
            </p>
            <a href={`/lead-form?type=booking&user=${encodeURIComponent(userId)}&source=${encodeURIComponent(source)}&name=${encodeURIComponent(params.get("name") || "")}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "14px 0", borderRadius: 14, background: "linear-gradient(135deg, #7c3aed, #06b6d4)", color: "white", fontWeight: 600, fontSize: 14, textDecoration: "none", boxShadow: "0 8px 24px rgba(124,58,237,0.35)" }}>
              <Calendar style={{ width: 16, height: 16 }} /> Book a Free Consultation <ArrowRight style={{ width: 16, height: 16 }} />
            </a>
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginTop: 10 }}>Takes 30 seconds · No obligation</p>
          </div>
        )}

        {/* MAIN FORM */}
        {step === "form" && (
          <div style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
            {/* Header */}
            <div style={{ padding: "28px 28px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: isBookingMode ? "rgba(124,58,237,0.1)" : "rgba(8,145,178,0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Sparkles style={{ width: 14, height: 14, color: accentLight }} />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: accentLight }}>
                  {isBookingMode ? "Book Appointment" : "Pricing Inquiry"}
                </span>
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "white", margin: "0 0 6px", lineHeight: 1.3 }}>
                {isBookingMode ? `Schedule your free consultation with ${brandName}` : `Get a custom quote from ${brandName}`}
              </h1>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: 0 }}>
                {isBookingMode ? `You expressed interest on ${sourceLabel}. Let's get you booked! ✨` : `You asked about pricing on ${sourceLabel}. Tell us more so we can craft the perfect plan for you.`}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ padding: "24px 28px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Name */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 6 }}>
                  <User style={{ width: 14, height: 14, color: "rgba(255,255,255,0.35)" }} /> Full Name <span style={{ color: accentLight }}>*</span>
                </label>
                <input type="text" placeholder="Your full name" value={form.name} onChange={(e) => update("name", e.target.value)} required style={inputStyle} onFocus={(e) => (e.target.style.borderColor = accentColor)} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")} />
              </div>

              {/* Email */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Mail style={{ width: 14, height: 14, color: "rgba(255,255,255,0.35)" }} /> Email Address <span style={{ color: accentLight }}>*</span>
                </label>
                <input type="email" placeholder="you@email.com" value={form.email} onChange={(e) => update("email", e.target.value)} required style={inputStyle} onFocus={(e) => (e.target.style.borderColor = accentColor)} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")} />
              </div>

              {/* Phone */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Phone style={{ width: 14, height: 14, color: "rgba(255,255,255,0.35)" }} /> Phone / WhatsApp <span style={{ color: accentLight }}>*</span>
                </label>
                <input type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={(e) => update("phone", e.target.value)} required style={inputStyle} onFocus={(e) => (e.target.style.borderColor = accentColor)} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")} />
              </div>

              {/* Service */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 6 }}>
                  <TrendingUp style={{ width: 14, height: 14, color: "rgba(255,255,255,0.35)" }} /> Service Interested In <span style={{ color: accentLight }}>*</span>
                </label>
                <input type="text" placeholder={brand?.main_offer || "e.g. Social Media Management, Design"} value={form.service} onChange={(e) => update("service", e.target.value)} required style={inputStyle} onFocus={(e) => (e.target.style.borderColor = accentColor)} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")} />
              </div>

              {/* BOOKING-SPECIFIC */}
              {isBookingMode && <>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Calendar style={{ width: 14, height: 14, color: "rgba(255,255,255,0.35)" }} /> Preferred Date <span style={{ color: accentLight }}>*</span>
                  </label>
                  <input type="date" min={today} value={form.preferredDate} onChange={(e) => update("preferredDate", e.target.value)} required style={{ ...inputStyle, colorScheme: "dark" }} onFocus={(e) => (e.target.style.borderColor = accentColor)} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock style={{ width: 14, height: 14, color: "rgba(255,255,255,0.35)" }} /> Preferred Time Slot <span style={{ color: accentLight }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <select value={form.preferredTimeSlot} onChange={(e) => update("preferredTimeSlot", e.target.value)} required style={{ ...inputStyle, appearance: "none", paddingRight: 36, cursor: "pointer" }}>
                      <option value="">Select a time slot</option>
                      {TIME_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "rgba(255,255,255,0.35)", pointerEvents: "none" }} />
                  </div>
                </div>
              </>}

              {/* PRICING-SPECIFIC */}
              {!isBookingMode && <>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 6 }}>
                    <IndianRupee style={{ width: 14, height: 14, color: "rgba(255,255,255,0.35)" }} /> Budget Range <span style={{ color: accentLight }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <select value={form.budgetRange} onChange={(e) => update("budgetRange", e.target.value)} required style={{ ...inputStyle, appearance: "none", paddingRight: 36, cursor: "pointer" }}>
                      <option value="">Select your budget</option>
                      {BUDGET_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "rgba(255,255,255,0.35)", pointerEvents: "none" }} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock style={{ width: 14, height: 14, color: "rgba(255,255,255,0.35)" }} /> Timeline <span style={{ color: accentLight }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <select value={form.timeline} onChange={(e) => update("timeline", e.target.value)} required style={{ ...inputStyle, appearance: "none", paddingRight: 36, cursor: "pointer" }}>
                      <option value="">When do you need this?</option>
                      {TIMELINES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "rgba(255,255,255,0.35)", pointerEvents: "none" }} />
                  </div>
                </div>
              </>}

              {/* Message */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 6 }}>
                  <MessageSquare style={{ width: 14, height: 14, color: "rgba(255,255,255,0.35)" }} /> {isBookingMode ? "What would you like to discuss?" : "Your requirements"} <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea placeholder={isBookingMode ? "Topics or questions you'd like to cover..." : "Describe your project goals or specific requirements..."} value={form.message} onChange={(e) => update("message", e.target.value)} rows={3} style={{ ...inputStyle, resize: "none" }} onFocus={(e) => (e.target.style.borderColor = accentColor)} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")} />
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading} style={{ padding: "14px 0", borderRadius: 14, background: isBookingMode ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "linear-gradient(135deg, #0891b2, #2563eb)", color: "white", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.65 : 1, boxShadow: `0 8px 24px ${isBookingMode ? "rgba(124,58,237,0.4)" : "rgba(8,145,178,0.4)"}`, transition: "opacity 0.2s" }}>
                {loading ? <><Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> Submitting...</> : isBookingMode ? <><Calendar style={{ width: 16, height: 16 }} /> Confirm Appointment <ArrowRight style={{ width: 16, height: 16 }} /></> : <><TrendingUp style={{ width: 16, height: 16 }} /> Submit Enquiry <ArrowRight style={{ width: 16, height: 16 }} /></>}
              </button>

              <p style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 11, margin: 0 }}>
                🔒 Your info is private and only shared with {brandName}
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  padding: "10px 14px",
  color: "white",
  fontSize: 14,
  outline: "none",
  transition: "border-color 0.2s, background 0.2s",
  boxSizing: "border-box",
};

export default function LeadFormPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f" }}>
        <Loader2 className="animate-spin" style={{ width: 32, height: 32, color: "#a78bfa" }} />
      </div>
    }>
      <LeadFormContent />
    </Suspense>
  );
}
