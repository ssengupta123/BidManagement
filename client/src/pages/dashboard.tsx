import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, FileText, Clock, CheckCircle, Shield, XCircle, Brain, CalendarDays, DollarSign } from "lucide-react";
import { Link } from "wouter";
import type { Bid, Opportunity } from "@shared/schema";

const kanbanStages = [
  { key: "cas_qualification", label: "CAS Qualification", shortLabel: "CAS", description: "Sales team review", icon: Shield, color: "border-t-chart-4", dotColor: "bg-chart-4", headerBg: "bg-chart-4/5" },
  { key: "csd_qualification", label: "CSD Qualification", shortLabel: "CSD", description: "Delivery feasibility", icon: Shield, color: "border-t-chart-5", dotColor: "bg-chart-5", headerBg: "bg-chart-5/5" },
  { key: "writing", label: "Writing", shortLabel: "Writing", description: "Response creation", icon: FileText, color: "border-t-chart-3", dotColor: "bg-chart-3", headerBg: "bg-chart-3/5" },
  { key: "executive_review", label: "Exec Review", shortLabel: "Review", description: "Final approval", icon: Clock, color: "border-t-chart-4", dotColor: "bg-chart-4", headerBg: "bg-chart-4/5" },
  { key: "approved", label: "Approved", shortLabel: "Done", description: "Ready to submit", icon: CheckCircle, color: "border-t-chart-2", dotColor: "bg-chart-2", headerBg: "bg-chart-2/5" },
];

function formatValue(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function getDaysUntilDue(dueDate: string | Date | null): { label: string; urgent: boolean } | null {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, urgent: true };
  if (diffDays === 0) return { label: "Due today", urgent: true };
  if (diffDays <= 7) return { label: `${diffDays}d left`, urgent: true };
  return { label: `${diffDays}d left`, urgent: false };
}

function getWritingProgress(bid: Bid): { done: number; total: number; steps: { label: string; complete: boolean }[] } {
  const steps = [
    { label: "CARE", complete: !!bid.careAnalysis },
    { label: "Tech", complete: !!bid.technicalResponse },
    { label: "Delivery", complete: !!bid.deliveryPlan },
    { label: "Resource", complete: !!bid.resourcePlan },
  ];
  return { done: steps.filter((s) => s.complete).length, total: steps.length, steps };
}

