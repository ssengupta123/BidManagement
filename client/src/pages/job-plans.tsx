import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Calendar, DollarSign, ClipboardList, Trash2, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import type { JobPlan, Bid } from "@shared/schema";

export default function JobPlans() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [bidId, setBidId] = useState<string>("");
  const [startDate, setStartDate] = useState("");

  const { data: plans, isLoading } = useQuery<JobPlan[]>({ queryKey: ["/api/job-plans"] });
  const { data: bids } = useQuery<Bid[]>({ queryKey: ["/api/bids"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/job-plans", {
        title,
        bidId: bidId && bidId !== "none" ? Number(bidId) : null,
        contractStartDate: startDate ? new Date(startDate).toISOString() : null,
        forecastDate: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-plans"] });
      setOpen(false);
      setTitle("");
      setBidId("");
      setStartDate("");
      toast({ title: "Job plan created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/job-plans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-plans"] });
      toast({ title: "Job plan deleted" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Resource allocation & costing plans</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-new-job-plan">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Job Plan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Job Plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. BCG Business Case - Job Plan"
                  data-testid="input-job-plan-title"
                />
              </div>
              <div>
                <Label>Link to Bid (optional)</Label>
                <Select value={bidId} onValueChange={setBidId}>
                  <SelectTrigger data-testid="select-job-plan-bid">
                    <SelectValue placeholder="Select a bid..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked bid</SelectItem>
                    {bids?.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contract Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-job-plan-start"
                />
              </div>
              <Button
                className="w-full"
                disabled={!title || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                data-testid="button-create-job-plan"
              >
                Create Job Plan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!plans?.length ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No job plans yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map((plan, idx) => {
            const linkedBid = bids?.find((b) => b.id === plan.bidId);
            return (
              <Link key={plan.id} href={`/job-plans/${plan.id}`}>
                <Card className={`animate-fade-in stagger-${Math.min(idx + 1, 6)} hover-elevate cursor-pointer group`} data-testid={`card-job-plan-${plan.id}`}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border border-primary/20 bg-primary/5 text-primary">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold truncate" data-testid={`text-job-plan-title-${plan.id}`}>{plan.title}</h3>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {plan.contractStartDate && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(plan.contractStartDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            )}
                            {linkedBid && (
                              <Badge variant="secondary" className="text-[10px]">{linkedBid.title}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteMutation.mutate(plan.id);
                        }}
                        data-testid={`button-delete-job-plan-${plan.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
