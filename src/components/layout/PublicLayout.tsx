import { ReactNode } from "react";
import { SkimBackground, SkimNav, SkimFooter } from "@/components/layout/SkimChrome";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="skim-page skim-shell">
      <SkimBackground />
      <SkimNav />
      <main className="skim-shell-main">{children}</main>
      <SkimFooter />
    </div>
  );
}
