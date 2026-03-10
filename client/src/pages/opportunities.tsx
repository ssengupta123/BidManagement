import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, FileText, Trash2, Target, DollarSign, Building2, Users2 } from "lucide-react";
import type { Opportunity } from "@shared/schema";

export default function Opportunities() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phase: "1.A - Activity",
    value: "",
    margin: "",
    workType: "Delivery",
    vat: "GROWTH",
    status: "New",
    comment: "",
    casLead: "",
    csdLead: "",
    category: "",
    partner: "",
    clientContact: "",
    clientCode: "",
  });

  const { data: opportunities, isLoading } = useQuery<Opportunity[]>({
    queryKey: ["/api/opportunities"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/opportunities", {
        ...data,
        value: data.value ? Number.parseFloat(data.value) : null,
        margin: data.margin ? Number.parseFloat(data.margin) / 100 : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDialogOpen(false);
      setFormData({ name: "", phase: "1.A - Activity", value: "", margin: "", workType: "Delivery", vat: "GROWTH", status: "New", comment: "", casLead: "", csdLead: "", category: "", partner: "", clientContact: "", clientCode: "" });
      toast({ title: "Opportunity created successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createBidMutation = useMutation({
    mutationFn: async (opp: Opportunity) => {
      const res = await apiRequest("POST", "/api/bids", {
        opportunityId: opp.id,
        title: opp.name,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bids"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Bid created from opportunity" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/opportunities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Opportunity deleted" });
    },
  });

  const filtered = opportunities?.filter((opp) =>
    opp.name.toLowerCase().includes(search.toLowerCase()) ||
    opp.clientCode?.toLowerCase().includes(search.toLowerCase()) ||
    opp.partner?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const getStatusColor = (status: string | null) => {
    if (status === "Active") return "bg-chart-2/10 text-chart-2 border-chart-2/20";
    if (status === "Risk") return "bg-destructive/10 text-destructive border-destructive/20";
    if (status === "On Hold") return "bg-chart-4/10 text-chart-4 border-chart-4/20";
    return "bg-muted text-muted-foreground border-muted";
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap animate-fade-in">
        <div>
          <p className="text-muted-foreground text-sm">Manage panel opportunities and create bids</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-opp" className="shadow-sm">
              <Plus className="h-4 w-4 mr-2" />
              New Opportunity
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Opportunity</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(formData);
              }}
              className="space-y-5"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name" className="text-sm font-medium">Opportunity Name</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required data-testid="input-opp-name" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="phase" className="text-sm font-medium">Phase</Label>
                  <Select value={formData.phase} onValueChange={(v) => setFormData({ ...formData, phase: v })}>
                    <SelectTrigger data-testid="select-phase" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.A - Activity">1.A - Activity</SelectItem>
                      <SelectItem value="2.B - Qualified">2.B - Qualified</SelectItem>
                      <SelectItem value="3.C - Proposal">3.C - Proposal</SelectItem>
                      <SelectItem value="4.D - Shortlisted">4.D - Shortlisted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="workType" className="text-sm font-medium">Work Type</Label>
                  <Select value={formData.workType} onValueChange={(v) => setFormData({ ...formData, workType: v })}>
                    <SelectTrigger data-testid="select-work-type" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Delivery">Delivery</SelectItem>
                      <SelectItem value="Resource Pool">Resource Pool</SelectItem>
                      <SelectItem value="RFI/EOI">RFI/EOI</SelectItem>
                      <SelectItem value="Project">Project</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="value" className="text-sm font-medium">Value ($ ex GST)</Label>
                  <Input id="value" type="number" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} data-testid="input-value" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="margin" className="text-sm font-medium">Margin (%)</Label>
                  <Input id="margin" type="number" step="0.01" value={formData.margin} onChange={(e) => setFormData({ ...formData, margin: e.target.value })} data-testid="input-margin" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="casLead" className="text-sm font-medium">CAS Lead</Label>
                  <Input id="casLead" value={formData.casLead} onChange={(e) => setFormData({ ...formData, casLead: e.target.value })} data-testid="input-cas-lead" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="csdLead" className="text-sm font-medium">CSD Lead</Label>
                  <Input id="csdLead" value={formData.csdLead} onChange={(e) => setFormData({ ...formData, csdLead: e.target.value })} data-testid="input-csd-lead" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="partner" className="text-sm font-medium">Partner</Label>
                  <Input id="partner" value={formData.partner} onChange={(e) => setFormData({ ...formData, partner: e.target.value })} data-testid="input-partner" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="clientCode" className="text-sm font-medium">Client Code</Label>
                  <Input id="clientCode" value={formData.clientCode} onChange={(e) => setFormData({ ...formData, clientCode: e.target.value })} data-testid="input-client-code" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="category" className="text-sm font-medium">Category</Label>
                  <Input id="category" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} data-testid="input-category" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="status" className="text-sm font-medium">Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger data-testid="select-status" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Risk">Risk</SelectItem>
                      <SelectItem value="On Hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="comment" className="text-sm font-medium">Comment</Label>
                  <Textarea id="comment" value={formData.comment} onChange={(e) => setFormData({ ...formData, comment: e.target.value })} data-testid="input-comment" className="mt-1.5" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-opp">
                  {createMutation.isPending ? "Creating..." : "Create Opportunity"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative animate-fade-in stagger-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, client, or partner..."
          className="pl-9 h-10 bg-card"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-opps"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="animate-fade-in">
          <CardContent className="py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Target className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-base font-semibold">No opportunities found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">Create a new opportunity or adjust your search to find what you're looking for.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((opp, idx) => (
            <Card key={opp.id} className={`animate-fade-in stagger-${Math.min(idx + 1, 6)} hover-elevate cursor-pointer group`} data-testid={`card-opportunity-${opp.id}`}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm leading-tight truncate" data-testid={`text-opp-name-${opp.id}`}>{opp.name}</h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {opp.phase && <Badge variant="outline" className="text-[13px] font-medium">{opp.phase}</Badge>}
                      {opp.status && (
                        <Badge className={`text-[13px] font-medium border ${getStatusColor(opp.status)}`}>
                          {opp.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-sm px-2"
                      onClick={() => createBidMutation.mutate(opp)}
                      disabled={createBidMutation.isPending}
                      data-testid={`button-create-bid-${opp.id}`}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Bid
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(opp.id)}
                      data-testid={`button-delete-opp-${opp.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {opp.clientCode && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Building2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">{opp.clientCode}</span>
                    </div>
                  )}
                  {opp.value && (
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3 w-3 shrink-0 text-chart-2" />
                      <span className="font-medium">${(opp.value / 1000).toFixed(0)}K</span>
                      {opp.margin && <span className="text-muted-foreground">({(opp.margin * 100).toFixed(0)}%)</span>}
                    </div>
                  )}
                  {opp.workType && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">{opp.workType}</span>
                    </div>
                  )}
                  {(opp.casLead || opp.csdLead) && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">{[opp.casLead, opp.csdLead].filter(Boolean).join(" / ")}</span>
                    </div>
                  )}
                </div>

                {opp.comment && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-1 border-t border-border/50 pt-2">{opp.comment}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
