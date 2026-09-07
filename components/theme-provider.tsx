"use client";

import React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// Suppress React 19 / Next.js 16 dev warning for next-themes inline script tag
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (
      msg.includes("Encountered a script tag while rendering React component") ||
      msg.includes("Scripts inside React components are never executed when rendering on the client")
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}