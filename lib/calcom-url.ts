/**
 * Client-safe Cal.com booking link generator.
 * Does not import any server-side dependencies.
 */
export function generateCalcomBookingUrl(params: {
  leadName?: string;
  email?: string;
  phone?: string;
  notes?: string;
}): string {
  const baseCalUrl =
    process.env.NEXT_PUBLIC_CALCOM_LINK ||
    "https://cal.com/lemon-ai/discovery";

  try {
    const url = new URL(baseCalUrl);
    if (params.leadName) url.searchParams.set("name", params.leadName);
    if (params.email) url.searchParams.set("email", params.email);
    if (params.phone) url.searchParams.set("phone", params.phone);
    if (params.notes) url.searchParams.set("notes", params.notes);
    return url.toString();
  } catch {
    const query = new URLSearchParams();
    if (params.leadName) query.set("name", params.leadName);
    if (params.email) query.set("email", params.email);
    if (params.phone) query.set("phone", params.phone);
    return `${baseCalUrl}?${query.toString()}`;
  }
}
