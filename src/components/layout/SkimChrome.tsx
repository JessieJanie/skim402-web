import { Link } from "wouter";
import { Show, useClerk, useUser } from "@clerk/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function SkimBackground() {
  return <div className="skim-bg" aria-hidden="true" />;
}

function getInitials(name?: string | null, email?: string) {
  if (name) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }
  return email ? email[0].toUpperCase() : "U";
}

export function SkimNav() {
  const { signOut } = useClerk();
  const { user } = useUser();

  return (
    <nav className="skim-nav">
      <Link href="/" className="skim-brand">
        <span className="skim-mark">S</span>
        <span className="skim-wordmark">SKIM</span>
      </Link>
      <div className="skim-navlinks">
        <Link href="/playground">Workbench</Link>
        <Link href="/signals">Signals</Link>
        <Link href="/pricing">Card Pay</Link>
        <Link href="/wallet">Wallet Pay</Link>
        <Link href="/docs">Docs</Link>
        <Show when="signed-in">
          <Link href="/dashboard">Dashboard</Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user?.imageUrl} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {getInitials(user?.fullName, user?.primaryEmailAddress?.emailAddress)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="w-full cursor-pointer">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={() => signOut({ redirectUrl: basePath || "/" })}
              >
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Show>
      </div>
    </nav>
  );
}

export function SkimFooter() {
  return (
    <footer className="skim-footer">
      <Link href="/" aria-label="Skim home">
        <span className="skim-mark">S</span>
      </Link>
      <div className="skim-footer-links">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/aup">Acceptable Use</Link>
        <Link href="/contact">Contact</Link>
        <Show when="signed-out">
          <Link href="/sign-in">Operator sign in</Link>
        </Show>
        <a href="mailto:hello@skim402.com">report an issue</a>
      </div>
    </footer>
  );
}
