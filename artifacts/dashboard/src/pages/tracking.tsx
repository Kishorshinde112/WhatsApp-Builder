import { useState } from "react";
import {
  useGetTrackingOverview,
  useGetMessages,
  getGetMessagesQueryKey,
} from "@workspace/api-client-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Link } from "wouter";
import { Search, Download } from "lucide-react";

export default function Tracking() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data: overview } = useGetTrackingOverview();

  const params = {
    page,
    limit,
    ...(status !== "all" ? { status } : {}),
    ...(search ? { search } : {}),
  };

  const { data: messagesData, isLoading } = useGetMessages({ query: { queryKey: getGetMessagesQueryKey(params) } });

  const messages = Array.isArray(messagesData) ? messagesData : (messagesData as { messages?: unknown[] })?.messages ?? [];
  const total = Array.isArray(messagesData) ? messages.length : (messagesData as { total?: number })?.total ?? messages.length;

  const handleExport = () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const qs = status !== "all" ? `?status=${status}` : "";
    window.location.href = `${base}/api/tracking/export${qs}`;
  };

  const stats = overview ? [
    { label: "Queued", value: overview.queued ?? 0, cls: "text-muted-foreground" },
    { label: "Sent", value: overview.sent ?? 0, cls: "text-blue-600 dark:text-blue-400" },
    { label: "Delivered", value: overview.delivered ?? 0, cls: "text-teal-600 dark:text-teal-400" },
    { label: "Read", value: overview.read ?? 0, cls: "text-green-600 dark:text-green-400" },
    { label: "Failed", value: overview.failed ?? 0, cls: "text-red-500" },
    { label: "No Account", value: overview.noAccount ?? 0, cls: "text-orange-500" },
  ] : [];

  return (
    <div className="space-y-6" data-testid="tracking-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Message Tracking</h1>
        <Button variant="outline" size="sm" onClick={handleExport} data-testid="export-btn">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {overview ? stats.map((s) => (
          <button
            key={s.label}
            onClick={() => setStatus(s.label.toLowerCase().replace(" ", "_"))}
            className={`rounded-md border bg-card p-3 text-left hover:border-primary transition-colors ${
              status === s.label.toLowerCase().replace(" ", "_") ? "border-primary ring-1 ring-primary" : ""
            }`}
            data-testid={`status-stat-${s.label.toLowerCase()}`}
          >
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-xl font-bold tabular-nums ${s.cls}`}>{s.value.toLocaleString()}</p>
          </button>
        )) : (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)
        )}
      </div>

      {/* Delivery rate */}
      {overview && (
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Delivery rate: </span>
            <span className="font-semibold text-teal-600 dark:text-teal-400">{(overview.deliveryRate ?? 0).toFixed(1)}%</span>
          </div>
          <div>
            <span className="text-muted-foreground">Read rate: </span>
            <span className="font-semibold text-green-600 dark:text-green-400">{(overview.readRate ?? 0).toFixed(1)}%</span>
          </div>
          <div>
            <span className="text-muted-foreground">Failure rate: </span>
            <span className="font-semibold text-red-500">{(overview.failureRate ?? 0).toFixed(1)}%</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search contact name or phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            data-testid="message-search"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-44" data-testid="status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="no_account">No Account</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{total.toLocaleString()} message{total !== 1 ? "s" : ""}</span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Retries</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : (messages as Record<string, unknown>[]).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">No messages found.</TableCell>
              </TableRow>
            ) : (
              (messages as Record<string, unknown>[]).map((msg) => (
                <TableRow key={String(msg.id)} data-testid={`message-row-${msg.id}`}>
                  <TableCell className="font-medium">{String(msg.contactName ?? "—")}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{String(msg.contactPhone ?? "")}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <Link href={`/campaigns/${msg.campaignId}`}>
                      <span className="hover:underline cursor-pointer">{String(msg.campaignName ?? msg.campaignId ?? "—")}</span>
                    </Link>
                  </TableCell>
                  <TableCell><StatusBadge status={String(msg.lastStatus ?? "queued")} /></TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{String(msg.retryCount ?? 0)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {msg.updatedAt ? new Date(String(msg.updatedAt)).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Link href={`/tracking/messages/${msg.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid={`view-message-${msg.id}`}>
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > limit && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {Math.ceil(total / limit)}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={(messages as unknown[]).length < limit} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
