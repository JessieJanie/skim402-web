import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ArrowLeft } from "lucide-react";

export default function YourAgentIsNotAUser() {
  useDocumentMeta({
    title: "The API Key Is Today's Floppy Disk | Skim™",
    description:
      "Up to 30x faster. Up to 30x cheaper. API keys still work — the shelf is full — but a quiet substitution is underway, and the agents that move first get the better tools.",
    canonical: "https://skim402.com/articles/your-agent-is-not-a-user",
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

          <figure className="not-prose relative mb-14 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 px-6 py-7 md:px-10 md:py-8 shadow-2xl text-center">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(59,130,246,0.10) 0%, transparent 60%)",
              }}
            />

            <div className="relative inline-block align-middle">
              <svg
                viewBox="0 0 100 11"
                preserveAspectRatio="xMidYMid meet"
                className="block w-full"
                aria-hidden="true"
              >
                <text
                  x="50"
                  y="8.6"
                  textAnchor="middle"
                  textLength="100"
                  lengthAdjust="spacingAndGlyphs"
                  fontSize="9"
                  fontWeight="700"
                  fill="#60a5fa"
                  fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Which pill, red or blue?
                </text>
              </svg>

              <div className="mt-4 md:mt-5 grid grid-cols-[auto_auto_auto] items-center gap-4 sm:gap-5">
                <div
                  className="relative h-20 w-44 sm:h-24 sm:w-52 md:h-28 md:w-60 rounded-full shadow-[0_18px_50px_-15px_rgba(220,38,38,0.65)]"
                  style={{
                    background:
                      "linear-gradient(180deg, #f87171 0%, #ef4444 35%, #dc2626 65%, #991b1b 100%)",
                  }}
                >
                  <div className="absolute top-1.5 left-5 right-5 h-1.5 rounded-full bg-white/40 blur-[2px]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl sm:text-3xl md:text-[2.25rem] font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                      $1,800
                    </span>
                  </div>
                </div>

                <p className="text-lg sm:text-xl md:text-2xl italic font-medium text-slate-400">
                  or
                </p>

                <div
                  className="relative h-20 w-44 sm:h-24 sm:w-52 md:h-28 md:w-60 rounded-full shadow-[0_18px_50px_-15px_rgba(37,99,235,0.65)]"
                  style={{
                    background:
                      "linear-gradient(180deg, #60a5fa 0%, #3b82f6 35%, #2563eb 65%, #1e40af 100%)",
                  }}
                >
                  <div className="absolute top-1.5 left-5 right-5 h-1.5 rounded-full bg-white/40 blur-[2px]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl sm:text-3xl md:text-[2.25rem] font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                      $60
                    </span>
                  </div>
                </div>
              </div>

              <svg
                viewBox="0 0 100 7"
                preserveAspectRatio="xMidYMid meet"
                className="block w-full mt-4 md:mt-5"
                role="img"
                aria-label="Same agent. Same output. New plumbing."
              >
                <text
                  x="50"
                  y="5.6"
                  textAnchor="middle"
                  textLength="100"
                  lengthAdjust="spacingAndGlyphs"
                  fontSize="5.6"
                  fontStyle="italic"
                  fontWeight="600"
                  fill="#f87171"
                  fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"
                >
                  Same agent. Same output. New plumbing.
                </text>
              </svg>
            </div>
          </figure>

          <header className="mb-12">
            <time
              dateTime="2026-05-26"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              May 26, 2026
            </time>
            <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              The API Key Is Today's Floppy Disk
            </h1>
            <p className="mt-3 text-xl md:text-2xl font-medium text-muted-foreground tracking-tight">
              Up to 30x faster. Up to 30x cheaper.
            </p>
          </header>

          <div className="prose prose-neutral dark:prose-invert max-w-none text-foreground/90 space-y-6 text-lg leading-relaxed">
            <p>Try to buy a floppy disk this week.</p>

            <p>
              You can find one. They still spin. They still hold data. They
              still work, technically. But the world has moved on. That's
              why floppy disks are also now in museums including the
              Smithsonian's National Museum of American History and the
              Museum of Obsolete Media.
            </p>

            <p>
              Today's API key <em>is</em> the floppy disk.
            </p>

            <p>
              It still works. It is still everywhere. Yet substitution is
              underway. The industry is waking up and discovering the new
              thing.
            </p>

            <p>Here's how history will describe the transition…</p>

            <p>
              We had agents. We had services. We needed the agents to use
              the services. So we gave them what we had on the shelf — API
              keys, signup flows, dashboards, credit cards, audit logs. The
              first agents looked enough like users that it was easy to
              assume they could function as users.
            </p>

            <p>They can't.</p>

            <p>
              An API key is a credential designed for a person. It assumes
              a human at a keyboard, signing up with an email address,
              copying the key into a config file, watching a dashboard,
              paying with a credit card, rotating the secret every ninety
              days because the security team said so.
            </p>

            <p>
              Agents have none of that. No email address. No keyboard. No
              security team. No credit card. No human to copy a fresh key
              into a config file at two in the morning when the old one
              expires.
            </p>

            <p>
              What we did was hand the machine a tool made for a hand it
              doesn't have.
            </p>

            <p>
              It mostly works. Like a lot of things in technology that
              mostly work, it has accumulated a cost we are paying every
              day without noticing.
            </p>

            <p className="text-xl md:text-2xl font-medium text-foreground border-l-4 border-primary pl-6 italic">
              We handed the machine a tool made for a hand it doesn't have.
            </p>

            <p>Consider what an API key drags along behind it.</p>

            <p>
              <strong>A signup flow.</strong> Every new service requires
              you — the developer behind it — to create an account, verify
              an email, agree to terms, generate a key, and copy it
              somewhere safe. Multiply by every service the agent needs.
              The first hour or more for any new agent project requires the
              human to be its secretary, to do its paperwork.
            </p>

            <p>
              <strong>A leak surface.</strong> Hundreds of thousands of API
              keys are accidentally pushed to public GitHub repositories
              every year. The big cloud providers scan for them
              automatically, because the alternative is too painful. The
              leak vector is catastrophic — a single key, exposed for
              thirty seconds, can spend an entire month's budget before
              anyone notices.
            </p>

            <p>
              <strong>A billing relationship that doesn't fit.</strong>{" "}
              Every service the agent uses needs a credit card on file.
              That card belongs to a human or a company. The agent has no
              balance sheet of its own. When the agent works for one
              customer this hour and another customer the next, the cost
              has to be reconciled out of band — receipts gathered,
              invoices issued, ledgers updated. The work the agent did is
              finished in seconds. The accounting takes weeks.
            </p>

            <p>
              <strong>A rate limit that punishes scale.</strong> Services
              throttle per key because they have to. They can't tell
              whether the requests on the other end are one human clicking
              buttons or ten thousand agents fanning out in parallel. The
              agent that works hard hits the wall fastest. The reward for
              being useful is being slowed down.
            </p>

            <p>
              <strong>A rotation problem nobody solves.</strong> Keys are
              supposed to be rotated. They almost never are. Rotating a
              key means coordinating with every consumer of that key,
              restarting services, hoping nothing was hard-coded somewhere.
              So the keys sit, year after year, granting the same access
              long after the individual who created them has moved on.
            </p>

            <p>
              None of this is anyone's fault. It is what happens when you
              take a tool built for one job and ask it to do a different
              one.
            </p>

            <p className="text-xl md:text-2xl font-medium text-foreground border-l-4 border-primary pl-6 italic">
              The API key still works. The shelf is full. But a quiet
              substitution is underway.
            </p>

            <p>There is another way to do this.</p>

            <p>Give the agent a wallet.</p>

            <p>
              Not a credit card. Not an account with a balance held on the
              agent's behalf by somebody else. A real wallet — a key pair
              the agent holds itself, with funds the agent can spend and
              the service can verify, on a public ledger that settles in
              seconds for fractions of a cent.
            </p>

            <p>
              <strong>The signup goes away.</strong> The wallet is the
              identity. The agent arrives at the service, signs a payment,
              gets the response. No email. No dashboard. No account.
            </p>

            <p>
              <strong>The leak surface shrinks.</strong> A wallet only
              holds what is in it. If the agent's hot wallet has ten
              dollars in it, the worst case is losing ten dollars, not
              losing the month.
            </p>

            <p>
              <strong>The billing relationship fits.</strong> The agent
              pays for what it uses, exactly when it uses it. No invoices.
              No reconciliation. The receipt is the transaction.
            </p>

            <p>
              <strong>The rate limit dissolves.</strong> The service can
              price by demand instead of throttling by identity. The agent
              that works the most simply pays more.
            </p>

            <p>
              <strong>Rotation, finally, is honest.</strong> Wallets are
              cheap to create. The agent that wants a fresh key pair every
              hour can have one.
            </p>

            <p>
              These architectural wins are reason enough on their own. But
              they aren't even the most interesting part.
            </p>

            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground pt-4">
              Faster, with up to 30x savings
            </h2>

            <p>
              Agents that use wallet-native services don't just sidestep
              the friction. They do the same work <em>faster</em> and for{" "}
              <em>dramatically</em> less money.
            </p>

            <p>
              Faster, because the friction <em>is</em> the slowness. Every
              signup loop is wall-clock time. Every key rotation is
              wall-clock time. Every flagship-LLM-as-janitor task —{" "}
              <em>"summarize this 40KB HTML page into clean markdown"</em>{" "}
              — runs at the speed of a reasoning model trying to do a
              clerical job. A purpose-built deterministic service does the
              same job in about a second and a half.
            </p>

            <p>
              Cheaper, because the new economics aren't a discount on the
              old economics. They are a different shape.
            </p>

            <p>
              Consider a single concrete example — an agent that reads
              articles from the web. This is one of the most common things
              any modern agent does, and it is the work Skim was built for.
            </p>

            <div className="not-prose my-8 overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-base">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left font-semibold px-5 py-3">
                      1,000 web articles, cleaned to markdown
                    </th>
                    <th className="text-right font-semibold px-5 py-3 w-32">
                      Cost
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr>
                    <td className="px-5 py-3">
                      Asking GPT-4o-mini to do the reading
                    </td>
                    <td className="px-5 py-3 text-right font-mono">~$3</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3">
                      Asking Anthropic Haiku to do the reading
                    </td>
                    <td className="px-5 py-3 text-right font-mono">~$20</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3">
                      Asking GPT-4o to do the reading
                    </td>
                    <td className="px-5 py-3 text-right font-mono">~$45</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3">
                      Asking Claude Sonnet 4 to do the reading
                    </td>
                    <td className="px-5 py-3 text-right font-mono">~$60</td>
                  </tr>
                  <tr className="bg-primary/5">
                    <td className="px-5 py-3 font-semibold">
                      Calling Skim from a wallet
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-primary">
                      $2
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="px-5 py-3 text-xs text-muted-foreground border-t border-border/60">
                Assumes 40KB of HTML in, 2KB of markdown out, May 2026
                token prices.
              </p>
            </div>

            <p>
              An agent that reads a thousand pages a day, every day for a
              month, is doing thirty thousand reads. On a flagship model,
              that's $1,800 a month — for the <em>cleaning alone</em>,
              before the agent has done a single useful thing with the
              content. On Skim, paid from a wallet, the same month costs
              $60.
            </p>

            <p>
              That is not a discount. It is a different category of
              pricing, made possible by a different category of plumbing.
            </p>

            <p>
              And the speed compounds. The same agent, doing the same
              work, finishes in a fraction of the wall-clock time — Skim
              returns clean markdown in about one and a half seconds, while
              a flagship-model read takes six to ten. Multiply across
              thirty thousand reads. The agent that pays less also
              delivers sooner.
            </p>

            <p className="text-xl md:text-2xl font-medium text-foreground border-l-4 border-primary pl-6 italic">
              That is not a discount. It is a different category of
              pricing.
            </p>

            <p>
              This is the architecture the next decade of agent work
              needs. Not because wallets are fashionable. Because keys
              were never built for what we are now asking them to do, and
              the tools that wallets unlock are much faster and cheaper
              than anything a key can buy.
            </p>

            <p>
              The good news is that the alternative already exists. It is
              not a research project. The rails are running. Coinbase
              shipped an official Base MCP that lets any agent transact on
              Base out of the box. The x402 protocol turns any HTTP
              service into a payable endpoint with one piece of
              middleware. Skim was built on those rails because they are
              the right rails now. We are among the first paid services to
              live on them, at the beginning of the shift.
            </p>

            <p>
              If you are building an agent today, you do not need to pick
              a side in this transition. Your existing keys still work.
            </p>

            <p>
              But the next service you reach for — the next time you find
              yourself opening a signup form, pasting a key into a config
              file, putting a credit card on file for a machine that does
              not have hands — ask whether the shelf you are reaching for
              is full of floppies.
            </p>

            <p>
              You'll know the transition is complete when you reach for a
              key and the shelf is empty.
            </p>

            <p className="text-xl md:text-2xl font-medium text-foreground border-l-4 border-primary pl-6 italic">
              The most powerful tools are the ones that know what they are
              for.
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
