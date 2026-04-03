import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetCampaign,
  getGetCampaignQueryKey,
  useGetCampaignReport,
  getGetCampaignReportQueryKey,
  useLaunchCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useCancelCampaign,
  useValidateCampaign,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
import { ArrowLeft, Play, Pause, RotateCcw, XCircle, CheckCircle, Search } from "lucide-react";
import { Link } from "wouter";

export default function CampaignDetail() {
  const [, params] = useRoute("/campaigns/:id");
  const [, navigate] = useLocation();
  const id = params ? Number(params.id) : 0;

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaign, isLoading: campaignLoading } = useGetCampaign(id, {
    query: { enabled: !!id, queryKey: getGetCampaignQueryKey(id) },
  });

  const reportParams = statusFilter !== "all" ? { status: statusFilter, page, limit: 20 } : { page, limit: 20 };
  const { data: report, isLoading: reportLoading } = useGetCampaignReport(id, reportParams, {
    query: { enabled: !!id, queryKey: getGetCampaignReportQueryKey(id, reportParams) },
  });

  const validate = useValidateCampaign();
  const launch = useLaunchCampaign();
  const pause = usePauseCampaign();
  const resume = useResumeCampaign();
  const cancel = useCancelCampaign();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getGetCampaignReportQueryKey(id, reportParams) });
  };

  const handleAction = async (action: string) => {
    try {
      if (action === "validate") await validate.mutateAsync({ id });
      if (action === "launch") await launch.mutateAsync({ id });
      if (action === "pause") await pause.mutateAsync({ id });
      if (action === "resume") await resume.mutateAsync({ id });
      if (action === "cancel") { await cancel.mutateAsync({ id }); navigate("/campaigns"); return; }
      toast({ title: `Campaign ${action}d successfully` });
      invalidate();
    } catch {
      toast({ title: `Failed to ${action} campaign`, variant: "destructive" });
    }
    setConfirmAction(null);
  };

  if (campaignLoading || !campaign) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const contacts = report?.contacts ?? [];
  const filtered = search
    ? contacts.filter((c) =>
        (c.contactName ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (c.contactPhone ?? "").includes(search)
      )
    : contacts;

  const stats = [
    { label: "Total", value: campaign.totalContacts ?? 0, cls: "" },
    { label: "Queued", value: campaign.queuedCount ?? 0, cls: "text-muted-foreground" },
    { label: "Sent", value: campaign.sentCount ?? 0, cls: "text-blue-600 dark:text-blue-400" },
    { label: "Delivered", value: campaign.deliveredCount ?? 0, cls: "text-teal-600 dark:text-teal-400" },
    { label: "Read", value: campaign.readCount ?? 0, cls: "text-green-600 dark:text-green-400" },
    { label: "Failed", value: campaign.failedCount ?? 0, cls: "text-red-500" },
    { label: "No Account", value: campaign.noAccountCount ?? 0, cls: "text-orange-500" },
  ];

  return (
    <div className="space-y-6" data-testid="campaign-detail-page">
      <div className="flex items-center gap-3">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">{campaign.name}</h1>
            <StatusBadge status={campaign.status} />
            {campaign.dryRun === "true" && (
              <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded font-medium">DRY RUN</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Provider: {campaign.provider} · Delay: {campaign.delaySeconds}s
            {campaign.startedAt && ` · Started: ${new Date(campaign.startedAt).toLocaleString()}`}
            {campaign.finishedAt && ` · Finished: ${new Date(campaign.finishedAt).toLocaleString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === "draft" && (
            <Button size="sm" variant="outline" onClick={() => handleAction("validate")} data-testid="validate-btn">
              <CheckCircle className="h-3.5 w-3.5 mr-2" />
              Validate
            </Button>
          )}
          {campaign.status === "ready" && (
            <Button size="sm" onClick={() => setConfirmAction("launch")} data-testid="launch-btn">
              <Play className="h-3.5 w-3.5 mr-2" />
              Launch
            </Button>
          )}
          {campaign.status === "running" && (
            <Button size="sm" variant="outline" onClick={() => setConfirmAction("pause")} data-testid="pause-btn">
              <Pause className="h-3.5 w-3.5 mr-2" />
              Pause
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button size="sm" onClick={() => setConfirmAction("resume")} data-testid="resume-btn">
              <RotateCcw className="h-3.5 w-3.5 mr-2" />
              Resume
            </Button>
          )}
          {(campaign.status === "running" || campaign.status === "paused") && (
            <Button size="sm" variant="destructive" onClick={() => setConfirmAction("cancel")} data-testid="cancel-btn">
              <XCircle className="h-3.5 w-3.5 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-card p-4">
        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Template</p>
        <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{campaign.template}</p>
      </div>

      <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
        {stats.map((s) => (
          <Card key={s.label} className="p-0">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold tabular-nums ${s.cls}`}>{s.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="contact-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="noAccount">No Account</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-10">No contacts match the filter.</TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id} data-testid={`report-row-${c.id}`}>
                    <TableCell className="font-medium">{c.contactName ?? "-"}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{c.contactPhone}</TableCell>
                    <TableCell><StatusBadge status={c.status ?? "queued"} /></TableCell>
                    <TableCell>
                      {c.sentAt ? (
                        <Link href={`/tracking?search=${encodeURIComponent(c.contactPhone)}`}>
                          <span className="text-xs text-primary hover:underline cursor-pointer">View in tracking</span>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not sent yet</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {(report?.total ?? 0) > 20 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing {filtered.length} of {report?.total ?? 0}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={contacts.length < 20} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {confirmAction}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmAction} campaign "{campaign.name}"?
              {confirmAction === "cancel" && " This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmAction && handleAction(confirmAction)}
              className={confirmAction === "cancel" ? "bg-destructive hover:bg-destructive/90" : ""}
              data-testid="confirm-action-btn"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
