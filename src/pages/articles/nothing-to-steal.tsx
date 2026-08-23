import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ArrowLeft } from "lucide-react";

export default function NothingToSteal() {
  useDocumentMeta({
    title: "Nothing to Steal | Skim™",
    description:
      "BioShocking showed AI browsers can be talked into handing over credentials. The structural defense is least privilege: read the untrusted web with a low-privilege reader that carries no credentials and takes no actions. Trade-offs, latency, and how the pattern shrinks the blast radius — without pretending to cure prompt injection.",
    canonical: "https://skim402.com/articles/nothing-to-steal",
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

          <header className="mb-12">
            <time
              dateTime="2026-07-01"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              July 1, 2026
            </time>
            <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              Nothing to Steal
            </h1>
            <p className="mt-3 text-lg font-medium text-primary tracking-tight">
              Why BioShocking demands low-privilege AI readers
            </p>
            <p className="mt-4 text-xl md:text-2xl font-medium text-muted-foreground tracking-tight">
              The wild web is turning hostile to AI agents. The safest way to
              read it is with something that carries no credentials and takes no
              actions.
            </p>
          </header>

          <div className="prose prose-neutral dark:prose-invert max-w-none text-foreground/90 space-y-6 text-lg leading-relaxed">
            <p>
              For most of the web's life, the browser's job was to protect you
              from the page. Now we have handed the browser to an AI agent and
              given it real power: your logins, saved passwords, live sessions,
              and the ability to act on your behalf. That combination — power,
              autonomy, and direct exposure to the open internet — is exactly
              what the web has started turning against us.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              An attack with no easy patch
            </h2>

            <p>
              In June 2026, researchers at LayerX demonstrated an attack they
              called BioShocking. A malicious page leads an AI browser through a
              simple puzzle that rewards incorrect answers until the agent
              accepts that two plus two equals five. Once it believes it is
              inside a game where normal rules don't apply, its safety training
              stops firing — and the page simply asks it to read passwords from
              its own password manager. In demonstrations, the technique
              extracted credentials — in one case the keys to a work code
              repository — across roughly six different AI browsers.
            </p>

            <p>
              The deeper issue is structural. A language model processes
              everything — its system instructions, the user's request, and the
              text on the current webpage — as one continuous stream of tokens.
              It has no reliable mechanism to distinguish trusted commands from
              untrusted content. This is the same fundamental shape as classic
              SQL injection, except the injected "command" is now plain English
              on a webpage. OpenAI has publicly stated that this class of attack
              is unlikely to ever be fully solved.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              The limits of guardrails
            </h2>

            <p>
              The instinctive response is to add more safety layers inside the
              model. These help at the margins, but they still treat a
              structural problem as something that can be patched away. If the
              core danger is that a powerful, credential-carrying agent can be
              socially engineered by any webpage it visits, then the strategy of
              "make the agent harder to fool" is betting everything on the agent
              never being fooled. History suggests that bet eventually loses.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              A better principle: separate reading from acting
            </h2>

            <p>
              Security has long relied on a simple rule called least privilege:
              give any component only the power it needs for its specific job.
              Reading a webpage is low-privilege, clerical work. It does not
              require passwords, active sessions, or the ability to take actions
              on the user's behalf.
            </p>

            <p>
              The most effective defense is therefore architectural: stop
              sending powerful, credentialed agents directly to untrusted pages.
              Instead, introduce a separate, low-privilege reader whose only job
              is to fetch and return clean content. This reduces the attack
              surface because the component that touches the hostile page has
              nothing valuable to lose. This pattern is already standard in
              traditional security systems, and the same logic applies to AI
              agents.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              How different approaches handle this
            </h2>

            <p>
              Major AI labs are addressing this problem in different ways. Some
              focus on stronger guardrails, explicit confirmation steps before
              sensitive actions, and tighter restrictions on tool use. Others
              are exploring memory isolation and more constrained agent
              architectures. These approaches are valuable, but most still
              require the agent itself to correctly separate trusted
              instructions from untrusted webpage content while holding
              significant privileges.
            </p>

            <p>
              An alternative strategy focuses on the input layer: use a
              dedicated, low-privilege reader that has no credentials and cannot
              take actions. The agent then works with the clean output rather
              than interacting directly with the untrusted web.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              Trade-offs and limitations
            </h2>

            <p>Using a separate reader introduces real trade-offs:</p>

            <ul className="space-y-2 list-disc pl-6">
              <li>
                <strong className="font-semibold text-foreground">
                  Latency:
                </strong>{" "}
                routing requests through an external reader adds a network hop.
                In practice this overhead is typically modest — and it is not
                purely additive, because the reader does the fetching and
                cleaning the agent would otherwise perform itself.
              </li>
              <li>
                <strong className="font-semibold text-foreground">
                  Integration:
                </strong>{" "}
                the agent must be configured to use the reader as its web tool
                rather than accessing the web directly.
              </li>
              <li>
                <strong className="font-semibold text-foreground">
                  Data structure:
                </strong>{" "}
                some pages return structured content that may require additional
                parsing after retrieval.
              </li>
              <li>
                <strong className="font-semibold text-foreground">
                  Cost at scale:
                </strong>{" "}
                per-page pricing becomes relevant for high-volume usage.
              </li>
            </ul>

            <p>
              These are practical engineering considerations. In most agent
              workflows, the added latency is manageable when basic
              optimizations are applied.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              Reducing the latency overhead
            </h2>

            <p>
              The performance cost of using a separate reader can be reduced
              with a few established techniques:
            </p>

            <ul className="space-y-2 list-disc pl-6">
              <li>
                <strong className="font-semibold text-foreground">
                  Caching:
                </strong>{" "}
                store recently fetched pages with a time-to-live (TTL). This
                avoids repeated network calls for content that hasn't changed.
              </li>
              <li>
                <strong className="font-semibold text-foreground">
                  Parallel fetching:
                </strong>{" "}
                when the agent needs information from multiple pages, request
                them simultaneously instead of sequentially. This hides much of
                the latency by overlapping requests.
              </li>
              <li>
                <strong className="font-semibold text-foreground">
                  Selective use:
                </strong>{" "}
                prompt the agent to only call the reader when it genuinely needs
                fresh information. Well-designed system instructions can
                significantly reduce unnecessary calls by encouraging the agent
                to answer from existing knowledge first.
              </li>
            </ul>

            <p>
              With these patterns, many agents experience only minor added delay
              while gaining much stronger protection against attacks that target
              credentials or actions.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              One example of this approach
            </h2>

            <p>
              One implementation of this pattern is a reader that holds no
              accounts, no password manager, and no user sessions. It cannot
              click, submit forms, or perform actions. It runs on isolated
              infrastructure and returns clean text from the requested URL. When
              an attack like BioShocking targets this type of reader, there is
              nothing to extract and no actions it can be tricked into taking.
              The agent remains one step removed, receiving only the text and
              deciding what to do with it in its own trusted context.
            </p>

            <p>
              This is not a cure for prompt injection, and it should not be sold
              as one. Hostile instructions can still live in the text a reader
              returns, and an agent can in principle be misled by them. What a
              low-privilege reader changes is the blast radius: the component
              that actually touches the hostile page holds no credentials and
              can take no actions, so the worst case shrinks dramatically.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              The bigger picture
            </h2>

            <p>
              The web is only going to become more hostile as more agents carry
              more power into it. The most reliable long-term defense remains the
              same principle security has relied on for decades: give each part
              of the system only the minimum power required for its job. Reading
              untrusted content and acting with user credentials are
              fundamentally different responsibilities. Conflating them creates
              predictable risks.
            </p>

            <p>The safest reader is the one that has nothing worth stealing.</p>
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
              Read the docs &rarr;
            </Link>
          </div>
        </div>
      </article>
    </PublicLayout>
  );
}
