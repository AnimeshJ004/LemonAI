import React from "react";

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 w-full">{children}</div>;
}
