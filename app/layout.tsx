import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Lemon.ai | Social Media Scheduling",
  description: "Create AI-powered social media scheduling for every platform in seconds. Lemon.ai is a platform that allows you to create social media scheduling for every platform in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased font-sans"
    >
      <body className="min-h-full flex flex-col font-sans">
        <ClerkProvider>
          <QueryProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem
              disableTransitionOnChange
            >
              <TooltipProvider>
                {children}
              </TooltipProvider>

              <Toaster  richColors/>
            </ThemeProvider>

          </QueryProvider>

        </ClerkProvider>
      </body>
    </html>
  );
}
