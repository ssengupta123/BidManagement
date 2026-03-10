import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Brain,
  FileText,
  ClipboardList,
  Users,
  Download,
  Send,
  Shield,
  Loader2,
  Clock,
  History,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import type { Bid, User, WorkflowLog } from "@shared/schema";

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

function getStageColor(stage: string) {
  if (stage === "approved") return "text-chart-2";
  if (stage.includes("rejected")) return "text-destructive";
  if (stage === "executive_review") return "text-chart-4";
  if (stage === "writing") return "text-chart-3";
  return "text-primary";
}

function getProgressStepStyle(isCompleted: boolean, isCurrent: boolean, isRejected: boolean) {
  if (isCompleted) return "bg-primary text-primary-foreground shadow-sm shadow-primary/20";
  if (isCurrent && isRejected) return "bg-destructive text-destructive-foreground shadow-sm shadow-destructive/20";
  if (isCurrent) return "bg-primary/15 text-primary ring-2 ring-primary/30";
  return "bg-muted text-muted-foreground/50";
}

function WorkflowStagePanel({ bid, qualifyNotes, setQualifyNotes, execComments, setExecComments, selectedManager, setSelectedManager, selectedWriter, setSelectedWriter, users, casQualifyMutation, csdQualifyMutation, assignWriterMutation, generateResponseMutation, generateDeliveryMutation, generateResourceMutation, generateFinalMutation, submitForReviewMutation, execDecisionMutation, handleDownloadPDF }: Readonly<{
  bid: Bid;
  qualifyNotes: string;
  setQualifyNotes: (v: string) => void;
  execComments: string;
  setExecComments: (v: string) => void;
  selectedManager: string;
  setSelectedManager: (v: string) => void;
  selectedWriter: string;
  setSelectedWriter: (v: string) => void;
  users: User[] | undefined;
  casQualifyMutation: { mutate: (v: boolean) => void; isPending: boolean };
  csdQualifyMutation: { mutate: (v: boolean) => void; isPending: boolean };
  assignWriterMutation: { mutate: () => void; isPending: boolean };
  generateResponseMutation: { mutate: () => void; isPending: boolean };
  generateDeliveryMutation: { mutate: () => void; isPending: boolean };
  generateResourceMutation: { mutate: () => void; isPending: boolean };
  generateFinalMutation: { mutate: () => void; isPending: boolean };
  submitForReviewMutation: { mutate: () => void; isPending: boolean };
  execDecisionMutation: { mutate: (v: boolean) => void; isPending: boolean };
  handleDownloadPDF: () => void;
}>) {
  if (bid.stage === "cas_qualification") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">CAS Team Qualification</CardTitle>
              <p className="text-sm text-muted-foreground">Sales team reviews strategic and commercial fit</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div>
            <Label className="text-sm font-medium">Notes</Label>
            <Textarea value={qualifyNotes} onChange={(e) => setQualifyNotes(e.target.value)} placeholder="Add qualification notes..." className="mt-1.5 min-h-[80px]" data-testid="input-qualify-notes" />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => casQualifyMutation.mutate(true)} disabled={casQualifyMutation.isPending} size="sm" data-testid="button-cas-qualify">
              {casQualifyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1.5" />}
              Qualify
            </Button>
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => casQualifyMutation.mutate(false)} disabled={casQualifyMutation.isPending} size="sm" data-testid="button-cas-reject">
              <XCircle className="h-3.5 w-3.5 mr-1.5" />
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (bid.stage === "csd_qualification") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-chart-2/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-chart-2" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">CSD Team Qualification</CardTitle>
              <p className="text-sm text-muted-foreground">Delivery team assesses feasibility and resource availability</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div>
            <Label className="text-sm font-medium">Notes</Label>
            <Textarea value={qualifyNotes} onChange={(e) => setQualifyNotes(e.target.value)} placeholder="Add qualification notes..." className="mt-1.5 min-h-[80px]" data-testid="input-csd-qualify-notes" />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => csdQualifyMutation.mutate(true)} disabled={csdQualifyMutation.isPending} size="sm" data-testid="button-csd-qualify">
              {csdQualifyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1.5" />}
              Qualify
            </Button>
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => csdQualifyMutation.mutate(false)} disabled={csdQualifyMutation.isPending} size="sm" data-testid="button-csd-reject">
              <XCircle className="h-3.5 w-3.5 mr-1.5" />
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (bid.stage === "bid_manager_review") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Assign Bid Manager & Writer</CardTitle>
              <p className="text-sm text-muted-foreground">Select team members to prepare the response</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Bid Manager</Label>
              <Select value={selectedManager} onValueChange={setSelectedManager}>
                <SelectTrigger data-testid="select-bid-manager" className="mt-1.5">
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  {users?.filter((u) => u.role === "bid_manager" || u.role === "executive").map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Technical Writer</Label>
              <Select value={selectedWriter} onValueChange={setSelectedWriter}>
                <SelectTrigger data-testid="select-writer" className="mt-1.5">
                  <SelectValue placeholder="Select writer" />
                </SelectTrigger>
                <SelectContent>
                  {users?.filter((u) => u.role === "writer" || u.role === "csd_lead").map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={() => assignWriterMutation.mutate()} disabled={!selectedWriter || !selectedManager || assignWriterMutation.isPending} size="sm" data-testid="button-assign">
            {assignWriterMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5 mr-1.5" />}
            Assign & Start Writing
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (bid.stage === "writing") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-chart-3/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-chart-3" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Response Writing</CardTitle>
              <p className="text-sm text-muted-foreground">Generate technical response, delivery plan, and resource plan</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="p-3 rounded-md border border-border/60 hover-elevate cursor-pointer" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!generateResponseMutation.isPending) generateResponseMutation.mutate(); } }} onClick={() => !generateResponseMutation.isPending && generateResponseMutation.mutate()} data-testid="button-gen-response">
              <div className="flex items-center gap-2">
                {generateResponseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <FileText className="h-4 w-4 text-chart-2 shrink-0" />}
                <div>
                  <p className="text-sm font-semibold">Technical Response</p>
                  <p className="text-[13px] text-muted-foreground">{bid.technicalResponse ? "Regenerate" : "Generate"}</p>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-md border border-border/60 hover-elevate cursor-pointer" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!generateDeliveryMutation.isPending) generateDeliveryMutation.mutate(); } }} onClick={() => !generateDeliveryMutation.isPending && generateDeliveryMutation.mutate()} data-testid="button-gen-delivery">
              <div className="flex items-center gap-2">
                {generateDeliveryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <ClipboardList className="h-4 w-4 text-chart-4 shrink-0" />}
                <div>
                  <p className="text-sm font-semibold">Delivery Plan</p>
                  <p className="text-[13px] text-muted-foreground">{bid.deliveryPlan ? "Regenerate" : "Generate"}</p>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-md border border-border/60 hover-elevate cursor-pointer" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!generateResourceMutation.isPending) generateResourceMutation.mutate(); } }} onClick={() => !generateResourceMutation.isPending && generateResourceMutation.mutate()} data-testid="button-gen-resource">
              <div className="flex items-center gap-2">
                {generateResourceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Users className="h-4 w-4 text-chart-5 shrink-0" />}
                <div>
                  <p className="text-sm font-semibold">Resource Plan</p>
                  <p className="text-[13px] text-muted-foreground">{bid.resourcePlan ? "Regenerate" : "Generate"}</p>
                </div>
              </div>
            </div>
          </div>
          <Separator />
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => generateFinalMutation.mutate()} disabled={generateFinalMutation.isPending} variant="outline" size="sm" data-testid="button-compile-final">
              {generateFinalMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
              Compile Final
            </Button>
            <Button onClick={() => submitForReviewMutation.mutate()} disabled={submitForReviewMutation.isPending || !bid.technicalResponse} size="sm" data-testid="button-submit-review">
              {submitForReviewMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              Submit for Review
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (bid.stage === "executive_review") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-chart-4/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-chart-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Executive Review</CardTitle>
              <p className="text-sm text-muted-foreground">Approve for submission or request revisions</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div>
            <Label className="text-sm font-medium">Comments</Label>
            <Textarea value={execComments} onChange={(e) => setExecComments(e.target.value)} placeholder="Add review comments..." className="mt-1.5 min-h-[80px]" data-testid="input-exec-comments" />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => execDecisionMutation.mutate(true)} disabled={execDecisionMutation.isPending} size="sm" data-testid="button-approve">
              {execDecisionMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1.5" />}
              Approve
            </Button>
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => execDecisionMutation.mutate(false)} disabled={execDecisionMutation.isPending} size="sm" data-testid="button-request-revision">
              <XCircle className="h-3.5 w-3.5 mr-1.5" />
              Request Revision
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (bid.stage === "approved") {
    return (
      <div className="text-center py-12">
        <div className="h-16 w-16 rounded-2xl bg-chart-2/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-chart-2" />
        </div>
        <h3 className="text-lg font-bold">Bid Approved</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          This bid has been approved. Download the response for final submission.
        </p>
        <Button className="mt-5" onClick={handleDownloadPDF} data-testid="button-download-final">
          <Download className="h-4 w-4 mr-2" />
          Download Response
        </Button>
      </div>
    );
  }

  if (bid.stage.includes("rejected")) {
    const rejectionStage = bid.stage === "cas_rejected" ? "CAS (Sales)" : "CSD (Delivery)";
    return (
      <div className="text-center py-12">
        <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-lg font-bold">Bid Rejected</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Rejected at the {rejectionStage} stage.
        </p>
      </div>
    );
  }

  return null;
}