function BidCard({ bid, opp, stageKey }: { bid: Bid; opp?: Opportunity; stageKey: string }) {
  const dueInfo = getDaysUntilDue(opp?.dueDate || null);
  const isWriting = stageKey === "writing";
  const progress = isWriting ? getWritingProgress(bid) : null;

  return (
    <Link href={`/bids/${bid.id}`}>
      <Card className="hover-elevate cursor-pointer group" data-testid={`workflow-bid-${bid.id}`}>
        <CardContent className="p-3">
          <p className="text-sm font-medium leading-tight break-words group-hover:text-primary transition-colors" data-testid={`text-bid-title-${bid.id}`}>{bid.title}</p>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {opp?.value && (
              <span className="flex items-center gap-0.5 text-[13px] font-semibold text-chart-2" data-testid={`text-bid-value-${bid.id}`}>
                <DollarSign className="h-2.5 w-2.5" />
                {formatValue(opp.value)}
              </span>
            )}
            {bid.careScore && (
              <span className="flex items-center gap-0.5 text-[13px] text-muted-foreground">
                <Brain className="h-2.5 w-2.5 text-primary" />
                {bid.careScore.toFixed(1)}
              </span>
            )}
            {bid.executiveApproval === "pending" && stageKey === "executive_review" && (
              <Badge variant="outline" className="text-[12px] h-4 px-1 border-chart-4/30 text-chart-4">Pending</Badge>
            )}
          </div>

          {dueInfo && (
            <div className={`flex items-center gap-1 mt-1.5 text-[13px] ${dueInfo.urgent ? "text-destructive font-medium" : "text-muted-foreground"}`} data-testid={`text-bid-due-${bid.id}`}>
              <CalendarDays className="h-2.5 w-2.5" />
              {dueInfo.label}
            </div>
          )}

          {progress && (
            <div className="mt-2 space-y-1" data-testid={`progress-writing-${bid.id}`}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground font-medium">Progress</span>
                <span className="text-[12px] text-muted-foreground">{progress.done}/{progress.total}</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-chart-3 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              <div className="flex gap-1">
                {progress.steps.map((step) => (
                  <span
                    key={step.label}
                    className={`text-[13px] px-1 py-0.5 rounded ${step.complete ? "bg-chart-3/15 text-chart-3 font-medium" : "bg-muted text-muted-foreground/50"}`}
                  >
                    {step.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalOpportunities: number;
    activeBids: number;
    pendingReview: number;
    approved: number;
  }>({ queryKey: ["/api/dashboard/stats"] });

  const { data: bids, isLoading: bidsLoading } = useQuery<Bid[]>({
    queryKey: ["/api/bids"],
  });

  const { data: opportunities } = useQuery<Opportunity[]>({
    queryKey: ["/api/opportunities"],
  });

  const oppMap = new Map(opportunities?.map((o) => [o.id, o]) || []);
  const rejectedBids = bids?.filter((b) => b.stage.includes("rejected")) || [];

  const statCards = [
    { title: "Opportunities", value: stats?.totalOpportunities || 0, icon: Target, gradient: "from-primary/10 to-primary/5", iconColor: "text-primary", borderColor: "border-primary/20" },
    { title: "Active Bids", value: stats?.activeBids || 0, icon: FileText, gradient: "from-chart-2/10 to-chart-2/5", iconColor: "text-chart-2", borderColor: "border-chart-2/20" },
    { title: "Pending Review", value: stats?.pendingReview || 0, icon: Clock, gradient: "from-chart-4/10 to-chart-4/5", iconColor: "text-chart-4", borderColor: "border-chart-4/20" },
    { title: "Approved", value: stats?.approved || 0, icon: CheckCircle, gradient: "from-chart-2/10 to-chart-2/5", iconColor: "text-chart-2", borderColor: "border-chart-2/20" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-full mx-auto h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="animate-fade-in shrink-0">
        <p className="text-muted-foreground text-sm" data-testid="text-dashboard-title">Welcome back to your bid pipeline</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0">
        {statCards.map((stat, idx) => (
          <Card key={stat.title} className={`animate-fade-in stagger-${idx + 1} overflow-hidden border ${stat.borderColor}`}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{stat.title}</p>
                  {statsLoading ? (
                    <Skeleton className="h-9 w-14" />
                  ) : (
                    <p className="text-3xl font-bold tracking-tight" data-testid={`text-stat-${stat.title.toLowerCase().replace(/\s/g, "-")}`}>
                      {stat.value}
                    </p>
                  )}
                </div>
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shrink-0`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {bidsLoading ? (
        <div className="grid grid-cols-5 gap-3 flex-1 pb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-3 flex-1 pb-2 animate-fade-in stagger-5" style={{ gridTemplateColumns: rejectedBids.length > 0 ? 'repeat(6, 1fr)' : 'repeat(5, 1fr)' }}>
          {kanbanStages.map((stage) => {
            const stageBids = bids?.filter((b) => b.stage === stage.key) || [];
            return (
              <div key={stage.key} className="flex flex-col min-w-0" data-testid={`workflow-stage-${stage.key}`}>
                <div className={`rounded-t-xl border-t-[3px] ${stage.color} p-3 ${stage.headerBg}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`h-2 w-2 rounded-full ${stage.dotColor} shrink-0`} />
                      <h3 className="text-sm font-semibold">{stage.label}</h3>
                    </div>
                    <Badge variant="secondary" className="text-[13px] h-5 min-w-[20px] justify-center font-bold">
                      {stageBids.length}
                    </Badge>
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-0.5 ml-4">{stage.description}</p>
                </div>

                <div className="flex-1 bg-muted/20 rounded-b-xl border border-t-0 border-border/50 p-2 space-y-2 overflow-y-auto">
                  {stageBids.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-[13px] text-muted-foreground/50">
                      No bids
                    </div>
                  ) : (
                    stageBids.map((bid) => (
                      <BidCard
                        key={bid.id}
                        bid={bid}
                        opp={bid.opportunityId ? oppMap.get(bid.opportunityId) : undefined}
                        stageKey={stage.key}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {rejectedBids.length > 0 && (
            <div className="flex flex-col min-w-0" data-testid="workflow-stage-rejected">
              <div className="rounded-t-xl border-t-[3px] border-t-destructive p-3 bg-destructive/5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-3 w-3 text-destructive shrink-0" />
                    <h3 className="text-sm font-semibold">Rejected</h3>
                  </div>
                  <Badge variant="destructive" className="text-[13px] h-5 min-w-[20px] justify-center font-bold">
                    {rejectedBids.length}
                  </Badge>
                </div>
              </div>
              <div className="flex-1 bg-destructive/[0.02] rounded-b-xl border border-t-0 border-destructive/10 p-2 space-y-2 overflow-y-auto">
                {rejectedBids.map((bid) => (
                  <Link key={bid.id} href={`/bids/${bid.id}`}>
                    <Card className="hover-elevate cursor-pointer border-destructive/10 group" data-testid={`workflow-bid-rejected-${bid.id}`}>
                      <CardContent className="p-3">
                        <p className="text-sm font-medium break-words group-hover:text-destructive transition-colors">{bid.title}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {bid.opportunityId && oppMap.get(bid.opportunityId)?.value && (
                            <span className="flex items-center gap-0.5 text-[13px] text-muted-foreground">
                              <DollarSign className="h-2.5 w-2.5" />
                              {formatValue(oppMap.get(bid.opportunityId)!.value!)}
                            </span>
                          )}
                          <span className="text-[13px] text-muted-foreground">
                            {bid.stage === "cas_rejected" ? "CAS Rejected" : "CSD Rejected"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
