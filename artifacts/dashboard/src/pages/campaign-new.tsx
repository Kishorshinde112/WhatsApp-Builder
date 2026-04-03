import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetContactLists,
  useCreateCampaign,
  useValidateCampaign,
  useLaunchCampaign,
  getGetCampaignsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check, Play } from "lucide-react";
import { Link } from "wouter";

const STEPS = ["Template", "Audience & Settings", "Review & Launch"];

export default function CampaignNew() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("Olá {{name}}! ");
  const [listId, setListId] = useState<string>("");
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [provider, setProvider] = useState("mock");
  const [dryRun, setDryRun] = useState(false);

  const { data: lists } = useGetContactLists();
  const createCampaign = useCreateCampaign();
  const validate = useValidateCampaign();
  const launch = useLaunchCampaign();

  const highlightTemplate = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (match) => `<mark class="bg-primary/20 text-primary px-0.5 rounded">${match}</mark>`);

  const selectedList = lists?.find((l) => String(l.id) === listId);

  const handleCreate = async () => {
    if (!name.trim() || !template.trim() || !listId) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    try {
      const campaign = await createCampaign.mutateAsync({
        data: {
          name: name.trim(),
          template: template.trim(),
          listId: Number(listId),
          delaySeconds,
          provider,
          dryRun: String(dryRun),
        },
      });
      return campaign;
    } catch {
      toast({ title: "Failed to create campaign", variant: "destructive" });
      return null;
    }
  };

  const handleValidateAndLaunch = async () => {
    const campaign = await handleCreate();
    if (!campaign) return;
    try {
      await validate.mutateAsync({ id: campaign.id });
      await launch.mutateAsync({ id: campaign.id });
      queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey() });
      toast({ title: "Campaign launched!", description: campaign.name });
      navigate(`/campaigns/${campaign.id}`);
    } catch {
      toast({ title: "Failed to launch campaign", variant: "destructive" });
    }
  };

  const handleSaveDraft = async () => {
    const campaign = await handleCreate();
    if (!campaign) return;
    queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey() });
    toast({ title: "Draft saved", description: campaign.name });
    navigate(`/campaigns/${campaign.id}`);
  };

  const canProceed = [
    name.trim() && template.trim(),
    listId,
    true,
  ][step];

  return (
    <div className="max-w-2xl space-y-6" data-testid="campaign-new-page">
      <div className="flex items-center gap-3">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold tracking-tight">New Campaign</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center">
            <button
              className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                i === step
                  ? "text-foreground"
                  : i < step
                  ? "text-primary cursor-pointer"
                  : "text-muted-foreground"
              }`}
              onClick={() => i < step && setStep(i)}
            >
              <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {s}
            </button>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-border mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 0: Template */}
      {step === 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                placeholder="e.g. Black Friday Promotion"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="campaign-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template">
                Message Template <span className="text-destructive">*</span>
                <span className="ml-2 text-xs text-muted-foreground">Use {"{{name}}"} for personalization</span>
              </Label>
              <Textarea
                id="template"
                placeholder="Olá {{name}}! ..."
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={5}
                className="font-mono text-sm"
                data-testid="campaign-template-input"
              />
            </div>
            {template && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Preview</p>
                <div
                  className="text-sm p-3 rounded-md bg-muted border leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: highlightTemplate(template) }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 1: Audience & Settings */}
      {step === 1 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Contact List <span className="text-destructive">*</span></Label>
              <Select value={listId} onValueChange={setListId}>
                <SelectTrigger data-testid="list-select">
                  <SelectValue placeholder="Select a contact list" />
                </SelectTrigger>
                <SelectContent>
                  {lists?.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name} ({l.contactCount ?? 0} contacts)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedList && (
                <p className="text-xs text-muted-foreground">{selectedList.description}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="delay">Delay between messages (seconds)</Label>
              <Input
                id="delay"
                type="number"
                min={0}
                max={60}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="w-32"
                data-testid="delay-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger className="w-48" data-testid="provider-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock">Mock (testing)</SelectItem>
                  <SelectItem value="green-api">Green API</SelectItem>
                  <SelectItem value="evolution-api">Evolution API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch
                id="dry-run"
                checked={dryRun}
                onCheckedChange={setDryRun}
                data-testid="dry-run-switch"
              />
              <Label htmlFor="dry-run" className="cursor-pointer">
                Dry run mode
                <span className="ml-2 text-xs text-muted-foreground">Messages will be simulated, not delivered</span>
              </Label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review */}
      {step === 2 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="font-semibold">Review before launching</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Campaign name</p>
                <p className="font-medium">{name}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Contact list</p>
                <p className="font-medium">{selectedList?.name ?? "—"} ({selectedList?.contactCount ?? 0} contacts)</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Provider</p>
                <p className="font-medium">{provider}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Delay</p>
                <p className="font-medium">{delaySeconds}s between messages</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Mode</p>
                <p className="font-medium">{dryRun ? "Dry run (no delivery)" : "Live"}</p>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Template</p>
              <div
                className="text-sm p-3 rounded-md bg-muted border font-mono leading-relaxed"
                dangerouslySetInnerHTML={{ __html: highlightTemplate(template) }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Sample rendering: {template.replace(/\{\{name\}\}/g, selectedList?.name?.split(" ")[0] ?? "Carlos")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => step > 0 ? setStep(s => s - 1) : navigate("/campaigns")} data-testid="back-btn">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {step === 0 ? "Cancel" : "Back"}
        </Button>
        <div className="flex gap-2">
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed} data-testid="next-step-btn">
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleSaveDraft} disabled={createCampaign.isPending} data-testid="save-draft-btn">
                Save as Draft
              </Button>
              <Button onClick={handleValidateAndLaunch} disabled={createCampaign.isPending || validate.isPending || launch.isPending} data-testid="launch-campaign-btn">
                <Play className="h-4 w-4 mr-2" />
                Validate & Launch
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

