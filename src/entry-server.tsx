import { renderToString } from "react-dom/server";
import { Router as WouterRouter, Switch, Route } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/react";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "@/pages/home";
import Pricing from "@/pages/pricing";
import Docs from "@/pages/docs";
import Signals from "@/pages/signals";
import Contact from "@/pages/contact";
import FAQ from "@/pages/faq";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import AUP from "@/pages/aup";
import WalletPage from "@/pages/wallet";
import ArticlesIndex from "@/pages/articles";
import SanerWayForward from "@/pages/articles/saner-way-forward";
import YourAgentIsNotAUser from "@/pages/articles/your-agent-is-not-a-user";
import AgentWalletSetup from "@/pages/articles/agent-wallet-setup";
import GiveYourAgentWebAccess from "@/pages/articles/give-your-agent-web-access";
import NothingToSteal from "@/pages/articles/nothing-to-steal";
import TheInvisibleEconomy from "@/pages/articles/the-invisible-economy";
import TheLastHumanInTheLoop from "@/pages/articles/the-last-human-in-the-loop";
import SkimOnCloudflareAgents from "@/pages/articles/skim-on-cloudflare-agents";
import SkimOnAwsAgentcore from "@/pages/articles/skim-on-aws-agentcore";
import TheElephantInTheDashboard from "@/pages/articles/the-elephant-in-the-dashboard";
import Audit from "@/pages/audit";
import CardPage from "@/pages/card";
import CardSuccess from "@/pages/card-success";
import CardAccount from "@/pages/card-account";
import Playground from "@/pages/playground";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error(
    "[entry-server] VITE_CLERK_PUBLISHABLE_KEY must be set at build time for prerendering"
  );
}

function ServerApp({ path }: { path: string }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  return (
    <WouterRouter ssrPath={path}>
      <ClerkProvider publishableKey={clerkPubKey}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/pricing" component={Pricing} />
              <Route path="/docs" component={Docs} />
              <Route path="/signals" component={Signals} />
              <Route path="/contact" component={Contact} />
              <Route path="/faq" component={FAQ} />
              <Route path="/privacy" component={Privacy} />
              <Route path="/terms" component={Terms} />
              <Route path="/aup" component={AUP} />
              <Route path="/wallet" component={WalletPage} />
              <Route path="/playground" component={Playground} />
              <Route path="/workbench" component={Playground} />
              <Route path="/articles" component={ArticlesIndex} />
              <Route path="/articles/saner-way-forward" component={SanerWayForward} />
              <Route path="/articles/your-agent-is-not-a-user" component={YourAgentIsNotAUser} />
              <Route path="/articles/agent-wallet-setup" component={AgentWalletSetup} />
              <Route path="/articles/give-your-agent-web-access" component={GiveYourAgentWebAccess} />
              <Route path="/articles/nothing-to-steal" component={NothingToSteal} />
              <Route path="/articles/the-invisible-economy" component={TheInvisibleEconomy} />
              <Route path="/articles/the-last-human-in-the-loop" component={TheLastHumanInTheLoop} />
              <Route path="/articles/skim-on-cloudflare-agents" component={SkimOnCloudflareAgents} />
              <Route path="/articles/skim-on-aws-agentcore" component={SkimOnAwsAgentcore} />
              <Route path="/articles/the-elephant-in-the-dashboard" component={TheElephantInTheDashboard} />
              <Route path="/audit" component={Audit} />
              <Route path="/card" component={CardPage} />
              <Route path="/card/success" component={CardSuccess} />
              <Route path="/card/account" component={CardAccount} />
            </Switch>
          </TooltipProvider>
        </QueryClientProvider>
      </ClerkProvider>
    </WouterRouter>
  );
}

export function render(path: string): string {
  return renderToString(<ServerApp path={path} />);
}
