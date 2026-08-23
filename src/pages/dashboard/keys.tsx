import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import { Copy, Check, KeyRound, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  useListApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
  getListApiKeysQueryKey,
} from "@workspace/api-client-react";
import type { ApiKey, ApiKeyWithSecret } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function DashboardKeys() {
  const qc = useQueryClient();
  const list = useListApiKeys();
  const createMut = useCreateApiKey();
  const deleteMut = useDeleteApiKey();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<ApiKeyWithSecret | null>(null);
  const [copied, setCopied] = useState(false);
  const [toDelete, setToDelete] = useState<ApiKey | null>(null);

  const onCreate = () => {
    if (!name.trim()) return;
    createMut.mutate(
      { data: { name: name.trim() } },
      {
        onSuccess: (data) => {
          setRevealed(data);
          setName("");
          setCreateOpen(false);
          qc.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
          toast.success("API key created");
        },
        onError: () => toast.error("Could not create key. Try again."),
      }
    );
  };

  const onDelete = () => {
    if (!toDelete) return;
    deleteMut.mutate(
      { id: toDelete.id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
          toast.success(`Revoked "${toDelete.name}"`);
          setToDelete(null);
        },
        onError: () => toast.error("Could not revoke key."),
      }
    );
  };

  const copySecret = () => {
    if (!revealed) return;
    void navigator.clipboard.writeText(revealed.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const keys = list.data ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground mt-1">
            Create keys for your apps and rotate them anytime. Treat keys like passwords.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New key
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center px-6 py-20">
              <div className="rounded-full bg-primary/10 p-3 mb-4">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No API keys yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Create your first key to start making requests to the Skim API.
              </p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first key
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground bg-muted/30">
                <div className="col-span-4">Name</div>
                <div className="col-span-3">Key</div>
                <div className="col-span-2">Requests</div>
                <div className="col-span-2">Last used</div>
                <div className="col-span-1"></div>
              </div>
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="grid grid-cols-12 gap-4 px-6 py-4 items-center text-sm hover:bg-muted/20 transition-colors"
                >
                  <div className="col-span-4 min-w-0">
                    <div className="font-medium truncate">{k.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Created {format(parseISO(k.createdAt), "MMM d, yyyy")}
                    </div>
                  </div>
                  <div className="col-span-3 font-mono text-xs text-muted-foreground truncate">
                    {k.prefix}…
                  </div>
                  <div className="col-span-2 text-muted-foreground">
                    {k.requestCount.toLocaleString()}
                  </div>
                  <div className="col-span-2 text-muted-foreground text-xs">
                    {k.lastUsedAt
                      ? formatDistanceToNow(parseISO(k.lastUsedAt), { addSuffix: true })
                      : "Never"}
                  </div>
                  <div className="col-span-1 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setToDelete(k)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Give your key a memorable name — usually the app or environment that will use it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="key-name">Name</Label>
            <Input
              id="key-name"
              placeholder="e.g. Production server"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onCreate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onCreate} disabled={!name.trim() || createMut.isPending}>
              {createMut.isPending ? "Creating…" : "Create key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal-once dialog */}
      <Dialog open={!!revealed} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your new API key</DialogTitle>
            <DialogDescription>
              Copy it now — we hash keys in the database, so you won't be able to see this secret again.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
            <p className="text-amber-900 dark:text-amber-200">
              This is the only time you'll see the full key. Store it in a secret manager.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted rounded-md px-3 py-2.5 font-mono text-xs break-all">
              {revealed?.key}
            </code>
            <Button size="icon" variant="outline" onClick={copySecret}>
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Badge variant="outline" className="self-start font-mono text-xs">
            {revealed?.name}
          </Badge>
          <DialogFooter>
            <Button onClick={() => setRevealed(null)}>I've saved it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{toDelete?.name}</span> will stop working immediately and any
              app using it will start getting 401 errors. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? "Revoking…" : "Revoke key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
