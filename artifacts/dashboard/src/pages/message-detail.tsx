import { useRoute } from "wouter";
import {
  useGetMessage,
  getGetMessageQueryKey,
  useRetryMessage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RotateCcw, CheckCircle, Clock, AlertCircle, Send, Package } from "lucide-react";
import { Link } from "wouter";

const statusIcons: Record<string, React.ReactNode> = {
  queued: <Clock className="h-4 w-4 text-muted-foreground" />,
  sent: <Send className="h-4 w-4 text-blue-500" />,
  delivered: <Package className="h-4 w-4 text-teal-500" />,
  read: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <AlertCircle className="h-4 w-4 text-red-500" />,
  noAccount: <AlertCircle className="h-4 w-4 text-orange-500" />,
};

const statusHelp: Record<string, string> = {
  queued: "Message is in the queue, waiting to be sent.",
  sent: "Message was sent to the WhatsApp provider.",
  delivered: "Message was delivered to the recipient's device.",
  read: "Message was read by the recipient.",
  failed: "Message failed to send. You can retry if the error is transient.",
  noAccount: "The recipient does not have a WhatsApp account on this number.",
};

export default function MessageDetail() {
  const [, params] = useRoute("/tracking/messages/:id");
  const id = params ? Number(params.id) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: message, isLoading } = useGetMessage(id, {
    query: { enabled: !!id, queryKey: getGetMessageQueryKey(id) },
  });

  const retry = useRetryMessage();

  const handleRetry = async () => {
    try {
      await retry.mutateAsync({ id });
      toast({ title: "Retry queued", description: "Message will be resent shortly." });
      queryClient.invalidateQueries({ queryKey: getGetMessageQueryKey(id) });
    } catch {
      toast({ title: "Failed to retry message", variant: "destructive" });
    }
  };

  if (isLoading || !message) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const events = message.events ?? [];

  return (
    <div className="space-y-6 max-w-2xl" data-testid="message-detail-page">
      <div className="flex items-center gap-3">
        <Link href="/tracking">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Message Detail</h1>
          <p className="text-xs text-muted-foreground">ID #{message.id}</p>
        </div>
        {message.lastStatus === "failed" && (
          <Button size="sm" onClick={handleRetry} disabled={retry.isPending} data-testid="retry-btn">
            <RotateCcw className="h-4 w-4 mr-2" />
            {retry.isPending ? "Retrying..." : "Retry"}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Contact</p>
              <p className="font-medium">{message.contactName ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="font-medium font-mono">{message.contactPhone ?? message.provider}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Campaign</p>
              <Link href={`/campaigns/${message.campaignId}`}>
                <span className="font-medium text-primary hover:underline cursor-pointer">
                  {message.campaignName ?? `Campaign #${message.campaignId}`}
                </span>
              </Link>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current status</p>
              <StatusBadge status={message.lastStatus} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Provider</p>
              <p className="font-medium">{message.provider}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Retry count</p>
              <p className="font-medium">{message.retryCount}</p>
            </div>
            {message.externalMessageId && (
              <div>
                <p className="text-xs text-muted-foreground">External ID</p>
                <p className="font-mono text-xs text-muted-foreground">{message.externalMessageId}</p>
              </div>
            )}
            {message.errorMessage && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Error</p>
                <p className="text-sm text-destructive">{message.errorMessage}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status explanation */}
      {statusHelp[message.lastStatus] && (
        <div className="flex items-start gap-3 text-sm p-3 rounded-md bg-muted/50 border">
          {statusIcons[message.lastStatus]}
          <p className="text-muted-foreground">{statusHelp[message.lastStatus]}</p>
        </div>
      )}

      {/* Event timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Event Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events recorded yet.</p>
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
              <div className="space-y-4">
                {events.map((event, i) => (
                  <div key={event.id} className="relative" data-testid={`event-${i}`}>
                    <div className="absolute -left-4 top-1 w-2 h-2 rounded-full bg-border ring-2 ring-background" />
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        {statusIcons[event.status] ?? <Clock className="h-4 w-4 text-muted-foreground" />}
                        <div>
                          <p className="text-sm font-medium capitalize">{event.status}</p>
                          {event.description && (
                            <p className="text-xs text-muted-foreground">{event.description}</p>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(event.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
