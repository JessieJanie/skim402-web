import { useEffect } from "react";
import { useLocation } from "wouter";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

/**
 * /card has been consolidated into /pricing (the Plans page).
 * This route is kept so old links and bookmarks keep working —
 * it immediately redirects. /card/success and /card/account are
 * still real pages.
 */
export default function CardPage() {
  useDocumentMeta({
    title: "Plans — free plan included, from $15/mo | Skim",
    description:
      "Skim's card plans now live on the Plans page: a Free Plan with 1,000 credits every month, or paid plans from $15. Real invoices, cancel anytime.",
    canonical: "https://skim402.com/pricing",
  });
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/pricing", { replace: true });
  }, [navigate]);
  return (
    <div className="container mx-auto px-4 py-24 text-center">
      <h1 className="text-2xl font-bold mb-4">
        Card plans now live on the Plans page.
      </h1>
      <p className="text-muted-foreground">
        Taking you there —{" "}
        <a href="/pricing" className="text-primary hover:underline">
          or click here if you aren't redirected
        </a>
        .
      </p>
    </div>
  );
}
