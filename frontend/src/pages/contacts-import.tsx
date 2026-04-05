import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useGetContactLists } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

type PreviewData = {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
};

type ImportResult = {
  importedRows: number;
  duplicateRows: number;
  invalidRows: number;
  errors: Array<{ row: number; error: string }>;
};

export default function ContactsImport() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "mapping" | "result">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [listId, setListId] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { data: lists } = useGetContactLists();

  const requiredFields = ["phone"];
  const optionalFields = ["name", "email"];
  const allFields = [...requiredFields, ...optionalFields];

  const handleFileSelect = async (f: File) => {
    setFile(f);
    const formData = new FormData();
    formData.append("file", f);

    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/api/contacts/import/preview`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Preview failed");
      const data = await res.json();
      setPreview(data);

      // Auto-map columns
      const autoMap: Record<string, string> = {};
      for (const field of allFields) {
        const match = data.headers.find(
          (h: string) =>
            h.toLowerCase() === field ||
            h.toLowerCase().includes(field) ||
            (field === "phone" && (h.toLowerCase().includes("tel") || h.toLowerCase().includes("fone") || h.toLowerCase().includes("celular"))) ||
            (field === "name" && h.toLowerCase().includes("nome"))
        );
        if (match) autoMap[field] = match;
      }
      setMapping(autoMap);
      setStep("mapping");
    } catch {
      toast({ title: "Failed to preview file", description: "Make sure it's a valid CSV", variant: "destructive" });
    }
  };

  const handleImport = async () => {
    if (!file || !mapping.phone) {
      toast({ title: "Phone column mapping is required", variant: "destructive" });
      return;
    }
    setImporting(true);
    const reversedMapping: Record<string, string> = {};
    for (const [field, csvCol] of Object.entries(mapping)) {
      if (csvCol) reversedMapping[csvCol] = field;
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("columnMapping", JSON.stringify(reversedMapping));
    if (listId) formData.append("listId", listId);
    formData.append("skipDuplicates", String(skipDuplicates));

    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/api/contacts/import`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Import failed");
      const data = await res.json();
      setResult({
        importedRows: data.importedRows ?? 0,
        duplicateRows: data.duplicateRows ?? 0,
        invalidRows: data.invalidRows ?? 0,
        errors: data.errors ?? [],
      });
      setStep("result");
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    }
    setImporting(false);
  };

  return (
    <div className="max-w-2xl space-y-6" data-testid="contacts-import-page">
      <div className="flex items-center gap-3">
        <Link href="/contacts">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold tracking-tight">Import Contacts from CSV</h1>
      </div>

      {/* Upload step */}
      {step === "upload" && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              data-testid="file-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
            <div
              className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileRef.current?.click()}
              data-testid="upload-area"
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Click to upload a CSV file</p>
              <p className="text-xs text-muted-foreground mt-1">Supports comma-separated (.csv) files</p>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Expected CSV format:</p>
              <p>name, phone, email (headers in first row)</p>
              <p>Phone numbers can include country code or just the local number (Brazilian format auto-detected)</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mapping step */}
      {step === "mapping" && preview && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{file?.name}</span>
                <span className="text-xs text-muted-foreground">— {preview.totalRows} rows</span>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">Map CSV columns to contact fields</p>
                {allFields.map((field) => (
                  <div key={field} className="flex items-center gap-3">
                    <Label className="w-24 text-right text-sm">
                      {field}
                      {requiredFields.includes(field) && <span className="text-destructive ml-0.5">*</span>}
                    </Label>
                    <Select
                      value={mapping[field] ?? ""}
                      onValueChange={(v) => setMapping(m => v === "__none__" ? { ...m, [field]: "" } : { ...m, [field]: v })}
                    >
                      <SelectTrigger className="flex-1" data-testid={`map-${field}`}>
                        <SelectValue placeholder={`Select column for ${field}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— skip —</SelectItem>
                        {preview.headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-2 border-t">
                <div className="space-y-2">
                  <Label>Add to contact list (optional)</Label>
                  <Select value={listId} onValueChange={setListId}>
                    <SelectTrigger data-testid="import-list-select">
                      <SelectValue placeholder="No list assignment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No list</SelectItem>
                      {lists?.map((l) => (
                        <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="skip-dup" checked={skipDuplicates} onCheckedChange={setSkipDuplicates} data-testid="skip-duplicates-switch" />
                  <Label htmlFor="skip-dup" className="cursor-pointer text-sm">Skip duplicate phone numbers</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview table */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground font-medium mb-3">Preview (first {Math.min(10, preview.rows.length)} rows)</p>
              <div className="overflow-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr>
                      {preview.headers.map((h) => (
                        <th key={h} className="text-left font-medium text-muted-foreground pb-2 pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t">
                        {preview.headers.map((h) => (
                          <td key={h} className="py-1.5 pr-4 text-muted-foreground">{row[h] ?? ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
            <Button
              onClick={handleImport}
              disabled={importing || !mapping.phone}
              data-testid="import-submit-btn"
            >
              {importing ? "Importing..." : `Import ${preview.totalRows} contacts`}
            </Button>
          </div>
        </div>
      )}

      {/* Result step */}
      {step === "result" && result && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <h2 className="text-lg font-semibold">Import complete</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md bg-muted p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{result.importedRows}</p>
                <p className="text-xs text-muted-foreground">Imported</p>
              </div>
              <div className="rounded-md bg-muted p-3 text-center">
                <p className="text-2xl font-bold text-muted-foreground">{result.duplicateRows}</p>
                <p className="text-xs text-muted-foreground">Skipped (duplicates)</p>
              </div>
              <div className="rounded-md bg-muted p-3 text-center">
                <p className="text-2xl font-bold text-red-500">{result.invalidRows}</p>
                <p className="text-xs text-muted-foreground">Invalid</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Rows with errors:</span>
                </div>
                <div className="rounded-md bg-destructive/10 p-3 space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <p key={i} className="text-xs text-destructive">Row {e.row}: {e.error}</p>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setStep("upload"); setFile(null); setPreview(null); setResult(null); }}>
                Import another file
              </Button>
              <Button onClick={() => navigate("/contacts")} data-testid="go-to-contacts-btn">
                View contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
