import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Target,
  FileText,
  ChevronRight,
  ClipboardList,
  Users,
  Upload,
} from "lucide-react";
import logoPath from "@assets/Reason_Group_Logo_Stacked_CMYK_(1)_1772403847177.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, description: "Overview & stats" },
  { title: "Opportunities", url: "/opportunities", icon: Target, description: "Panel pipeline" },
  { title: "Bids", url: "/bids", icon: FileText, description: "Active responses" },
  { title: "Job Plans", url: "/job-plans", icon: ClipboardList, description: "Resource plans" },
  { title: "Resource Allocation", url: "/resource-allocation", icon: Users, description: "Capacity planning" },
  { title: "Data Upload", url: "/data-upload", icon: Upload, description: "Import Excel/CSV" },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="px-5 py-5">
        <div className="flex items-center gap-3">
          <img src={logoPath} alt="Reason Group" className="h-10 w-auto object-contain" />
          <h2 className="text-xs font-semibold tracking-wide uppercase text-sidebar-foreground/60 leading-tight" data-testid="text-app-title">Bid<br />Management</h2>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={isActive} className="h-11 rounded-lg px-3">
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase()}`}>
                        <item.icon className="h-[18px] w-[18px]" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{item.title}</span>
                        </div>
                        {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-5 py-4" />
    </Sidebar>
  );
}
