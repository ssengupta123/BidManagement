import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Opportunities from "@/pages/opportunities";
import Bids from "@/pages/bids";
import BidDetail from "@/pages/bid-detail";
import JobPlans from "@/pages/job-plans";
import JobPlanDetail from "@/pages/job-plan-detail";
import ResourceAllocation from "@/pages/resource-allocation";
import DataUpload from "@/pages/data-upload";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/opportunities" component={Opportunities} />
      <Route path="/bids" component={Bids} />
      <Route path="/bids/:id" component={BidDetail} />
      <Route path="/job-plans" component={JobPlans} />
      <Route path="/job-plans/:id" component={JobPlanDetail} />
      <Route path="/resource-allocation" component={ResourceAllocation} />
      <Route path="/data-upload" component={DataUpload} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PageTitle() {
  const [location] = useLocation();
  const titles: Record<string, string> = {
    "/": "Dashboard",
    "/opportunities": "Opportunities",
    "/bids": "Bids",
    "/job-plans": "Job Plans",
    "/resource-allocation": "Resource Allocation",
    "/data-upload": "Data Upload",
  };

  if (location.startsWith("/bids/") || location.match(/^\/job-plans\/\d/)) return null;

  const title = titles[location];
  if (!title) return null;

  return (
    <h1 className="text-lg font-semibold text-foreground hidden sm:block">{title}</h1>
  );
}

const sidebarStyle = {
  "--sidebar-width": "15rem",
  "--sidebar-width-icon": "3rem",
};

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SidebarProvider style={sidebarStyle as React.CSSProperties}>
            <div className="flex h-screen w-full bg-background">
              <AppSidebar />
              <div className="flex flex-col flex-1 min-w-0">
                <header className="flex items-center justify-between gap-4 px-4 sm:px-6 border-b border-border/60 h-14 bg-background/95 backdrop-blur-sm sticky top-0 z-[999]">
                  <div className="flex items-center gap-3">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <PageTitle />
                  </div>
                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                  </div>
                </header>
                <main className="flex-1 overflow-auto">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
