import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, FileText, ArrowRight, Brain, Shield, CheckCircle, XCircle, Upload, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Bid } from "@shared/schema";

function getStageLabel(stage: string) {
  const labels: Record<string, string> = {
    cas_qualification: "CAS Qualification",
    csd_qualification: "CSD Qualification",
    bid_manager_review: "Bid Manager Review",
    writing: "Technical Writing",
    executive_review: "Executive Review",
    approved: "Approved",
    cas_rejected: "CAS Rejected",
    csd_rejected: "CSD Rejected",
  };
  return labels[stage] || stage;
}

function getStageIcon(stage: string) {
  if (stage === "approved") return CheckCircle;
  if (stage.includes("rejected")) return XCircle;
  if (stage === "executive_review") return Shield;
  if (stage === "writing") return FileText;
  return Shield;
}

function getStageColor(stage: string) {
  if (stage === "approved") return "bg-chart-2/10 text-chart-2 border-chart-2/20";
  if (stage.includes("rejected")) return "bg-destructive/10 text-destructive border-destructive/20";
  if (stage === "executive_review") return "bg-chart-4/10 text-chart-4 border-chart-4/20";
  if (stage === "writing") return "bg-chart-3/10 text-chart-3 border-chart-3/20";
  if (stage === "csd_qualification") return "bg-chart-5/10 text-chart-5 border-chart-5/20";
  return "bg-primary/10 text-primary border-primary/20";
}

interface ParsedBid {
  title: string;
  opportunityId?: number;
  stage?: string;
  [key: string]: any;
}

function parseCSV(text: string): ParsedBid[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const rawHeaders = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));

  const headerMap: Record<string, string> = {
    title: "title",
    name: "title",
    "bid title": "title",
    "bid name": "title",
    "opportunity id": "opportunityId",
    opportunityid: "opportunityId",
    "opportunity_id": "opportunityId",
    stage: "stage",
    status: "stage",
    "cas qualified": "casQualified",
    casqualified: "casQualified",
    cas_qualified: "casQualified",
    "csd qualified": "csdQualified",
    csdqualified: "csdQualified",
    csd_qualified: "csdQualified",
  };

  const headers = rawHeaders.map((h) => headerMap[h.toLowerCase()] || h);

  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const values = line.match(/("([^"]*?)"|[^,]*)/g)?.map((v) => v.trim().replace(/^"|"$/g, "")) || [];
    const row: any = {};
    headers.forEach((h, i) => {
      const val = values[i] || "";
      if (h === "opportunityId" && val) {
        row[h] = parseInt(val) || undefined;
      } else if (val) {
        row[h] = val;
      }
    });
    return row as ParsedBid;
  }).filter((r) => r.title);
}

