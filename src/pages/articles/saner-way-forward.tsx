import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ArrowLeft } from "lucide-react";

export default function SanerWayForward() {
  useDocumentMeta({
    title: "At AI's Growing Pain Moment: The Saner Way Forward | Skim™",
    description:
      "A great deal of what gets billed as AI work is not AI work at all. The right shape for an AI system has three layers, not one — and the predictable layer should cost a small fraction of a cent.",
    canonical: "https://skim402.com/articles/saner-way-forward",
  });

  return (
    <PublicLayout>
      <article className="pt-20 pb-24 md:pt-28">
        <div className="container mx-auto px-4 max-w-2xl">
          <Link
            href="/articles"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-12"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All articles
          </Link>

          <figure className="mb-10 -mx-4 md:mx-0">
            <img
              src={`${import.meta.env.BASE_URL}articles/saner-way-forward-hero.png`}
              alt="A horizontal composition: a peach dawn sky above three layered wavy bands of progressively darker blue, suggesting the three layers of an AI stack."
              className="w-full h-auto md:rounded-lg shadow-sm"
              width={2560}
              height={1024}
            />
          </figure>

          <header className="mb-12">
            <time
              dateTime="2026-05-23"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              May 23, 2026
            </time>
            <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              At AI's Growing Pain Moment
            </h1>
            <p className="mt-2 text-4xl md:text-5xl font-bold tracking-tight leading-tight text-primary">
              The Saner Way Forward
            </p>
          </header>

          <div className="prose prose-neutral dark:prose-invert max-w-none text-foreground/90 space-y-6 text-lg leading-relaxed">
            <p>Something has gone wrong with how we're using AI.</p>

            <p>
              The bills come in. The headlines tell the story. Microsoft's
              internal numbers say running AI now costs more than the engineers
              it was built to serve. Uber spent its entire 2026 AI budget by
              April. GitHub is walking away from flat-rate plans. Three Mile
              Island is being brought back online to power a single data center.
            </p>

            <p>
              Or maybe nothing has gone wrong. Maybe we've just arrived at a
              growing pain moment.
            </p>

            <p>This isn't a failure. This is what fast growth feels like.</p>

            <p>
              The question is no longer whether AI works. It works. The
              question is whether we're truly making the most of it. And the
              answer is that we have not yet paused to ask.
            </p>

            <p>It's time to do just that — take inventory of where we are.</p>

            <p>
              We've spent three years in a race for quantity. More parameters.
              More tokens. More agents calling more agents in deeper and deeper
              loops. Each layer doing work the layer below could have done for
              a fraction of a cent, in a fraction of a second, on a fraction of
              the power. The race made sense when it started; nobody knew yet
              what these models could do. Now we know.
            </p>

            <p>
              A great deal of what gets billed as "AI work" is not AI work at
              all.
            </p>

            <p>
              Fetching a web page is not reasoning. Stripping the navigation
              off an article is not reasoning. Turning HTML into clean markdown
              is not reasoning. These are clerical tasks, the kind a small,
              deterministic program has done elegantly for thirty years. Asking
              a sixty-dollar-per-million-token reasoning model to do them is
              asking a brain surgeon to alphabetize the waiting room.
            </p>

            <p className="text-xl md:text-2xl font-medium text-foreground border-l-4 border-primary pl-6 italic">
              We have built the most expensive computer in human history and
              pointed it at filing cabinets.
            </p>

            <p>
              The opportunity here is larger than a cost-cutting exercise. A
              new layer of the stack is emerging — deterministic infrastructure
              built and priced specifically for AI agents. Not the old web,
              repackaged. Purpose-built primitives that do the predictable work
              at machine speed, settle for fractions of a cent, and leave the
              language models free for the work only they can do.
            </p>

            <p>
              The right shape for an AI system has three layers, not one.
              Deterministic infrastructure at the bottom, doing the predictable
              work — reading, parsing, formatting, sorting, validating.
              Language models in the middle, doing what only they can do —
              reasoning, judgment, the genuinely novel cut. Humans at the top,
              doing what only humans can do — bringing taste, intention,
              accountability.
            </p>

            <p>
              Each layer earns its keep. Each layer is essential. Each layer
              leaves the layers above and below free to do what only they can
              do.
            </p>

            <p>
              This is not a smaller idea than AI. It is a more honest one.
            </p>

            <p>
              It is also a more responsible one. Investors deserve software
              that doesn't burn their capital on string manipulation. Employees
              deserve tools that get faster and cheaper every year, not slower
              and more expensive. The grid deserves to keep the lights on for
              humans, not waste energy on matrix multiplications that could
              have been a regular expression.
            </p>

            <p>
              The labs building the great reasoning models are not the villain
              in this story. They have built something revolutionary, and we
              owe them the discipline to use it well. Every kilowatt a
              deterministic pipeline returns to the pool is a kilowatt a
              frontier model can spend on actual frontier work.
            </p>

            <p>
              This is what we mean when we say Skim should cost less than
              two-tenths of a cent. Not because reading the web is unimportant.
              Because reading the web is solved, and we should take advantage
              of this and price it accordingly.
            </p>

            <p>
              The frantic-paced race for quantity is winding down. A saner
              cycle is beginning — one in which every layer of the stack gets
              sized correctly, priced correctly, and asked to do only what it
              does best. The winners will not be the ones who burn the most
              tokens. They will be the ones who burn the right tokens, on the
              right work, at the right layer of the stack.
            </p>

            <p className="text-xl md:text-2xl font-medium text-foreground border-l-4 border-primary pl-6 italic">
              The most powerful tools are the ones that know what they are for.
            </p>
          </div>

          <footer className="mt-16 pt-8 border-t border-border/60">
            <p className="text-base text-foreground font-medium">
              Karilyn Colegrove
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Founder, Skim &middot;{" "}
              <a
                href="https://skim402.com"
                className="text-primary hover:underline"
              >
                skim402.com
              </a>
            </p>
          </footer>

          <div className="mt-12 pt-8 border-t border-border/60 flex items-center justify-between">
            <Link
              href="/articles"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All articles
            </Link>
            <Link
              href="/docs"
              className="text-sm font-medium text-primary hover:underline"
            >
              How Skim works for agents &rarr;
            </Link>
          </div>
        </div>
      </article>
    </PublicLayout>
  );
}
