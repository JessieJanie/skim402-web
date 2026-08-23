import { useQuery } from "@tanstack/react-query";

// Renders approved testimonials from GET /api/testimonials. The section
// hides itself entirely while empty so a young project never shows a bare
// "reviews" header with nothing under it.

interface Testimonial {
  name: string;
  link: string | null;
  quote: string;
  createdAt: string;
}

export function TestimonialsStrip() {
  const { data } = useQuery<{ testimonials: Testimonial[] }>({
    queryKey: ["public-testimonials"],
    queryFn: async () => {
      const res = await fetch("/api/testimonials");
      if (!res.ok) throw new Error("Failed to load testimonials");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const items = data?.testimonials ?? [];
  if (items.length === 0) return null;

  return (
    <section className="py-24 border-t border-border bg-card">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-3 text-center">
          From people who tried it
        </div>
        <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
          What users say
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 6).map((t, i) => (
            <figure
              key={i}
              className="rounded-2xl border border-border bg-background p-6 flex flex-col"
            >
              <blockquote className="text-sm leading-relaxed text-foreground flex-1">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-4 text-sm text-muted-foreground">
                &mdash;{" "}
                {t.link ? (
                  <a
                    href={t.link}
                    target="_blank"
                    rel="noopener nofollow"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {t.name}
                  </a>
                ) : (
                  t.name
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
