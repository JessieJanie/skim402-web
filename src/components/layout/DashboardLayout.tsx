import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { LayoutDashboard, Key, Activity, Settings, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const sidebarLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/keys", label: "API Keys", icon: Key },
  { href: "/dashboard/usage", label: "Usage", icon: Activity },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email ? email[0].toUpperCase() : "U";
  };

  const UserNav = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring text-left p-1 w-full hover:bg-accent transition-colors">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.imageUrl} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {getInitials(user?.fullName, user?.primaryEmailAddress?.emailAddress)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden hidden md:block">
            <p className="truncate text-sm font-medium leading-none">
              {user?.fullName || user?.primaryEmailAddress?.emailAddress?.split('@')[0]}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" side="top" sideOffset={8}>
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            {user?.fullName && <p className="font-medium text-sm">{user.fullName}</p>}
            {user?.primaryEmailAddress && (
              <p className="w-[200px] truncate text-xs text-muted-foreground">
                {user.primaryEmailAddress.emailAddress}
              </p>
            )}
          </div>
        </div>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings" className="w-full cursor-pointer">
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem 
          className="text-destructive focus:text-destructive cursor-pointer"
          onClick={() => signOut({ redirectUrl: basePath || "/" })}
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
        <Link href="/dashboard" className="flex items-center">
          <img src="/logo.svg" alt="Skim" className="h-8 w-auto" />
        </Link>
        <UserNav />
      </header>

      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card">
        <div className="p-6 flex items-center">
          <img src="/logo.svg" alt="Skim" className="h-9 w-auto" />
        </div>
        <nav className="flex-1 px-4 py-2 space-y-1">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href;
            return (
              <Link 
                key={link.href} 
                href={link.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border flex flex-col gap-4">
          <Link href="/docs" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
            <BookOpen className="h-4 w-4" />
            Documentation
          </Link>
          <div className="px-1">
            <UserNav />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 md:p-10 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
