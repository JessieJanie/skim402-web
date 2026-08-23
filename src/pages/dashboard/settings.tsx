import { Link } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { ArrowUpRight, LogOut } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function DashboardSettings() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const me = useGetMe();

  const initials = (() => {
    if (user?.fullName) {
      return user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    const email = user?.primaryEmailAddress?.emailAddress;
    return email ? email[0].toUpperCase() : "U";
  })();

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and plan.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {!isLoaded ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={user?.imageUrl} />
                <AvatarFallback className="bg-primary/10 text-primary text-base">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {user?.fullName ?? user?.primaryEmailAddress?.emailAddress?.split("@")[0]}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Plan</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/pricing">
              Manage plan <ArrowUpRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {me.isLoading ? (
            <Skeleton className="h-6 w-40" />
          ) : (
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="capitalize text-sm py-1.5 px-3">
                {me.data?.planTier ?? "free"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {(me.data?.monthlyQuota ?? 1000).toLocaleString()} requests per month
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
            className="text-destructive hover:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
