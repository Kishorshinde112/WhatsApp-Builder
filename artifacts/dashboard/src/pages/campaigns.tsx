import { useState } from "react";
import { Link } from "wouter";
import {
  useGetCampaigns,
  getGetCampaignsQueryKey,
  useLaunchCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useCancelCampaign,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Play, Pause, RotateCcw, XCircle, ChevronRight } from "lucide-react";

type CampaignStatus = "all" | "draft" | "validating" | "ready" | "running" | "paused" | "completed" | "failed" | "cancelled";

export default function Campaigns() {
  const [status, setStatus] = useState<CampaignStatus>("all");
  const [confirmAction, setConfirmAction] = useState<{ type: string; id: number; name: string } | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params = status !== "all" ? { status } : {};
  const { data: campaigns, isLoading } = useGetCampaigns({ query: { queryKey: getGetCampaignsQueryKey(params) } });

  const launch = useLaunchCampaign();
  const pause = usePauseCampaign();
  const resume = useResumeCampaign();
  const cancel = useCancelCampaign();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey(params) });

  const handleAction = async () => {
    if (!confirmAction) return;
    const { type, id, name } = confirmAction;
    try {
      if (type === "launch") await launch.mutateAsync({ id });
      if (type === "pause") await pause.mutateAsync({ id });
      if (type === "resume") await resume.mutateAsync({ id });
      if (type === "cancel") await cancel.mutateAsync({ id });
      toast({ title: `Campaign ${type}ed`, description: name });
      invalidate();
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    }
    setConfirmAction(null);
  };

  const rawCampaigns = campaigns as unknown;
  const list: Array<Record<string, unknown>> = Array.isArray(rawCampaigns)
    ? rawCampaigns
    : ((rawCampaigns as Record<string, unknown>)?.campaigns as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="space-y-6" data-testid="campaigns-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
        <Link href="/campaigns/new">
          <Button size="sm" data-testid="new-campaign-btn">
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <Select value={status} onValueChange={(v) => setStatus(v as CampaignStatus)}>
          <SelectTrigger className="w-44" data-testid="status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="validating">Validating</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{list.length} campaign{list.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Sent</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="text-right">Read</TableHead>
              <TableHead className="text-right">Failed</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                  No campaigns found.{" "}
                  <Link href="/campaigns/new">
                    <span className="text-primary hover:underline cursor-pointer">Create one</span>
                  </Link>
                </TableCell>
              </TableRow>
            ) : (
              list.map((c) => {
                const campaign = c as {
                  id: number; name: string; status: string; dryRun: string;
                  totalContacts: number; sentCount: number; deliveredCount: number;
                  readCount: number; failedCount: number; createdAt: string;
                };
                return (
                <TableRow key={campaign.id} data-testid={`campaign-row-${campaign.id}`}>
                  <TableCell className="font-medium">
                    <Link href={`/campaigns/${campaign.id}`}>
                      <span className="hover:underline cursor-pointer text-foreground">{campaign.name}</span>
                    </Link>
                    {campaign.dryRun === "true" && (
                      <span className="ml-2 text-xs text-muted-foreground">(dry run)</span>
                    )}
                  </TableCell>
                  <TableCell><StatusBadge status={campaign.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{campaign.totalContacts ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums text-blue-600 dark:text-blue-400">{campaign.sentCount ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums text-teal-600 dark:text-teal-400">{campaign.deliveredCount ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums text-green-600 dark:text-green-400">{campaign.readCount ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-500">{campaign.failedCount ?? 0}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {campaign.status === "ready" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Launch" data-testid={`launch-${campaign.id}`}
                          onClick={() => setConfirmAction({ type: "launch", id: campaign.id, name: campaign.name })}>
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {campaign.status === "running" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Pause" data-testid={`pause-${campaign.id}`}
                          onClick={() => setConfirmAction({ type: "pause", id: campaign.id, name: campaign.name })}>
                          <Pause className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {campaign.status === "paused" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Resume" data-testid={`resume-${campaign.id}`}
                          onClick={() => setConfirmAction({ type: "resume", id: campaign.id, name: campaign.name })}>
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {(campaign.status === "running" || campaign.status === "paused") && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Cancel" data-testid={`cancel-${campaign.id}`}
                          onClick={() => setConfirmAction({ type: "cancel", id: campaign.id, name: campaign.name })}>
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Link href={`/campaigns/${campaign.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              );})
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {confirmAction?.type}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmAction?.type} campaign "{confirmAction?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAction} data-testid="confirm-action-btn">Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