function UploadDialog() {
  const [open, setOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedBid[]>([]);
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (data: ParsedBid[]) => {
      const res = await apiRequest("POST", "/api/bids/upload", data);
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bids"] });
      toast({
        title: `${result.created} bid${result.created !== 1 ? "s" : ""} uploaded`,
        description: result.errors?.length > 0 ? `${result.errors.length} row(s) had errors` : undefined,
      });
      setOpen(false);
      setParsedData([]);
      setRawText("");
      setFileName("");
    },
    onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRawText(text);
      setParsedData(parseCSV(text));
    };
    reader.readAsText(file);
  };

  const handlePaste = (text: string) => {
    setRawText(text);
    setFileName("");
    setParsedData(parseCSV(text));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setParsedData([]); setRawText(""); setFileName(""); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="button-upload-bids">
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Upload Bids
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Bids from CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              {fileName ? `Selected: ${fileName}` : "Drop a CSV file or click to browse"}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFile}
              data-testid="input-upload-file"
            />
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} data-testid="button-browse-file">
              Browse Files
            </Button>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Or paste CSV data directly:</p>
            <textarea
              className="w-full h-24 text-xs font-mono p-2 border rounded-md bg-muted/30 resize-none"
              placeholder="title,stage,opportunityId&#10;My First Bid,cas_qualification,1&#10;Another Bid,writing,2"
              value={rawText}
              onChange={(e) => handlePaste(e.target.value)}
              data-testid="textarea-csv-paste"
            />
          </div>

          <div className="bg-muted/30 rounded-md p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Expected columns:</p>
            <p><strong>title</strong> (required) — Bid title or name</p>
            <p><strong>opportunityId</strong> — Link to opportunity ID</p>
            <p><strong>stage</strong> — cas_qualification, csd_qualification, writing, executive_review, approved</p>
          </div>

          {parsedData.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Preview ({parsedData.length} bids)</p>
              <div className="border rounded-md overflow-auto max-h-48">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 border-b">
                      <th className="text-left p-2 font-medium">#</th>
                      <th className="text-left p-2 font-medium">Title</th>
                      <th className="text-left p-2 font-medium">Stage</th>
                      <th className="text-left p-2 font-medium">Opp. ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2 font-medium" data-testid={`preview-title-${i}`}>{row.title}</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-[9px]">{row.stage || "cas_qualification"}</Badge>
                        </td>
                        <td className="p-2 text-muted-foreground">{row.opportunityId || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {parsedData.some((r) => !r.title) && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              Some rows are missing a title and will be skipped
            </div>
          )}

          <Button
            className="w-full"
            disabled={parsedData.length === 0 || uploadMutation.isPending}
            onClick={() => uploadMutation.mutate(parsedData)}
            data-testid="button-confirm-upload"
          >
            {uploadMutation.isPending ? "Uploading..." : `Upload ${parsedData.length} Bid${parsedData.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Bids() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  const { data: bids, isLoading } = useQuery<Bid[]>({
    queryKey: ["/api/bids"],
  });

  const filtered = bids?.filter((bid) => {
    const matchesSearch = bid.title.toLowerCase().includes(search.toLowerCase());
    const matchesStage = stageFilter === "all" || bid.stage === stageFilter;
    return matchesSearch && matchesStage;
  }) || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto">
      <div className="animate-fade-in flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Track and manage all active bids through the workflow</p>
        <UploadDialog />
      </div>

      <div className="flex items-center gap-3 flex-wrap animate-fade-in stagger-1">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bids..."
            className="pl-9 h-10 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-bids"
          />
        </div>
        <Tabs value={stageFilter} onValueChange={setStageFilter}>
          <TabsList className="h-10">
            <TabsTrigger value="all" data-testid="tab-all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="cas_qualification" data-testid="tab-cas" className="text-xs">CAS</TabsTrigger>
            <TabsTrigger value="csd_qualification" data-testid="tab-csd" className="text-xs">CSD</TabsTrigger>
            <TabsTrigger value="writing" data-testid="tab-writing" className="text-xs">Writing</TabsTrigger>
            <TabsTrigger value="executive_review" data-testid="tab-review" className="text-xs">Review</TabsTrigger>
            <TabsTrigger value="approved" data-testid="tab-approved" className="text-xs">Approved</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="animate-fade-in">
          <CardContent className="py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-base font-semibold">No bids found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">Create a bid from an opportunity to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((bid, idx) => {
            const StageIcon = getStageIcon(bid.stage);
            return (
              <Link key={bid.id} href={`/bids/${bid.id}`}>
                <Card className={`animate-fade-in stagger-${Math.min(idx + 1, 6)} hover-elevate cursor-pointer group`} data-testid={`card-bid-${bid.id}`}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${getStageColor(bid.stage)}`}>
                        <StageIcon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm group-hover:text-primary transition-colors" data-testid={`text-bid-title-${bid.id}`}>{bid.title}</h3>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <Badge variant="outline" className={`text-[10px] font-medium border ${getStageColor(bid.stage)}`} data-testid={`badge-stage-${bid.id}`}>
                            {getStageLabel(bid.stage)}
                          </Badge>
                          {bid.careScore && (
                            <span className="flex items-center gap-1">
                              <Brain className="h-3 w-3 text-primary" />
                              <span className="font-medium text-foreground">{bid.careScore.toFixed(1)}</span>/10
                            </span>
                          )}
                          <span>CAS: {bid.casQualified === "qualified" ? "Pass" : bid.casQualified === "rejected" ? "Fail" : "Pending"}</span>
                          <span>CSD: {bid.csdQualified === "qualified" ? "Pass" : bid.csdQualified === "rejected" ? "Fail" : "Pending"}</span>
                        </div>
                      </div>

                      <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