export default function BidDetail() {
  const [, params] = useRoute("/bids/:id");
  const bidId = Number(params?.id);
  const { toast } = useToast();
  const [carePrompt, setCarePrompt] = useState("");
  const [qualifyNotes, setQualifyNotes] = useState("");
  const [selectedWriter, setSelectedWriter] = useState("");
  const [selectedManager, setSelectedManager] = useState("");
  const [execComments, setExecComments] = useState("");

  const { data: bid, isLoading } = useQuery<Bid>({
    queryKey: ["/api/bids", bidId],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: logs } = useQuery<WorkflowLog[]>({
    queryKey: ["/api/bids", bidId, "logs"],
  });

  const invalidateBid = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/bids", bidId] });
    queryClient.invalidateQueries({ queryKey: ["/api/bids", bidId, "logs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bids"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
  };

  const careMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/bids/${bidId}/care-assessment`, {
        customPrompt: carePrompt || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateBid();
      toast({ title: "CARE Assessment completed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const casQualifyMutation = useMutation({
    mutationFn: async (qualified: boolean) => {
      const res = await apiRequest("POST", `/api/bids/${bidId}/qualify-cas`, {
        qualified,
        notes: qualifyNotes,
        performedBy: "CAS Team",
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateBid();
      setQualifyNotes("");
      toast({ title: "CAS qualification updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const csdQualifyMutation = useMutation({
    mutationFn: async (qualified: boolean) => {
      const res = await apiRequest("POST", `/api/bids/${bidId}/qualify-csd`, {
        qualified,
        notes: qualifyNotes,
        performedBy: "CSD Team",
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateBid();
      setQualifyNotes("");
      toast({ title: "CSD qualification updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const assignWriterMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/bids/${bidId}/assign-writer`, {
        writerId: Number(selectedWriter),
        bidManagerId: Number(selectedManager),
        performedBy: "Bid Manager",
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateBid();
      toast({ title: "Writer assigned successfully" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const generateResponseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/bids/${bidId}/generate-response`);
      return res.json();
    },
    onSuccess: () => {
      invalidateBid();
      toast({ title: "Technical response generated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const generateDeliveryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/bids/${bidId}/generate-delivery-plan`);
      return res.json();
    },
    onSuccess: () => {
      invalidateBid();
      toast({ title: "Delivery plan generated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const generateResourceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/bids/${bidId}/generate-resource-plan`);
      return res.json();
    },
    onSuccess: () => {
      invalidateBid();
      toast({ title: "Resource plan generated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const submitForReviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/bids/${bidId}/submit-for-review`, {
        performedBy: "Writer",
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateBid();
      toast({ title: "Submitted for executive review" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const execDecisionMutation = useMutation({
    mutationFn: async (approved: boolean) => {
      const res = await apiRequest("POST", `/api/bids/${bidId}/executive-decision`, {
        approved,
        comments: execComments,
        performedBy: "Executive",
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateBid();
      setExecComments("");
      toast({ title: "Executive decision recorded" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const generateFinalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/bids/${bidId}/generate-final`);
      return res.json();
    },
    onSuccess: () => {
      invalidateBid();
      toast({ title: "Final response compiled" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleDownloadPDF = () => {
    if (!bid?.finalResponse && !bid?.technicalResponse) {
      toast({ title: "No response to download", variant: "destructive" });
      return;
    }
    window.open(`/api/bids/${bidId}/download-pdf`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!bid) {
    return (
      <div className="p-6 text-center py-24">
        <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <h3 className="text-base font-semibold">Bid not found</h3>
        <Link href="/bids"><Button variant="outline" className="mt-4">Back to Bids</Button></Link>
      </div>
    );
  }

  const stageOrder = ["cas_qualification", "csd_qualification", "bid_manager_review", "writing", "executive_review", "approved"];
  const stageIndex = stageOrder.indexOf(bid.stage);

  const progressSteps = [
    { label: "CAS", stage: "cas_qualification" },
    { label: "CSD", stage: "csd_qualification" },
    { label: "Manager", stage: "bid_manager_review" },
    { label: "Writing", stage: "writing" },
    { label: "Review", stage: "executive_review" },
    { label: "Approved", stage: "approved" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-start gap-3">
        <Link href="/bids">
          <Button size="icon" variant="ghost" className="shrink-0 mt-0.5" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-tight truncate" data-testid="text-bid-title">{bid.title}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge className={`text-[13px] font-semibold ${getStageColor(bid.stage)} bg-transparent border`} data-testid="badge-current-stage">
              {getStageLabel(bid.stage)}
            </Badge>
            {bid.careScore && (
              <Badge variant="outline" className="text-[13px]" data-testid="badge-care-score">
                <Brain className="h-2.5 w-2.5 mr-1" />
                CARE {bid.careScore.toFixed(1)}/10
              </Badge>
            )}
          </div>
        </div>
        <Button onClick={handleDownloadPDF} disabled={!bid.finalResponse && !bid.technicalResponse} size="sm" className="shrink-0" data-testid="button-download-pdf">
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Download
        </Button>
      </div>

      <div className="bg-card border border-border/60 rounded-xl p-4 sm:p-5">
        <div className="flex items-center gap-0">
          {progressSteps.map((step, idx) => {
            const isCompleted = stageIndex > idx;
            const isCurrent = bid.stage === step.stage;
            const isRejected = bid.stage.includes("rejected");
            const stepStyle = getProgressStepStyle(isCompleted, isCurrent, isRejected);
            return (
              <div key={step.stage} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${stepStyle}`}
                  >
                    {isCompleted ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span className={`text-[13px] mt-1.5 text-center font-medium ${isCurrent ? "text-foreground" : "text-muted-foreground/60"}`}>
                    {step.label}
                  </span>
                </div>
                {idx < progressSteps.length - 1 && (
                  <div className={`h-[2px] flex-1 mx-2 rounded-full transition-all duration-500 ${isCompleted ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Tabs defaultValue="workflow" className="w-full">
        <TabsList className="w-full justify-start h-10 bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="workflow" data-testid="tab-workflow" className="text-sm rounded-md">Workflow</TabsTrigger>
          <TabsTrigger value="care" data-testid="tab-care" className="text-sm rounded-md">CARE</TabsTrigger>
          <TabsTrigger value="response" data-testid="tab-response" className="text-sm rounded-md">Response</TabsTrigger>
          <TabsTrigger value="delivery" data-testid="tab-delivery" className="text-sm rounded-md">Delivery</TabsTrigger>
          <TabsTrigger value="resource" data-testid="tab-resource" className="text-sm rounded-md">Resource</TabsTrigger>
          <TabsTrigger value="final" data-testid="tab-final" className="text-sm rounded-md">Final</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history" className="text-sm rounded-md">History</TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="mt-4">
          <WorkflowStagePanel
            bid={bid}
            qualifyNotes={qualifyNotes}
            setQualifyNotes={setQualifyNotes}
            execComments={execComments}
            setExecComments={setExecComments}
            selectedManager={selectedManager}
            setSelectedManager={setSelectedManager}
            selectedWriter={selectedWriter}
            setSelectedWriter={setSelectedWriter}
            users={users}
            casQualifyMutation={casQualifyMutation}
            csdQualifyMutation={csdQualifyMutation}
            assignWriterMutation={assignWriterMutation}
            generateResponseMutation={generateResponseMutation}
            generateDeliveryMutation={generateDeliveryMutation}
            generateResourceMutation={generateResourceMutation}
            generateFinalMutation={generateFinalMutation}
            submitForReviewMutation={submitForReviewMutation}
            execDecisionMutation={execDecisionMutation}
            handleDownloadPDF={handleDownloadPDF}
          />
        </TabsContent>

        <TabsContent value="care" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">CARE Assessment</CardTitle>
                  <p className="text-sm text-muted-foreground">AI-powered bid evaluation across 4 dimensions</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div>
                <Label className="text-sm font-medium">Custom Prompt (optional)</Label>
                <Textarea
                  value={carePrompt}
                  onChange={(e) => setCarePrompt(e.target.value)}
                  placeholder="Enter additional context for the CARE assessment..."
                  className="mt-1.5 min-h-[80px]"
                  data-testid="input-care-prompt"
                />
              </div>
              <Button onClick={() => careMutation.mutate()} disabled={careMutation.isPending} size="sm" data-testid="button-run-care">
                {careMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                {careMutation.isPending ? "Analyzing..." : "Run Assessment"}
              </Button>

              {(bid.careScore || bid.competitivePosition) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Competitive", abbr: "C", value: bid.competitivePosition, color: "text-primary", bg: "bg-primary/5 border-primary/15" },
                      { label: "Attractiveness", abbr: "A", value: bid.attractiveness, color: "text-chart-2", bg: "bg-chart-2/5 border-chart-2/15" },
                      { label: "Relationship", abbr: "R", value: bid.relationshipStrength, color: "text-chart-4", bg: "bg-chart-4/5 border-chart-4/15" },
                      { label: "Ease", abbr: "E", value: bid.easeOfResponse, color: "text-chart-5", bg: "bg-chart-5/5 border-chart-5/15" },
                    ].map((item) => (
                      <div key={item.label} className={`text-center p-4 rounded-xl border ${item.bg}`} data-testid={`care-${item.abbr.toLowerCase()}`}>
                        <div className={`text-2xl font-bold ${item.color}`}>{item.value?.toFixed(1) || "-"}</div>
                        <div className="text-[13px] text-muted-foreground mt-1 font-medium">{item.label} ({item.abbr})</div>
                      </div>
                    ))}
                  </div>
                  {bid.careScore && (
                    <div className="text-center p-5 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15">
                      <div className="text-3xl font-bold text-primary" data-testid="text-care-overall">{bid.careScore.toFixed(1)}<span className="text-lg font-medium text-muted-foreground">/10</span></div>
                      <div className="text-sm text-muted-foreground mt-1 font-medium">Overall CARE Score</div>
                    </div>
                  )}
                  {bid.careAnalysis && (
                    <div>
                      <Label className="text-sm font-medium">Analysis</Label>
                      <div className="mt-1.5 p-4 rounded-xl bg-muted/30 border border-border/50 text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-care-analysis">
                        {bid.careAnalysis}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="response" className="mt-4">
          <ContentTab
            title="Technical Response"
            icon={<FileText className="h-4 w-4 text-chart-2" />}
            iconBg="bg-chart-2/10"
            content={bid.technicalResponse}
            emptyText="No technical response generated yet. Click Generate to create one using AI."
            onGenerate={() => generateResponseMutation.mutate()}
            isGenerating={generateResponseMutation.isPending}
            hasContent={!!bid.technicalResponse}
            testIdPrefix="response"
          />
        </TabsContent>

        <TabsContent value="delivery" className="mt-4">
          <ContentTab
            title="Delivery Plan"
            icon={<ClipboardList className="h-4 w-4 text-chart-4" />}
            iconBg="bg-chart-4/10"
            content={bid.deliveryPlan}
            emptyText="No delivery plan generated yet. Click Generate to create one."
            onGenerate={() => generateDeliveryMutation.mutate()}
            isGenerating={generateDeliveryMutation.isPending}
            hasContent={!!bid.deliveryPlan}
            testIdPrefix="delivery"
          />
        </TabsContent>

        <TabsContent value="resource" className="mt-4">
          <ContentTab
            title="Resource Plan"
            icon={<Users className="h-4 w-4 text-chart-5" />}
            iconBg="bg-chart-5/10"
            content={bid.resourcePlan}
            emptyText="No resource plan generated yet. Click Generate to create one."
            onGenerate={() => generateResourceMutation.mutate()}
            isGenerating={generateResourceMutation.isPending}
            hasContent={!!bid.resourcePlan}
            testIdPrefix="resource"
          />
        </TabsContent>

        <TabsContent value="final" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">Final Compiled Response</CardTitle>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateFinalMutation.mutate()}
                  disabled={generateFinalMutation.isPending}
                  data-testid="button-compile-final-tab"
                >
                  {generateFinalMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                  Compile
                </Button>
                <Button size="sm" onClick={handleDownloadPDF} disabled={!bid.finalResponse} data-testid="button-download-pdf-tab">
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {bid.finalResponse ? (
                <div className="p-4 rounded-xl bg-muted/20 border border-border/50" data-testid="text-final-response">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{bid.finalResponse}</div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <FileText className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Compile all sections into the final Reason Group template response.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                  <History className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardTitle className="text-sm font-semibold">Workflow History</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {!logs || logs.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No workflow history yet</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-border rounded-full" />
                  <div className="space-y-3">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 relative" data-testid={`log-${log.id}`}>
                        <div className="h-[30px] w-[30px] rounded-full bg-card border-2 border-border flex items-center justify-center shrink-0 z-10">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1 pb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">{log.action}</span>
                            {log.performedBy && (
                              <Badge variant="outline" className="text-[12px] h-4 px-1.5">{log.performedBy}</Badge>
                            )}
                          </div>
                          {log.fromStage && log.toStage && (
                            <p className="text-[13px] text-muted-foreground mt-0.5">
                              {getStageLabel(log.fromStage)} <ArrowRight className="h-2.5 w-2.5 inline mx-0.5" /> {getStageLabel(log.toStage)}
                            </p>
                          )}
                          {log.notes && <p className="text-sm text-muted-foreground mt-1">{log.notes}</p>}
                          <p className="text-[13px] text-muted-foreground/60 mt-1">
                            {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContentTab({
  title,
  icon,
  iconBg,
  content,
  emptyText,
  onGenerate,
  isGenerating,
  hasContent,
  testIdPrefix,
}: Readonly<{
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  content: string | null;
  emptyText: string;
  onGenerate: () => void;
  isGenerating: boolean;
  hasContent: boolean;
  testIdPrefix: string;
}>) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg ${iconBg} flex items-center justify-center`}>
            {icon}
          </div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onGenerate}
          disabled={isGenerating}
          data-testid={`button-gen-${testIdPrefix}-tab`}
        >
          {isGenerating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
          {hasContent ? "Regenerate" : "Generate"}
        </Button>
      </CardHeader>
      <CardContent>
        {content ? (
          <div className="p-4 rounded-xl bg-muted/20 border border-border/50" data-testid={`text-${testIdPrefix}-plan`}>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{content}</div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              {icon}
            </div>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">{emptyText}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
