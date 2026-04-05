import { useState, useEffect } from "react";
import {
  useGetProviders,
  getGetProvidersQueryKey,
  useSaveProviderConfig,
  useTestProvider,
} from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

const PROVIDERS = [
  { value: "mock", label: "Mock (testing)" },
  { value: "green-api", label: "Green API" },
  { value: "evolution-api", label: "Evolution API" },
];

type TestResult = { success: boolean; message: string } | null;

export default function SettingsProviders() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: providers } = useGetProviders();
  const save = useSaveProviderConfig();
  const testProvider = useTestProvider();

  const activeProvider = providers?.[0];

  const [providerName, setProviderName] = useState("mock");
  const [baseUrl, setBaseUrl] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (activeProvider) {
      setProviderName(activeProvider.providerName ?? "mock");
      setBaseUrl(activeProvider.baseUrl ?? "");
      setInstanceId(activeProvider.instanceId ?? "");
      setWebhookSecret("");
      setApiToken("");
    }
  }, [activeProvider]);

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        data: {
          providerName,
          baseUrl: baseUrl || undefined,
          instanceId: instanceId || undefined,
          apiToken: apiToken || undefined,
          webhookSecret: webhookSecret || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetProvidersQueryKey() });
      toast({ title: "Provider configuration saved" });
    } catch {
      toast({ title: "Failed to save configuration", variant: "destructive" });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testProvider.mutateAsync({
        data: { providerName, baseUrl: baseUrl || undefined, instanceId: instanceId || undefined, apiToken: apiToken || undefined },
      });
      setTestResult({ success: true, message: result.message ?? "Connection successful" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setTestResult({ success: false, message: msg });
    }
    setTesting(false);
  };

  return (
    <div className="max-w-xl space-y-6" data-testid="settings-providers-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Provider Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure the WhatsApp message provider for your campaigns.</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Active Provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={providerName} onValueChange={setProviderName}>
              <SelectTrigger data-testid="provider-name-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {providerName !== "mock" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="base-url">Base URL</Label>
                <Input
                  id="base-url"
                  placeholder="https://api.provider.com"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  data-testid="base-url-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instance-id">Instance ID</Label>
                <Input
                  id="instance-id"
                  placeholder="your-instance-id"
                  value={instanceId}
                  onChange={(e) => setInstanceId(e.target.value)}
                  data-testid="instance-id-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-token">API Token</Label>
                <Input
                  id="api-token"
                  type="password"
                  placeholder="••••••••••••"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  data-testid="api-token-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhook-secret">Webhook Secret</Label>
                <Input
                  id="webhook-secret"
                  type="password"
                  placeholder="••••••••••••"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  data-testid="webhook-secret-input"
                />
              </div>
            </>
          )}

          {providerName === "mock" && (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              The mock provider simulates message delivery for testing.
              Messages will progress through queued → sent → delivered → read automatically.
              ~10% of messages will be simulated as failed.
            </div>
          )}

          {testResult && (
            <div className={`flex items-center gap-2 text-sm rounded-md p-3 ${testResult.success ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
              {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleTest} disabled={testing} data-testid="test-connection-btn">
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Test Connection
            </Button>
            <Button onClick={handleSave} disabled={save.isPending} data-testid="save-provider-btn">
              {save.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {activeProvider && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Current Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Provider</span>
              <span className="font-medium">{activeProvider.providerName}</span>
            </div>
            {activeProvider.baseUrl && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base URL</span>
                <span className="font-medium text-right">{activeProvider.baseUrl}</span>
              </div>
            )}
            {activeProvider.instanceId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Instance ID</span>
                <span className="font-medium">{activeProvider.instanceId}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last updated</span>
              <span className="font-medium">{new Date(activeProvider.updatedAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
