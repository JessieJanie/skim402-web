import { useEffect } from "react";
import { useLocation } from "wouter";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

/**
 * /account is not a real page — the card ledger lives at /card/account.
 * Keep this alias so bookmarks and guessed URLs do not hit the client 404.
 */
export default function AccountRedirect() {
  useDocumentMeta({
    title: "Your account | Skim",
    description:
      "Check your Skim balance: credits remaining, plan status, and pending overage. Manage billing or cancel anytime.",
    canonical: "https://skim402.com/card/account",
  });
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/card/account", { replace: true });
  }, [navigate]);
  return (
    <div className="container mx-auto px-4 py-24 text-center">
      <h1 className="text-2xl font-bold mb-4">Your account lives at /card/account.</h1>
      <p className="text-muted-foreground">
        Taking you there —{" "}
        <a href="/card/account" className="text-primary hover:underline">
          or click here if you aren&apos;t redirected
        </a>
        .
      </p>
    </div>
  );
}
