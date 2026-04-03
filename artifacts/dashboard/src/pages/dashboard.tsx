import { useGetDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: dashboard, isLoading } = useGetDashboard();

  if (isLoading || !dashboard) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.totalCampaigns}</div>
            <p className="text-xs text-muted-foreground">{dashboard.activeCampaigns} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.totalContacts.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.totalMessages.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Delivery Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.messageSummary.deliveryRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{dashboard.messageSummary.readRate.toFixed(1)}% read</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard.recentCampaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent campaigns.</p>
              ) : (
                dashboard.recentCampaigns.map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex flex-col gap-1">
                      <Link href={`/campaigns/${campaign.id}`}>
                        <span className="text-sm font-medium hover:underline cursor-pointer">{campaign.name}</span>
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {new Date(campaign.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <StatusBadge status={campaign.status} />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Failures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard.recentFailures.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent failures.</p>
              ) : (
                dashboard.recentFailures.map((msg) => (
                  <div key={msg.id} className="flex flex-col gap-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{msg.contactName || msg.contactPhone}</span>
                      <StatusBadge status={msg.lastStatus} />
                    </div>
                    <p className="text-xs text-destructive line-clamp-1">{msg.errorMessage}</p>
                    <Link href={`/tracking/messages/${msg.id}`}>
                      <span className="text-xs text-primary hover:underline cursor-pointer">View details</span>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
