import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";

import NotFound from "@/pages/not-found";
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
import CardPage from "@/pages/card";
import CardSuccess from "@/pages/card-success";
import CardAccount from "@/pages/card-account";
import AccountRedirect from "@/pages/account";
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
import EditCopy from "@/pages/edit";
import DashboardOverview from "@/pages/dashboard/overview";
import DashboardKeys from "@/pages/dashboard/keys";
import DashboardUsage from "@/pages/dashboard/usage";
import DashboardSettings from "@/pages/dashboard/settings";
import Playground from "@/pages/playground";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(38 92% 50%)",
    colorForeground: "hsl(20 10% 10%)",
    colorMutedForeground: "hsl(20 5% 40%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(40 10% 90%)",
    colorInputForeground: "hsl(20 10% 10%)",
    colorNeutral: "hsl(40 10% 90%)",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-card rounded-2xl w-[440px] max-w-full overflow-hidden border border-border shadow-sm",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-bold font-sans",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-foreground font-medium",
    footerActionLink: "text-primary hover:text-primary/90 transition-colors",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary hover:text-primary/90",
    formFieldSuccessText: "text-primary",
    alertText: "text-foreground",
    logoBox: "",
    logoImage: "",
    socialButtonsBlockButton: "border border-border bg-background hover:bg-muted transition-colors text-foreground",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors border border-primary-border",
    formFieldInput: "bg-background border border-border text-foreground focus:ring-2 focus:ring-ring focus:border-transparent",
    footerAction: "",
    dividerLine: "bg-border",
    alert: "border-border bg-muted text-foreground",
    otpCodeFieldInput: "border-border bg-background text-foreground",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <PublicLayout>
      <div className="flex min-h-[80dvh] items-center justify-center px-4">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </PublicLayout>
  );
}

function SignUpPage() {
  return (
    <PublicLayout>
      <div className="flex min-h-[80dvh] items-center justify-center px-4">
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </PublicLayout>
  );
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function WorkbenchPage() {
  return <Playground />;
}

const queryClient = new QueryClient();

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClientInstance = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClientInstance.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClientInstance]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <ScrollToTop />
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/pricing" component={Pricing} />
            <Route path="/card" component={CardPage} />
            <Route path="/card/success" component={CardSuccess} />
            <Route path="/card/account" component={CardAccount} />
            <Route path="/account" component={AccountRedirect} />
            <Route path="/account/" component={AccountRedirect} />
            <Route path="/docs" component={Docs} />
            <Route path="/signals" component={Signals} />
            <Route path="/contact" component={Contact} />
            <Route path="/faq" component={FAQ} />
            <Route path="/privacy" component={Privacy} />
            <Route path="/terms" component={Terms} />
            <Route path="/aup" component={AUP} />
            <Route path="/wallet" component={WalletPage} />
            <Route path="/playground" component={Playground} />
            <Route path="/playground/" component={Playground} />
            <Route path="/workbench" component={WorkbenchPage} />
            <Route path="/workbench/" component={WorkbenchPage} />
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

            <Route path="/edit">
              <Show when="signed-in">
                <EditCopy />
              </Show>
              <Show when="signed-out">
                <Redirect to="/sign-in" />
              </Show>
            </Route>

            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />

            <Route path="/dashboard">
              <Show when="signed-in">
                <DashboardLayout>
                  <DashboardOverview />
                </DashboardLayout>
              </Show>
              <Show when="signed-out">
                <Redirect to="/sign-in" />
              </Show>
            </Route>

            <Route path="/dashboard/keys">
              <Show when="signed-in">
                <DashboardLayout>
                  <DashboardKeys />
                </DashboardLayout>
              </Show>
              <Show when="signed-out">
                <Redirect to="/sign-in" />
              </Show>
            </Route>

            <Route path="/dashboard/usage">
              <Show when="signed-in">
                <DashboardLayout>
                  <DashboardUsage />
                </DashboardLayout>
              </Show>
              <Show when="signed-out">
                <Redirect to="/sign-in" />
              </Show>
            </Route>

            <Route path="/dashboard/settings">
              <Show when="signed-in">
                <DashboardLayout>
                  <DashboardSettings />
                </DashboardLayout>
              </Show>
              <Show when="signed-out">
                <Redirect to="/sign-in" />
              </Show>
            </Route>

            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
