import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  ArrowLeft, Plus, Trash2, Save, ChevronDown, ChevronRight,
  DollarSign, Clock, TrendingUp, BarChart3, Calendar, MapPin,
  Pencil, X, Check, Minimize2, Maximize2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getMaxAllocation, getHolidaysInWeek, STATES } from "@/lib/holidays";
import type { JobPlan, JobPlanLine } from "@shared/schema";

const CHARGE_LEVELS = ["Partner", "Principal", "Director", "Senior Manager", "Manager", "Senior Consultant", "Consultant"];
const HOURS_PER_DAY = 8;

function getMarginColor(margin: number): string {
  if (margin >= 40) return "text-chart-2";
  if (margin >= 25) return "text-chart-4";
  return "text-destructive";
}

function getWeekDates(startDate: Date, numWeeks: number): Date[] {
  const weeks: Date[] = [];
  const start = new Date(startDate);
  start.setDate(start.getDate() - start.getDay() + 1);
  for (let i = 0; i < numWeeks; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    weeks.push(d);
  }
  return weeks;
}

function formatWeekLabel(d: Date): string {
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

interface LineCalcs {
  discountedRate: number;
  dailyRate: number;
  budgetDollars: number;
  forecastDays: number;
  forecastDollars: number;
  forecastGrossCost: number;
  grossMargin: number;
  variance: number;
  actualDollars: number;
  balance: number;
}

function calcLine(line: JobPlanLine): LineCalcs {
  const rate = line.panelHourlyRate || 0;
  const discount = (line.discountPercent || 0) / 100;
  const discountedRate = rate * (1 - discount);
  const dailyRate = discountedRate * HOURS_PER_DAY;
  const grossCostPerHour = line.hourlyGrossCost || 0;
  const budgetHours = line.budgetHours || 0;
  const forecastHours = line.forecastHours || 0;
  const actualHours = line.actualHours || 0;
  const budgetDollars = budgetHours * discountedRate;
  const forecastDays = forecastHours / HOURS_PER_DAY;
  const forecastDollars = forecastHours * discountedRate;
  const forecastGrossCost = forecastHours * grossCostPerHour;
  const grossMargin = forecastDollars > 0 ? ((forecastDollars - forecastGrossCost) / forecastDollars) * 100 : 0;
  const actualDollars = actualHours * discountedRate;
  const balance = budgetDollars - actualDollars;
  const variance = budgetDollars - forecastDollars;
  return { discountedRate, dailyRate, budgetDollars, forecastDays, forecastDollars, forecastGrossCost, grossMargin, variance, actualDollars, balance };
}

export default function JobPlanDetail() {
  const { id } = useParams<{ id: string }>();
  const planId = Number(id);
  const { toast } = useToast();
  const [expandedMilestones, setExpandedMilestones] = useState<Record<string, boolean>>({});
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<JobPlanLine>>({});
  const [allocationView, setAllocationView] = useState<number | null>(null);
  const [numWeeks] = useState(26);
  const [projectState, setProjectState] = useState("VIC");

  const { data: plan, isLoading: planLoading } = useQuery<JobPlan>({ queryKey: ["/api/job-plans", planId] });
  const { data: lines, isLoading: linesLoading } = useQuery<JobPlanLine[]>({ queryKey: ["/api/job-plans", planId, "lines"] });

  const addLineMutation = useMutation({
    mutationFn: async (data: Partial<JobPlanLine>) => {
      const res = await apiRequest("POST", `/api/job-plans/${planId}/lines`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-plans", planId, "lines"] });
      toast({ title: "Resource line added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateLineMutation = useMutation({
    mutationFn: async ({ lineId, data }: { lineId: number; data: Partial<JobPlanLine> }) => {
      const res = await apiRequest("PATCH", `/api/job-plan-lines/${lineId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-plans", planId, "lines"] });
      setEditingLine(null);
      setEditData({});
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteLineMutation = useMutation({
    mutationFn: async (lineId: number) => {
      await apiRequest("DELETE", `/api/job-plan-lines/${lineId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-plans", planId, "lines"] });
      toast({ title: "Line removed" });
    },
  });

  const milestoneGroups = useMemo(() => {
    if (!lines) return {};
    const groups: Record<string, JobPlanLine[]> = {};
    lines.forEach((l) => {
      const key = l.milestone || "Unassigned";
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    });
    return groups;
  }, [lines]);

  const totals = useMemo(() => {
    if (!lines) return { budgetDollars: 0, forecastDollars: 0, forecastGrossCost: 0, grossMargin: 0, totalHours: 0, totalForecastHours: 0, variance: 0 };
    let budgetDollars = 0, forecastDollars = 0, forecastGrossCost = 0, totalHours = 0, totalForecastHours = 0;
    lines.forEach((l) => {
      const c = calcLine(l);
      budgetDollars += c.budgetDollars;
      forecastDollars += c.forecastDollars;
      forecastGrossCost += c.forecastGrossCost;
      totalHours += l.budgetHours || 0;
      totalForecastHours += l.forecastHours || 0;
    });
    const grossMargin = forecastDollars > 0 ? ((forecastDollars - forecastGrossCost) / forecastDollars) * 100 : 0;
    const variance = budgetDollars - forecastDollars;
    return { budgetDollars, forecastDollars, forecastGrossCost, grossMargin, totalHours, totalForecastHours, variance };
  }, [lines]);

  const weeks = useMemo(() => {
    if (!plan?.contractStartDate) return getWeekDates(new Date(), numWeeks);
    return getWeekDates(new Date(plan.contractStartDate), numWeeks);
  }, [plan?.contractStartDate, numWeeks]);

  const toggleMilestone = (ms: string) => {
    setExpandedMilestones((prev) => ({ ...prev, [ms]: prev[ms] === false }));
  };

  const startEdit = (line: JobPlanLine) => {
    setEditingLine(line.id);
    setEditData({ ...line });
  };

  const saveEdit = () => {
    if (editingLine && editData) {
      updateLineMutation.mutate({ lineId: editingLine, data: editData });
    }
  };

  const addNewLine = (milestone: string) => {
    addLineMutation.mutate({
      milestone,
      deliverable: "",
      resource: "",
      chargeOutLevel: "Senior Consultant",
      jobRole: "",
      panelHourlyRate: 212.5,
      discountPercent: 0,
      hourlyGrossCost: 0,
      budgetHours: 0,
      forecastHours: 0,
      actualHours: 0,
      weeklyAllocations: "{}",
      sortOrder: (lines?.filter((l) => l.milestone === milestone).length || 0) + 1,
    });
  };

  const parseAllocations = (line: JobPlanLine): Record<string, number> => {
    try {
      return JSON.parse(line.weeklyAllocations || "{}");
    } catch {
      return {};
    }
  };

  const [localAllocs, setLocalAllocs] = useState<Record<number, Record<string, number>>>({});

  const getEffectiveAllocs = useCallback((line: JobPlanLine): Record<string, number> => {
    if (localAllocs[line.id]) return localAllocs[line.id];
    return parseAllocations(line);
  }, [localAllocs]);

  const setAllocationLocal = useCallback((line: JobPlanLine, weekKey: string, value: number) => {
    setLocalAllocs((prev) => {
      const current = prev[line.id] || parseAllocations(line);
      const next = { ...current };
      if (value === 0) {
        delete next[weekKey];
      } else {
        next[weekKey] = value;
      }
      return { ...prev, [line.id]: next };
    });
  }, []);

  const flushAllocations = useCallback((lineId: number) => {
    const allocs = localAllocs[lineId];
    if (!allocs) return;
    const totalAllocHours = Object.values(allocs).reduce((sum, pct) => sum + (pct / 100) * 40, 0);
    updateLineMutation.mutate({
      lineId,
      data: {
        weeklyAllocations: JSON.stringify(allocs),
        forecastHours: Math.round(totalAllocHours * 10) / 10,
      },
    });
    setLocalAllocs((prev) => {
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
  }, [localAllocs, updateLineMutation]);

  const renameMilestone = useCallback(async (oldName: string, newName: string) => {
    if (oldName === newName || !lines) return;
    const milestoneLines = lines.filter((l) => (l.milestone || "Unassigned") === oldName);
    try {
      await Promise.all(milestoneLines.map((l) =>
        apiRequest("PATCH", `/api/job-plan-lines/${l.id}`, { milestone: newName })
      ));
      queryClient.invalidateQueries({ queryKey: ["/api/job-plans", planId, "lines"] });
      setExpandedMilestones((prev) => {
        const next = { ...prev };
        if (oldName in next) {
          next[newName] = next[oldName];
          delete next[oldName];
        }
        return next;
      });
      toast({ title: "Milestone renamed", description: `"${oldName}" → "${newName}"` });
    } catch (e: any) {
      toast({ title: "Error renaming milestone", description: e.message, variant: "destructive" });
    }
  }, [lines, planId, toast]);

  const deleteMilestone = useCallback(async (milestone: string) => {
    if (!lines) return;
    const milestoneLines = lines.filter((l) => (l.milestone || "Unassigned") === milestone);
    try {
      await Promise.all(milestoneLines.map((l) =>
        apiRequest("DELETE", `/api/job-plan-lines/${l.id}`)
      ));
      queryClient.invalidateQueries({ queryKey: ["/api/job-plans", planId, "lines"] });
      toast({ title: "Milestone deleted", description: `Removed "${milestone}" and ${milestoneLines.length} line${milestoneLines.length === 1 ? "" : "s"}` });
    } catch (e: any) {
      toast({ title: "Error deleting milestone", description: e.message, variant: "destructive" });
    }
  }, [lines, planId, toast]);

  if (planLoading || linesLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-8 text-center text-muted-foreground">Job plan not found.</div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-start gap-3">
        <Link href="/job-plans">
          <Button size="icon" variant="ghost" className="shrink-0 mt-0.5" data-testid="button-back-plans">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate" data-testid="text-plan-title">{plan.title}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {plan.contractStartDate && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Start: {new Date(plan.contractStartDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
            <Badge variant="outline" className="text-[13px]">{lines?.length || 0} resource lines</Badge>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <Select value={projectState} onValueChange={setProjectState}>
                <SelectTrigger className="h-7 w-[120px] text-[13px] border-dashed" data-testid="select-project-state">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <span className="text-[13px] text-muted-foreground font-medium">Forecast Revenue</span>
            </div>
            <p className="text-xl font-bold" data-testid="text-forecast-revenue">{formatCurrency(totals.forecastDollars)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-chart-2/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-chart-2" />
              </div>
              <span className="text-[13px] text-muted-foreground font-medium">Gross Margin</span>
            </div>
            <p className={`text-xl font-bold ${getMarginColor(totals.grossMargin)}`} data-testid="text-gross-margin">
              {totals.grossMargin.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-chart-4/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-chart-4" />
              </div>
              <span className="text-[13px] text-muted-foreground font-medium">Forecast Hours</span>
            </div>
            <p className="text-xl font-bold" data-testid="text-forecast-hours">{totals.totalForecastHours.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-chart-5/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-chart-5" />
              </div>
              <span className="text-[13px] text-muted-foreground font-medium">Budget Variance</span>
            </div>
            <p className={`text-xl font-bold ${totals.variance >= 0 ? "text-chart-2" : "text-destructive"}`} data-testid="text-variance">
              {formatCurrency(totals.variance)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Resource Lines</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-[13px]"
                onClick={() => {
                  const all: Record<string, boolean> = {};
                  Object.keys(milestoneGroups).forEach((ms) => { all[ms] = false; });
                  setExpandedMilestones(all);
                }}
                data-testid="button-collapse-all"
              >
                <Minimize2 className="h-3 w-3 mr-1" />
                Collapse All
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-[13px]"
                onClick={() => setExpandedMilestones({})}
                data-testid="button-expand-all"
              >
                <Maximize2 className="h-3 w-3 mr-1" />
                Expand All
              </Button>
              <NewMilestoneDialog onAdd={(ms) => addNewLine(ms)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-resource-lines">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-2 pl-4 font-medium text-muted-foreground w-[200px] sticky left-0 bg-muted/30 z-10">Resource</th>
                  <th className="text-left p-2 font-medium text-muted-foreground w-[120px]">Level</th>
                  <th className="text-left p-2 font-medium text-muted-foreground w-[100px]">Role</th>
                  <th className="text-right p-2 font-medium text-muted-foreground w-[80px]">Rate $/hr</th>
                  <th className="text-right p-2 font-medium text-muted-foreground w-[60px]">Disc %</th>
                  <th className="text-right p-2 font-medium text-muted-foreground w-[80px]">Eff. Rate</th>
                  <th className="text-right p-2 font-medium text-muted-foreground w-[60px]">Cost $/hr</th>
                  <th className="text-right p-2 font-medium text-muted-foreground w-[70px]">Bdgt Hrs</th>
                  <th className="text-right p-2 font-medium text-muted-foreground w-[70px]">Fcst Hrs</th>
                  <th className="text-right p-2 font-medium text-muted-foreground w-[90px]">Fcst $</th>
                  <th className="text-right p-2 font-medium text-muted-foreground w-[60px]">Margin</th>
                  <th className="p-2 w-[80px]"></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(milestoneGroups).map(([milestone, groupLines]) => {
                  const isExpanded = expandedMilestones[milestone] !== false;
                  const groupCalcs = groupLines.map(calcLine);
                  const groupTotal = groupCalcs.reduce((acc, c) => ({
                    forecastDollars: acc.forecastDollars + c.forecastDollars,
                    forecastGrossCost: acc.forecastGrossCost + c.forecastGrossCost,
                    totalHours: acc.totalHours + (groupLines[groupCalcs.indexOf(c)]?.forecastHours || 0),
                  }), { forecastDollars: 0, forecastGrossCost: 0, totalHours: 0 });
                  const groupMargin = groupTotal.forecastDollars > 0 ? ((groupTotal.forecastDollars - groupTotal.forecastGrossCost) / groupTotal.forecastDollars) * 100 : 0;

                  return (
                    <MilestoneGroup
                      key={milestone}
                      milestone={milestone}
                      lines={groupLines}
                      isExpanded={isExpanded}
                      onToggle={() => toggleMilestone(milestone)}
                      onAddLine={() => addNewLine(milestone)}
                      editingLine={editingLine}
                      editData={editData}
                      onStartEdit={startEdit}
                      onEditChange={setEditData}
                      onSaveEdit={saveEdit}
                      onCancelEdit={() => { setEditingLine(null); setEditData({}); }}
                      onDeleteLine={(id) => deleteLineMutation.mutate(id)}
                      onShowAllocations={(id) => setAllocationView(allocationView === id ? null : id)}
                      allocationView={allocationView}
                      weeks={weeks}
                      onSetAllocation={setAllocationLocal}
                      getEffectiveAllocs={getEffectiveAllocs}
                      onFlushAllocations={flushAllocations}
                      projectState={projectState}
                      groupTotalRevenue={groupTotal.forecastDollars}
                      groupTotalHours={groupTotal.totalHours}
                      groupMargin={groupMargin}
                      onRenameMilestone={renameMilestone}
                      onDeleteMilestone={deleteMilestone}
                    />
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/50 font-semibold">
                  <td className="p-2 pl-4 sticky left-0 bg-muted/50 z-10">Total</td>
                  <td colSpan={7}></td>
                  <td className="text-right p-2">{totals.totalForecastHours.toLocaleString()}</td>
                  <td className="text-right p-2">{formatCurrency(totals.forecastDollars)}</td>
                  <td className="text-right p-2">{totals.grossMargin.toFixed(1)}%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MilestoneGroup({
  milestone, lines, isExpanded, onToggle, onAddLine,
  editingLine, editData, onStartEdit, onEditChange, onSaveEdit, onCancelEdit,
  onDeleteLine, onShowAllocations, allocationView, weeks, onSetAllocation,
  getEffectiveAllocs, onFlushAllocations,
  projectState, groupTotalRevenue, groupTotalHours, groupMargin,
  onRenameMilestone, onDeleteMilestone,
}: Readonly<{
  milestone: string;
  lines: JobPlanLine[];
  isExpanded: boolean;
  onToggle: () => void;
  onAddLine: () => void;
  editingLine: number | null;
  editData: Partial<JobPlanLine>;
  onStartEdit: (line: JobPlanLine) => void;
  onEditChange: (data: Partial<JobPlanLine>) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDeleteLine: (id: number) => void;
  onShowAllocations: (id: number) => void;
  allocationView: number | null;
  weeks: Date[];
  onSetAllocation: (line: JobPlanLine, weekKey: string, value: number) => void;
  getEffectiveAllocs: (line: JobPlanLine) => Record<string, number>;
  onFlushAllocations: (lineId: number) => void;
  projectState: string;
  groupTotalRevenue: number;
  groupTotalHours: number;
  groupMargin: number;
  onRenameMilestone: (oldName: string, newName: string) => void;
  onDeleteMilestone: (milestone: string) => void;
}>) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(milestone);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <tr className="bg-muted/20 cursor-pointer border-b" onClick={onToggle} data-testid={`row-milestone-${milestone}`}>
        <td className="p-2 pl-4 font-semibold sticky left-0 bg-muted/20 z-10" colSpan={2}>
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {isRenaming ? (
              <div className="flex items-center gap-1" role="presentation" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <Input
                  className="h-8 text-sm w-48"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && renameValue.trim()) {
                      onRenameMilestone(milestone, renameValue.trim());
                      setIsRenaming(false);
                    }
                    if (e.key === "Escape") {
                      setRenameValue(milestone);
                      setIsRenaming(false);
                    }
                  }}
                  autoFocus
                  data-testid={`input-rename-milestone-${milestone}`}
                />
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { if (renameValue.trim()) { onRenameMilestone(milestone, renameValue.trim()); setIsRenaming(false); } }} data-testid={`button-confirm-rename-${milestone}`}>
                  <Check className="h-3 w-3 text-emerald-600" />
                </Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setRenameValue(milestone); setIsRenaming(false); }} data-testid={`button-cancel-rename-${milestone}`}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <span className="truncate">{milestone}</span>
                <Badge variant="secondary" className="text-[12px] ml-1">{lines.length}</Badge>
              </>
            )}
          </div>
        </td>
        <td colSpan={6}></td>
        <td className="text-right p-2 text-muted-foreground">{groupTotalHours.toLocaleString()}</td>
        <td className="text-right p-2 text-muted-foreground">{formatCurrency(groupTotalRevenue)}</td>
        <td className="text-right p-2 text-muted-foreground">{groupMargin.toFixed(1)}%</td>
        <td className="p-2">
          <div className="flex gap-1" role="presentation" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[13px]"
              onClick={() => onAddLine()}
              data-testid={`button-add-line-${milestone}`}
            >
              <Plus className="h-3 w-3 mr-1" />Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => { setRenameValue(milestone); setIsRenaming(true); }}
              data-testid={`button-rename-milestone-${milestone}`}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <span className="text-[13px] text-destructive whitespace-nowrap">Delete {lines.length} line{lines.length === 1 ? "" : "s"}?</span>
                <Button size="sm" variant="destructive" className="h-7 px-2 text-[13px]" onClick={() => { onDeleteMilestone(milestone); setConfirmDelete(false); }} data-testid={`button-confirm-delete-milestone-${milestone}`}>Yes</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[13px]" onClick={() => setConfirmDelete(false)}>No</Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-destructive"
                onClick={() => setConfirmDelete(true)}
                data-testid={`button-delete-milestone-${milestone}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && lines.map((line) => {
        const c = calcLine(line);
        const isEditing = editingLine === line.id;
        const showAlloc = allocationView === line.id;
        const allocs = getEffectiveAllocs(line);

        return (
          <LineRow
            key={line.id}
            line={line}
            calcs={c}
            isEditing={isEditing}
            editData={editData}
            onStartEdit={() => onStartEdit(line)}
            onEditChange={onEditChange}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onDelete={() => onDeleteLine(line.id)}
            showAlloc={showAlloc}
            onToggleAlloc={() => onShowAllocations(line.id)}
            weeks={weeks}
            allocs={allocs}
            onSetAllocation={(weekKey, val) => onSetAllocation(line, weekKey, val)}
            onFlushAllocations={() => onFlushAllocations(line.id)}
            projectState={projectState}
          />
        );
      })}
    </>
  );
}

function LineRow({
  line, calcs, isEditing, editData, onStartEdit, onEditChange, onSaveEdit, onCancelEdit, onDelete,
  showAlloc, onToggleAlloc, weeks, allocs, onSetAllocation, onFlushAllocations, projectState,
}: Readonly<{
  line: JobPlanLine;
  calcs: LineCalcs;
  isEditing: boolean;
  editData: Partial<JobPlanLine>;
  onStartEdit: () => void;
  onEditChange: (data: Partial<JobPlanLine>) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  showAlloc: boolean;
  onToggleAlloc: () => void;
  weeks: Date[];
  allocs: Record<string, number>;
  onSetAllocation: (weekKey: string, val: number) => void;
  onFlushAllocations: () => void;
  projectState: string;
}>) {

  const allocSummary = useMemo(() => {
    const entries = Object.entries(allocs).filter(([, v]) => v > 0).sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) return null;
    const firstDate = new Date(entries[0][0]);
    const lastDate = new Date(entries.at(-1)![0]);
    const avgPct = Math.round(entries.reduce((sum, [, v]) => sum + v, 0) / entries.length);
    const fmt = (d: Date) => d.toLocaleDateString("en-AU", { month: "short", year: "2-digit" });
    return { from: fmt(firstDate), to: fmt(lastDate), weeks: entries.length, avgPct };
  }, [allocs]);

  if (isEditing) {
    return (
      <tr className="border-b bg-primary/5" data-testid={`row-line-edit-${line.id}`}>
        <td className="p-1.5 pl-8 sticky left-0 bg-primary/5 z-10">
          <Input className="h-8 text-sm" value={editData.resource || ""} onChange={(e) => onEditChange({ ...editData, resource: e.target.value })} placeholder="Name" />
        </td>
        <td className="p-1.5">
          <Select value={editData.chargeOutLevel || ""} onValueChange={(v) => onEditChange({ ...editData, chargeOutLevel: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CHARGE_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </td>
        <td className="p-1.5">
          <Input className="h-8 text-sm" value={editData.jobRole || ""} onChange={(e) => onEditChange({ ...editData, jobRole: e.target.value })} placeholder="Role" />
        </td>
        <td className="p-1.5">
          <Input className="h-8 text-sm text-right" type="number" value={editData.panelHourlyRate || 0} onChange={(e) => onEditChange({ ...editData, panelHourlyRate: Number.parseFloat(e.target.value) || 0 })} />
        </td>
        <td className="p-1.5">
          <Input className="h-8 text-sm text-right" type="number" value={editData.discountPercent || 0} onChange={(e) => onEditChange({ ...editData, discountPercent: Number.parseFloat(e.target.value) || 0 })} />
        </td>
        <td className="p-1.5 text-right text-muted-foreground">
          ${((editData.panelHourlyRate || 0) * (1 - (editData.discountPercent || 0) / 100)).toFixed(2)}
        </td>
        <td className="p-1.5">
          <Input className="h-8 text-sm text-right" type="number" value={editData.hourlyGrossCost || 0} onChange={(e) => onEditChange({ ...editData, hourlyGrossCost: Number.parseFloat(e.target.value) || 0 })} />
        </td>
        <td className="p-1.5">
          <Input className="h-8 text-sm text-right" type="number" value={editData.budgetHours || 0} onChange={(e) => onEditChange({ ...editData, budgetHours: Number.parseFloat(e.target.value) || 0 })} />
        </td>
        <td className="p-1.5">
          <Input className="h-8 text-sm text-right" type="number" value={editData.forecastHours || 0} onChange={(e) => onEditChange({ ...editData, forecastHours: Number.parseFloat(e.target.value) || 0 })} />
        </td>
        <td className="p-1.5 text-right text-muted-foreground">
          {formatCurrency((editData.forecastHours || 0) * ((editData.panelHourlyRate || 0) * (1 - (editData.discountPercent || 0) / 100)))}
        </td>
        <td className="p-1.5"></td>
        <td className="p-1.5">
          <div className="flex gap-1">
            <Button size="sm" variant="default" className="h-7 px-2 text-[13px]" onClick={onSaveEdit}><Save className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[13px]" onClick={onCancelEdit}>Cancel</Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="border-b hover:bg-muted/10 group" data-testid={`row-line-${line.id}`}>
        <td className="p-2 pl-8 sticky left-0 bg-card z-10 group-hover:bg-muted/10">
          <div className="flex items-center gap-2">
            <span className="truncate cursor-pointer hover:text-primary transition-colors" role="button" tabIndex={0} onClick={onStartEdit} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onStartEdit(); }} data-testid={`text-resource-${line.id}`}>
              {line.resource || <span className="text-muted-foreground italic">Click to set</span>}
            </span>
          </div>
          {line.deliverable && <p className="text-[13px] text-muted-foreground truncate mt-0.5">{line.deliverable}</p>}
          <div
            className="flex items-center gap-1.5 mt-1 cursor-pointer group/alloc"
            role="button"
            tabIndex={0}
            onClick={onToggleAlloc}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleAlloc(); }}
            data-testid={`button-alloc-${line.id}`}
          >
            <Calendar className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
            {allocSummary ? (
              <span className="text-[13px] text-primary/80 group-hover/alloc:text-primary transition-colors">
                {allocSummary.from} → {allocSummary.to}
                <span className="text-muted-foreground ml-1">({allocSummary.weeks}w @ {allocSummary.avgPct}%)</span>
              </span>
            ) : (
              <span className="text-[13px] text-muted-foreground/50 group-hover/alloc:text-primary transition-colors">
                Set allocation...
              </span>
            )}
          </div>
        </td>
        <td className="p-2 cursor-pointer" onClick={onStartEdit}>{line.chargeOutLevel}</td>
        <td className="p-2 cursor-pointer" onClick={onStartEdit}>{line.jobRole}</td>
        <td className="p-2 text-right">${(line.panelHourlyRate || 0).toFixed(2)}</td>
        <td className="p-2 text-right">{(line.discountPercent || 0).toFixed(0)}%</td>
        <td className="p-2 text-right font-medium">${calcs.discountedRate.toFixed(2)}</td>
        <td className="p-2 text-right">${(line.hourlyGrossCost || 0).toFixed(2)}</td>
        <td className="p-2 text-right">{(line.budgetHours || 0).toLocaleString()}</td>
        <td className="p-2 text-right">{(line.forecastHours || 0).toLocaleString()}</td>
        <td className="p-2 text-right font-medium">{formatCurrency(calcs.forecastDollars)}</td>
        <td className={`p-2 text-right font-medium ${getMarginColor(calcs.grossMargin)}`}>
          {calcs.grossMargin.toFixed(1)}%
        </td>
        <td className="p-2">
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[13px]" onClick={onStartEdit} data-testid={`button-edit-line-${line.id}`}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-destructive" onClick={onDelete} data-testid={`button-delete-line-${line.id}`}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </td>
      </tr>
      {showAlloc && (
        <tr className="border-b">
          <td colSpan={12} className="p-0">
            <AllocationGrid
              lineId={line.id}
              weeks={weeks}
              allocs={allocs}
              onSetAllocation={onSetAllocation}
              onFlushAllocations={onFlushAllocations}
              projectState={projectState}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function AllocationGrid({
  lineId, weeks, allocs, onSetAllocation, onFlushAllocations, projectState,
}: Readonly<{
  lineId: number;
  weeks: Date[];
  allocs: Record<string, number>;
  onSetAllocation: (weekKey: string, val: number) => void;
  onFlushAllocations: () => void;
  projectState: string;
}>) {
  const dragRef = useRef<{ active: boolean; paintVal: number; startIdx: number; painted: Set<number> }>({
    active: false, paintVal: 0, startIdx: -1, painted: new Set(),
  });
  const [dragRange, setDragRange] = useState<{ start: number; end: number } | null>(null);

  const monthGroups = useMemo(() => {
    const groups: { month: string; startIdx: number; count: number }[] = [];
    weeks.forEach((w, i) => {
      const label = w.toLocaleDateString("en-AU", { month: "short" });
      if (groups.length === 0 || groups.at(-1)!.month !== label) {
        groups.push({ month: label, startIdx: i, count: 1 });
      } else {
        groups.at(-1)!.count++;
      }
    });
    return groups;
  }, [weeks]);

  const applyPaint = useCallback((idx: number) => {
    if (!dragRef.current.active) return;
    const w = weeks[idx];
    const key = w.toISOString().split("T")[0];
    const maxAlloc = getMaxAllocation(w, projectState);
    const paintVal = dragRef.current.paintVal;
    onSetAllocation(key, paintVal === 0 ? 0 : Math.min(paintVal, maxAlloc));
    dragRef.current.painted.add(idx);
    setDragRange({ start: dragRef.current.startIdx, end: idx });
  }, [weeks, projectState, onSetAllocation]);

  const handleMouseDown = useCallback((i: number, currentVal: number) => {
    const maxAlloc = getMaxAllocation(weeks[i], projectState);
    const steps = [0, 20, 50, 80, 100].filter((s) => s <= maxAlloc || s === 0);
    if (maxAlloc > 0 && !steps.includes(maxAlloc)) {
      steps.push(maxAlloc);
      steps.sort((a, b) => a - b);
    }
    const currentIdx = steps.indexOf(currentVal);
    const nextVal = currentIdx === -1 ? 0 : steps[(currentIdx + 1) % steps.length];

    dragRef.current = { active: true, paintVal: nextVal, startIdx: i, painted: new Set([i]) };
    const key = weeks[i].toISOString().split("T")[0];
    onSetAllocation(key, nextVal === 0 ? 0 : Math.min(nextVal, maxAlloc));
    setDragRange({ start: i, end: i });
  }, [weeks, projectState, onSetAllocation]);

  const handleMouseEnter = useCallback((i: number) => {
    if (!dragRef.current.active) return;
    const lo = Math.min(dragRef.current.startIdx, i);
    const hi = Math.max(dragRef.current.startIdx, i);
    for (let j = lo; j <= hi; j++) {
      applyPaint(j);
    }
    setDragRange({ start: dragRef.current.startIdx, end: i });
  }, [applyPaint]);

  const handleMouseUp = useCallback(() => {
    if (dragRef.current.active) {
      dragRef.current.active = false;
      setDragRange(null);
      onFlushAllocations();
    }
  }, [onFlushAllocations]);

  useEffect(() => {
    const onUp = () => handleMouseUp();
    globalThis.addEventListener("mouseup", onUp);
    return () => globalThis.removeEventListener("mouseup", onUp);
  }, [handleMouseUp]);

  const isDragging = dragRange !== null;
  const dragLo = dragRange ? Math.min(dragRange.start, dragRange.end) : -1;
  const dragHi = dragRange ? Math.max(dragRange.start, dragRange.end) : -1;

  const handleClearAll = useCallback(() => {
    weeks.forEach((w) => {
      const key = w.toISOString().split("T")[0];
      onSetAllocation(key, 0);
    });
    setTimeout(() => onFlushAllocations(), 0);
  }, [weeks, onSetAllocation, onFlushAllocations]);

  const allocCount = Object.values(allocs).filter((v) => v > 0).length;

  return (
    <div className="bg-gradient-to-b from-muted/5 to-muted/15 p-3 space-y-2">
      <div className="overflow-x-auto select-none">
        <TooltipProvider delayDuration={400}>
          <table className="border-collapse" style={{ borderSpacing: 0 }}>
            <thead>
              <tr>
                {monthGroups.map((g) => (
                  <th
                    key={`${g.month}-${g.startIdx}`}
                    colSpan={g.count}
                    className="text-[12px] font-semibold text-foreground/70 tracking-wide text-left px-0 pb-0.5 border-l border-border/30 first:border-l-0 pl-1"
                  >
                    {g.month}
                  </th>
                ))}
                <th className="w-16"></th>
              </tr>
              <tr>
                {weeks.map((w, i) => {
                  const weekKey = w.toISOString().split("T")[0];
                  const hasHoliday = getHolidaysInWeek(w, projectState).length > 0;
                  const day = w.getDate();
                  const isFirstOfMonth = monthGroups.some((g) => g.startIdx === i);
                  return (
                    <th
                      key={weekKey}
                      className={`text-[13px] font-normal px-0 pb-0.5 w-12 text-center ${hasHoliday ? "text-amber-600 dark:text-amber-400 font-bold" : "text-muted-foreground/60"} ${isFirstOfMonth && i !== 0 ? "border-l border-border/30" : ""}`}
                    >
                      {day}{hasHoliday ? "*" : ""}
                    </th>
                  );
                })}
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {weeks.map((w, i) => {
                  const key = w.toISOString().split("T")[0];
                  const val = allocs[key] || 0;
                  const holidays = getHolidaysInWeek(w, projectState);
                  const hasHoliday = holidays.length > 0;
                  const maxAlloc = getMaxAllocation(w, projectState);
                  const isFirstOfMonth = monthGroups.some((g) => g.startIdx === i);
                  const inDrag = isDragging && i >= dragLo && i <= dragHi;

                  let cellStyle: React.CSSProperties = {};
                  let cellText: string;
                  let cellExtra = "";
                  if (val === 0) {
                    cellStyle = { background: hasHoliday ? "repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(251,191,36,0.08) 3px, rgba(251,191,36,0.08) 6px)" : undefined };
                    cellText = "text-muted-foreground/20";
                  } else if (val > maxAlloc) {
                    cellStyle = { background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)" };
                    cellText = "text-white"; cellExtra = "shadow-sm shadow-red-500/20";
                  } else if (val >= 100) {
                    cellStyle = { background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" };
                    cellText = "text-white"; cellExtra = "shadow-sm shadow-emerald-500/20";
                  } else if (val >= 80) {
                    cellStyle = { background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)" };
                    cellText = "text-white"; cellExtra = "shadow-sm shadow-emerald-400/15";
                  } else if (val >= 50) {
                    cellStyle = { background: "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)" };
                    cellText = "text-white"; cellExtra = "shadow-sm shadow-sky-400/15";
                  } else if (val >= 20) {
                    cellStyle = { background: "linear-gradient(135deg, #7dd3fc 0%, #bae6fd 100%)" };
                    cellText = "text-sky-900 dark:text-sky-100";
                  } else {
                    cellStyle = { background: "linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%)" };
                    cellText = "text-sky-700 dark:text-sky-300";
                  }

                  return (
                    <td key={key} className={`p-0 ${isFirstOfMonth && i !== 0 ? "border-l border-border/30" : ""}`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            style={cellStyle}
                            className={`w-12 h-8 text-[12px] font-semibold flex items-center justify-center cursor-crosshair transition-colors rounded-[2px] border border-border/20 ${cellText} ${cellExtra} ${inDrag ? "ring-2 ring-primary/50 ring-inset" : ""}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (e.button === 2) return;
                              handleMouseDown(i, val);
                            }}
                            onMouseEnter={() => handleMouseEnter(i)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              onSetAllocation(key, 0);
                              setTimeout(() => onFlushAllocations(), 0);
                            }}
                            data-testid={`alloc-cell-${lineId}-${i}`}
                          >
                            {val > 0 ? `${val}%` : ""}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-sm max-w-[200px]">
                          <p className="font-semibold">W{i + 1}: {w.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p>
                          <p>Allocation: {val}%</p>
                          {hasHoliday && (
                            <div className="mt-1 text-amber-600 dark:text-amber-400">
                              {holidays.map((h) => <p key={h.name}>Holiday: {h.name}</p>)}
                              <p className="font-medium">Max: {maxAlloc}%</p>
                            </div>
                          )}
                          <p className="text-muted-foreground mt-0.5">Click to cycle · Drag to fill · Right-click to clear</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  );
                })}
                <td className="p-0 pl-2 align-middle">
                  {allocCount > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={handleClearAll}
                          data-testid={`button-clear-all-${lineId}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-sm">
                        Clear all ({allocCount} weeks)
                      </TooltipContent>
                    </Tooltip>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </TooltipProvider>
      </div>
      <div className="flex items-center gap-4 text-[12px] text-muted-foreground pt-1.5 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }} /> 100%</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm" style={{ background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)" }} /> 80%</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm" style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)" }} /> 50%</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm" style={{ background: "linear-gradient(135deg, #7dd3fc 0%, #bae6fd 100%)" }} /> 20%</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)" }} /> Over limit</span>
        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">* = public holiday (capped)</span>
        <span className="text-muted-foreground/70">Click to cycle · Drag to fill · Right-click to clear</span>
      </div>
    </div>
  );
}

function NewMilestoneDialog({ onAdd }: Readonly<{ onAdd: (milestone: string) => void }>) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="button-add-milestone">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Resource
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Resource Line</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-sm font-medium">Milestone / Work Stream</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. BCG Business Case"
              data-testid="input-milestone-name"
            />
          </div>
          <Button
            className="w-full"
            disabled={!name}
            onClick={() => { onAdd(name); setOpen(false); setName(""); }}
            data-testid="button-confirm-add-milestone"
          >
            Add Resource Line
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

