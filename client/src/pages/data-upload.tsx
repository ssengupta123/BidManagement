import { useState, useRef, useMemo, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Target, FileText, ClipboardList, Info, Zap, Calendar, Users, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import * as XLSX from "xlsx";

type UploadType = "opportunities" | "bids" | "job-plans";

const FIELD_DEFS: Record<UploadType, { key: string; label: string; required?: boolean }[]> = {
  opportunities: [
    { key: "name", label: "Name", required: true },
    { key: "phase", label: "Phase" },
    { key: "value", label: "Value" },
    { key: "margin", label: "Margin" },
    { key: "workType", label: "Work Type" },
    { key: "vat", label: "VAT" },
    { key: "status", label: "Status" },
    { key: "comment", label: "Comment" },
    { key: "casLead", label: "CAS Lead" },
    { key: "csdLead", label: "CSD Lead" },
    { key: "category", label: "Category" },
    { key: "partner", label: "Partner" },
    { key: "clientContact", label: "Client Contact" },
    { key: "clientCode", label: "Client Code" },
    { key: "channel", label: "Channel" },
    { key: "priority", label: "Priority" },
    { key: "assignedTo", label: "Assigned To" },
    { key: "careDecision", label: "CARE Decision" },
    { key: "dateIn", label: "Date In" },
    { key: "source", label: "Source" },
  ],
  bids: [
    { key: "title", label: "Title", required: true },
    { key: "opportunityId", label: "Opportunity ID" },
    { key: "stage", label: "Stage" },
    { key: "casQualified", label: "CAS Qualified" },
    { key: "csdQualified", label: "CSD Qualified" },
  ],
  "job-plans": [
    { key: "milestone", label: "Milestone" },
    { key: "deliverable", label: "Deliverable" },
    { key: "resource", label: "Resource" },
    { key: "chargeOutLevel", label: "Charge Out Level" },
    { key: "jobRole", label: "Job Role" },
    { key: "panelHourlyRate", label: "Panel Hourly Rate" },
    { key: "discountPercent", label: "Discount %" },
    { key: "budgetHours", label: "Budget Hours" },
    { key: "forecastHours", label: "Forecast Hours" },
    { key: "weeklyAllocations", label: "Weekly Allocations" },
  ],
};

const HEADER_ALIASES: Record<string, string> = {
  "name": "name", "opportunity name": "name", "opp name": "name",
  "title": "title", "bid title": "title", "bid name": "title", "plan title": "title",
  "phase": "phase", "value": "value", "value $": "value", "value $ ex gst": "value",
  "margin": "margin", "margin %": "margin",
  "work type": "workType", "worktype": "workType", "work_type": "workType",
  "vat": "vat", "status": "status", "comment": "comment", "comments": "comment",
  "cas lead": "casLead", "caslead": "casLead", "cas_lead": "casLead",
  "csd lead": "csdLead", "csdlead": "csdLead", "csd_lead": "csdLead",
  "category": "category", "partner": "partner",
  "client contact": "clientContact", "clientcontact": "clientContact", "client_contact": "clientContact",
  "client code": "clientCode", "clientcode": "clientCode", "client_code": "clientCode",
  "opportunity id": "opportunityId", "opportunityid": "opportunityId", "opportunity_id": "opportunityId", "opp id": "opportunityId",
  "stage": "stage",
  "cas qualified": "casQualified", "casqualified": "casQualified", "cas_qualified": "casQualified",
  "csd qualified": "csdQualified", "csdqualified": "csdQualified", "csd_qualified": "csdQualified",
  "bid id": "bidId", "bidid": "bidId", "bid_id": "bidId",
  "contract start date": "contractStartDate", "contract_start_date": "contractStartDate",
  "forecast date": "forecastDate", "forecastdate": "forecastDate", "forecast_date": "forecastDate",
  "due date": "dueDate", "duedate": "dueDate", "due_date": "dueDate",
  "expiry": "expiryDate", "expiry date": "expiryDate", "expiry_date": "expiryDate",
  "milestone": "milestone", "milestone/workstream": "milestone", "by milestone/workstream": "milestone",
  "deliverable": "deliverable",
  "start date": "startDate", "startdate": "startDate", "start_date": "startDate",
  "end date": "endDate", "enddate": "endDate", "end_date": "endDate",
  "week number": "weekNumber", "weeknumber": "weekNumber", "week_number": "weekNumber",
  "cost $ ex gst": "costExGst", "cost ex gst": "costExGst", "cost": "costExGst", "cost $": "costExGst",
  "resource": "resource", "resource name": "resource",
  "charge out level": "chargeOutLevel", "chargeoutlevel": "chargeOutLevel", "level": "chargeOutLevel",
  "job role": "jobRole", "jobrole": "jobRole", "job_role": "jobRole", "role": "jobRole",
  "panel hourly rate": "panelHourlyRate", "hourly rate": "panelHourlyRate",
  "panel hourly\r\nrate $ ex-gst": "panelHourlyRate", "panel hourly rate $ ex-gst": "panelHourlyRate",
  "discount (%)": "discountPercent", "discount": "discountPercent", "discount %": "discountPercent",
  "hourly\r\ngross cost $": "hourlyGrossCost", "hourly gross cost $": "hourlyGrossCost", "hourly gross cost": "hourlyGrossCost",
  "budget hours": "budgetHours", "budget_hours": "budgetHours",
  "forecast hours": "forecastHours", "forecast_hours": "forecastHours",
  "forecast\r\nhours": "forecastHours",
  "actual hours": "actualHours", "actual_hours": "actualHours",
  "actual hours\r\nas at": "actualHours",
  "channel": "channel", "channel-in": "channel", "channel in": "channel",
  "priority": "priority",
  "assigned to": "assignedTo", "assignedto": "assignedTo", "assigned_to": "assignedTo",
  "care/decision": "careDecision", "care decision": "careDecision", "care": "careDecision",
  "date-in": "dateIn", "date in": "dateIn", "datein": "dateIn",
  "client/opportunity": "name",
  "cc": "clientCode",
  "due": "dueDate", "date due": "dueDate", "date-due": "dueDate",
  "modified by": "modifiedBy", "created by": "createdBy",
  "source": "source",
};

function resolveHeader(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (HEADER_ALIASES[lower]) return HEADER_ALIASES[lower];
  for (const [alias, target] of Object.entries(HEADER_ALIASES)) {
    if (lower.startsWith(alias)) return target;
  }
  return lower;
}

function excelDateToJS(serial: number): Date {
  const epoch = new Date(1899, 11, 30);
  return new Date(epoch.getTime() + serial * 86400000);
}

function isExcelDate(val: any): boolean {
  return typeof val === "number" && val > 40000 && val < 60000;
}

function parseDateString(val: string): Date | null {
  const trimmed = val.trim();
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(dt.getTime())) return dt;
  }
  const yyyymmdd = trimmed.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (yyyymmdd) {
    const [, y, m, d] = yyyymmdd;
    const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(dt.getTime())) return dt;
  }
  const dt = new Date(trimmed);
  if (!isNaN(dt.getTime())) return dt;
  return null;
}

function toISODate(val: any): string {
  if (typeof val === "number" && isExcelDate(val)) return excelDateToJS(val).toISOString().split("T")[0];
  if (val instanceof Date) return val.toISOString().split("T")[0];
  if (typeof val === "string") {
    const dt = parseDateString(val);
    if (dt) return dt.toISOString().split("T")[0];
  }
  return "";
}

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

interface TimePlanMeta {
  contractStartDate: string;
  forecastDate: string;
  accountManager: string;
  engagementManager: string;
  panel: string;
  category: string;
}

interface TimePlanLine {
  milestone: string;
  deliverable: string;
  resource: string;
  chargeOutLevel: string;
  jobRole: string;
  panelHourlyRate: number;
  discountPercent: number;
  hourlyGrossCost: number;
  budgetHours: number;
  forecastHours: number;
  actualHours: number;
  weeklyAllocations: Record<string, number>;
  sortOrder: number;
}

interface PricingMilestone {
  milestone: string;
  startDate: string;
  endDate: string;
  weekNumber: number;
  costExGst: number;
}

interface SmartJobPlanData {
  meta: TimePlanMeta;
  lines: TimePlanLine[];
  pricingMilestones: PricingMilestone[];
  totalBudgetHours: number;
  totalForecastHours: number;
}

function detectTimePlanSheet(wb: XLSX.WorkBook): boolean {
  const tpSheet = wb.Sheets["Time Plan"];
  if (!tpSheet) return false;
  const cell = tpSheet[XLSX.utils.encode_cell({ r: 1, c: 1 })];
  return cell?.v?.toString().toLowerCase().includes("contract start date") || false;
}

function parseTimePlanMetadata(sheet: XLSX.WorkSheet): TimePlanMeta {
  const getCellVal = (r: number, c: number) => {
    const cell = sheet[XLSX.utils.encode_cell({ r, c })];
    return cell?.v !== undefined ? cell.v : "";
  };

  const forecastDateRaw = getCellVal(0, 2);
  const contractStartRaw = getCellVal(1, 2);

  return {
    forecastDate: toISODate(forecastDateRaw),
    contractStartDate: toISODate(contractStartRaw),
    accountManager: String(getCellVal(0, 4) || ""),
    engagementManager: String(getCellVal(1, 4) || ""),
    panel: String(getCellVal(0, 6) || ""),
    category: String(getCellVal(1, 6) || ""),
  };
}

function findTimePlanHeaderRow(sheet: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  for (let r = 0; r <= Math.min(range.e.r, 10); r++) {
    for (let c = range.s.c; c <= Math.min(range.e.c, 20); c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && String(cell.v).toLowerCase().trim() === "milestone") return r;
    }
  }
  return 2;
}

function buildTimePlanColumnMap(sheet: XLSX.WorkSheet, headerRow: number): Record<string, number> {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const colMap: Record<string, number> = {};
  const TP_ALIASES: Record<string, string> = {
    "milestone": "milestone", "milestone/workstream": "milestone",
    "deliverable": "deliverable",
    "resource": "resource",
    "charge out level": "chargeOutLevel",
    "job role": "jobRole",
    "panel hourly\r\nrate $ ex-gst": "panelHourlyRate", "panel hourly rate $ ex-gst": "panelHourlyRate", "panel hourly rate": "panelHourlyRate",
    "discount (%)": "discountPercent", "discount": "discountPercent",
    "hourly\r\ngross cost $": "hourlyGrossCost", "hourly gross cost $": "hourlyGrossCost", "hourly gross cost": "hourlyGrossCost",
    "budget hours": "budgetHours",
    "actual hours": "actualHours",
    "forecast\r\nhours": "forecastHours", "forecast hours": "forecastHours",
  };

  for (let c = range.s.c; c <= Math.min(range.e.c, 30); c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    if (!cell || cell.v === undefined) continue;
    const raw = String(cell.v).toLowerCase().trim();
    if (TP_ALIASES[raw]) {
      colMap[TP_ALIASES[raw]] = c;
    } else {
      for (const [alias, target] of Object.entries(TP_ALIASES)) {
        if (raw.startsWith(alias) && !colMap[target]) {
          colMap[target] = c;
        }
      }
    }
  }
  return colMap;
}

function parseTimePlanLines(sheet: XLSX.WorkSheet): { lines: TimePlanLine[]; weekDates: string[] } {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const headerRow = findTimePlanHeaderRow(sheet);
  const colMap = buildTimePlanColumnMap(sheet, headerRow);

  const milestoneCol = colMap.milestone ?? 1;
  const resourceCol = colMap.resource ?? 3;

  let firstWeekCol = -1;
  for (let c = Math.max(milestoneCol + 1, 10); c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    if (cell && isExcelDate(cell.v)) { firstWeekCol = c; break; }
  }
  if (firstWeekCol < 0) firstWeekCol = range.e.c + 1;

  const weekDates: string[] = [];
  for (let c = firstWeekCol; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    if (cell && isExcelDate(cell.v)) {
      weekDates.push(getMondayOfWeek(excelDateToJS(cell.v as number)));
    } else if (cell && typeof cell.v === "string") {
      const dt = parseDateString(String(cell.v));
      if (dt) weekDates.push(getMondayOfWeek(dt));
      else weekDates.push("");
    } else {
      weekDates.push("");
    }
  }

  const getCellVal = (r: number, c: number) => {
    const cell = sheet[XLSX.utils.encode_cell({ r, c })];
    return cell?.v !== undefined ? cell.v : "";
  };
  const getNum = (r: number, c: number | undefined) => {
    if (c === undefined) return 0;
    const v = getCellVal(r, c);
    return typeof v === "number" ? v : parseFloat(String(v)) || 0;
  };

  const lines: TimePlanLine[] = [];
  let sortOrder = 0;

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const resource = String(getCellVal(r, resourceCol)).trim();
    if (!resource) continue;
    const milestone = String(getCellVal(r, milestoneCol)).trim();
    if (!milestone) continue;

    sortOrder++;

    const allocations: Record<string, number> = {};
    for (let c = firstWeekCol; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === "number" && cell.v > 0) {
        const weekDate = weekDates[c - firstWeekCol];
        if (weekDate) {
          const pct = Math.round(cell.v * 1000) / 10;
          allocations[weekDate] = pct;
        }
      }
    }

    const discountRaw = getNum(r, colMap.discountPercent);
    const discountPct = discountRaw > 0 && discountRaw < 1 ? discountRaw * 100 : discountRaw;

    lines.push({
      milestone,
      deliverable: colMap.deliverable !== undefined ? String(getCellVal(r, colMap.deliverable)).trim() : "",
      resource,
      chargeOutLevel: colMap.chargeOutLevel !== undefined ? String(getCellVal(r, colMap.chargeOutLevel)).trim() : "",
      jobRole: colMap.jobRole !== undefined ? String(getCellVal(r, colMap.jobRole)).trim() : "",
      panelHourlyRate: getNum(r, colMap.panelHourlyRate),
      discountPercent: discountPct,
      hourlyGrossCost: getNum(r, colMap.hourlyGrossCost),
      budgetHours: getNum(r, colMap.budgetHours),
      forecastHours: getNum(r, colMap.forecastHours),
      actualHours: getNum(r, colMap.actualHours),
      weeklyAllocations: allocations,
      sortOrder,
    });
  }

  return { lines, weekDates: weekDates.filter(Boolean) };
}

function parsePricingSheet(sheet: XLSX.WorkSheet): PricingMilestone[] {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const milestones: PricingMilestone[] = [];

  let headerRow = -1;
  let milestoneCol = 1, startCol = 2, endCol = 3, weekCol = 4, costCol = 5;

  for (let r = 0; r <= Math.min(range.e.r, 10); r++) {
    for (let c = range.s.c; c <= Math.min(range.e.c, 15); c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && String(cell.v).toLowerCase().trim() === "milestone") {
        headerRow = r;
        milestoneCol = c;
        for (let cc = c + 1; cc <= Math.min(range.e.c, c + 10); cc++) {
          const hCell = sheet[XLSX.utils.encode_cell({ r, c: cc })];
          if (!hCell) continue;
          const hVal = String(hCell.v).toLowerCase().trim();
          if (hVal === "start date" || hVal.startsWith("start")) startCol = cc;
          else if (hVal === "end date" || hVal.startsWith("end")) endCol = cc;
          else if (hVal === "week number" || hVal.startsWith("week")) weekCol = cc;
          else if (hVal.includes("cost") && hVal.includes("ex gst")) costCol = cc;
        }
        break;
      }
    }
    if (headerRow >= 0) break;
  }
  if (headerRow < 0) headerRow = 2;

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const getCellVal = (c: number) => {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      return cell?.v !== undefined ? cell.v : "";
    };

    const milestone = String(getCellVal(milestoneCol)).trim();
    if (!milestone) continue;
    const lower = milestone.toLowerCase();
    if (lower === "total" || lower === "grand total" || lower.startsWith("total ")) continue;

    milestones.push({
      milestone,
      startDate: toISODate(getCellVal(startCol)),
      endDate: toISODate(getCellVal(endCol)),
      weekNumber: typeof getCellVal(weekCol) === "number" ? getCellVal(weekCol) as number : parseInt(String(getCellVal(weekCol))) || 0,
      costExGst: typeof getCellVal(costCol) === "number" ? getCellVal(costCol) as number : parseFloat(String(getCellVal(costCol))) || 0,
    });
  }

  return milestones;
}

function parseSmartJobPlan(wb: XLSX.WorkBook): SmartJobPlanData | null {
  const tpSheet = wb.Sheets["Time Plan"];
  if (!tpSheet) return null;

  const meta = parseTimePlanMetadata(tpSheet);
  const { lines } = parseTimePlanLines(tpSheet);

  let pricingMilestones: PricingMilestone[] = [];
  const pricingSheet = wb.Sheets["Pricing"];
  if (pricingSheet) {
    pricingMilestones = parsePricingSheet(pricingSheet);
  }

  return {
    meta,
    lines,
    pricingMilestones,
    totalBudgetHours: lines.reduce((s, l) => s + l.budgetHours, 0),
    totalForecastHours: lines.reduce((s, l) => s + l.forecastHours, 0),
  };
}

function detectHeaderRow(sheet: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const knownHeaders = new Set(Object.keys(HEADER_ALIASES));
  for (let r = range.s.r; r <= Math.min(range.e.r, 10); r++) {
    let matchCount = 0;
    let cellCount = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v !== undefined && cell.v !== "") {
        cellCount++;
        const val = String(cell.v).toLowerCase().trim();
        if (knownHeaders.has(val)) matchCount++;
      }
    }
    if (matchCount >= 2 || (cellCount >= 2 && matchCount >= 1 && cellCount <= 10)) return r;
  }
  return 0;
}

function parseSheetSmart(sheet: XLSX.WorkSheet): { headers: string[]; rows: Record<string, any>[] } {
  const headerRowIdx = detectHeaderRow(sheet);
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const rawHeaders: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRowIdx, c })];
    rawHeaders.push(cell && cell.v !== undefined ? String(cell.v).trim() : `__empty_${c}`);
  }
  const mappedHeaders = rawHeaders.map(resolveHeader);
  const rows: Record<string, any>[] = [];
  for (let r = headerRowIdx + 1; r <= range.e.r; r++) {
    const row: Record<string, any> = {};
    let hasData = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell || cell.v === undefined || cell.v === "") continue;
      const key = mappedHeaders[c - range.s.c];
      if (!key || key.startsWith("__empty")) continue;
      let val = cell.v;
      if (typeof val === "string") val = val.trim();
      if (val !== "" && val !== null && val !== undefined) { hasData = true; row[key] = val; }
    }
    if (hasData) rows.push(row);
  }
  return { headers: mappedHeaders.filter((h) => !h.startsWith("__empty")), rows };
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?(p|div|li|td|tr|th|table|tbody|thead|span|a|b|i|strong|em|font|ul|ol)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSheetData(sheet: XLSX.WorkSheet): { headers: string[]; rows: Record<string, any>[] } {
  const result = parseSheetSmart(sheet);
  result.rows = result.rows.map((row) => {
    const mapped: Record<string, any> = {};
    for (const [key, val] of Object.entries(row)) {
      if (["value", "margin", "costExGst", "panelHourlyRate", "budgetHours", "forecastHours"].includes(key)) {
        const num = parseFloat(String(val).replace(/[$,%]/g, ""));
        if (!isNaN(num)) { mapped[key] = num; continue; }
      }
      if (["opportunityId", "bidId", "weekNumber"].includes(key)) {
        const num = parseInt(String(val));
        if (!isNaN(num)) { mapped[key] = num; continue; }
      }
      if (["startDate", "endDate", "contractStartDate", "forecastDate", "dueDate", "dateIn"].includes(key)) {
        const iso = toISODate(val);
        if (iso) { mapped[key] = iso; continue; }
      }
      if (["name", "careDecision", "comment"].includes(key) && typeof val === "string" && (val.includes("<") || val.includes("&"))) {
        mapped[key] = stripHtml(val);
        continue;
      }
      mapped[key] = val;
    }
    return mapped;
  });
  return result;
}

function SmartJobPlanPreview({ data, title, onTitleChange, onUpload, isPending }: {
  data: SmartJobPlanData;
  title: string;
  onTitleChange: (t: string) => void;
  onUpload: () => void;
  isPending: boolean;
}) {
  const milestoneGroups = useMemo(() => {
    const groups: Record<string, TimePlanLine[]> = {};
    data.lines.forEach((l) => {
      if (!groups[l.milestone]) groups[l.milestone] = [];
      groups[l.milestone].push(l);
    });
    return groups;
  }, [data.lines]);

  const milestoneNames = Object.keys(milestoneGroups);

  return (
    <div className="space-y-4">
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Smart Import Detected</span>
          <Badge variant="secondary" className="text-[10px]">Time Plan + Pricing</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Found Time Plan sheet with {data.lines.length} resource lines across {milestoneNames.length} milestones,
          plus Pricing sheet with {data.pricingMilestones.length} milestone summaries.
          Weekly allocations will be imported automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-muted/30 rounded-lg p-3 border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Users className="h-3 w-3" /> Resources
          </div>
          <p className="text-lg font-semibold" data-testid="text-smart-resources">{data.lines.length}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <ClipboardList className="h-3 w-3" /> Milestones
          </div>
          <p className="text-lg font-semibold" data-testid="text-smart-milestones">{milestoneNames.length}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Calendar className="h-3 w-3" /> Budget Hours
          </div>
          <p className="text-lg font-semibold" data-testid="text-smart-budget-hours">{Math.round(data.totalBudgetHours).toLocaleString()}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <DollarSign className="h-3 w-3" /> Forecast Hours
          </div>
          <p className="text-lg font-semibold" data-testid="text-smart-forecast-hours">{Math.round(data.totalForecastHours).toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-muted/30 rounded-lg p-4 space-y-3 border">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Info className="h-3.5 w-3.5 text-primary" />
          Job Plan Settings
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-[11px]">Plan Title</Label>
            <Input
              className="h-8 text-xs mt-1"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Enter plan title"
              data-testid="input-job-plan-title"
            />
          </div>
          <div>
            <Label className="text-[11px]">Contract Start</Label>
            <Input
              className="h-8 text-xs mt-1"
              value={data.meta.contractStartDate || "Not detected"}
              readOnly
              data-testid="input-derived-start"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">From Time Plan metadata</p>
          </div>
          <div>
            <Label className="text-[11px]">Forecast Date</Label>
            <Input
              className="h-8 text-xs mt-1"
              value={data.meta.forecastDate || "Not detected"}
              readOnly
              data-testid="input-derived-end"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">From Time Plan metadata</p>
          </div>
        </div>
        {(data.meta.accountManager || data.meta.engagementManager) && (
          <div className="flex gap-4 text-[10px] text-muted-foreground">
            {data.meta.accountManager && <span>Account Manager: <span className="text-foreground">{data.meta.accountManager}</span></span>}
            {data.meta.engagementManager && <span>Engagement Manager: <span className="text-foreground">{data.meta.engagementManager}</span></span>}
            {data.meta.panel && <span>Panel: <span className="text-foreground">{data.meta.panel}</span></span>}
          </div>
        )}
      </div>

      {data.pricingMilestones.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
            <DollarSign className="h-3 w-3" />
            Pricing Summary ({data.pricingMilestones.length} milestones)
          </p>
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-48">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium text-muted-foreground">Milestone</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Start</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">End</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Weeks</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Cost $ ex GST</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pricingMilestones.map((m, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 font-medium">{m.milestone}</td>
                      <td className="p-2 text-muted-foreground">{m.startDate}</td>
                      <td className="p-2 text-muted-foreground">{m.endDate}</td>
                      <td className="p-2 text-right">{m.weekNumber}</td>
                      <td className="p-2 text-right font-mono">${m.costExGst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
          <Users className="h-3 w-3" />
          Resource Lines ({data.lines.length} lines across {milestoneNames.length} milestones)
        </p>
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium text-muted-foreground w-8">#</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Milestone</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Deliverable</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Resource</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Level</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Role</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Rate</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Budget Hrs</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Forecast Hrs</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Alloc Weeks</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.slice(0, 50).map((line, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 text-muted-foreground">{i + 1}</td>
                    <td className="p-2 max-w-[150px] truncate font-medium">{line.milestone}</td>
                    <td className="p-2 max-w-[120px] truncate">{line.deliverable}</td>
                    <td className="p-2 whitespace-nowrap">{line.resource}</td>
                    <td className="p-2 whitespace-nowrap text-muted-foreground">{line.chargeOutLevel}</td>
                    <td className="p-2 max-w-[120px] truncate text-muted-foreground">{line.jobRole}</td>
                    <td className="p-2 text-right font-mono">${line.panelHourlyRate}</td>
                    <td className="p-2 text-right">{Math.round(line.budgetHours)}</td>
                    <td className="p-2 text-right">{Math.round(line.forecastHours)}</td>
                    <td className="p-2 text-right">
                      <Badge variant="secondary" className="text-[9px]">
                        {Object.keys(line.weeklyAllocations).length}w
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.lines.length > 50 && (
            <p className="text-xs text-muted-foreground p-2 bg-muted/30 text-center">
              Showing first 50 of {data.lines.length} lines
            </p>
          )}
        </div>
      </div>

      <Button
        onClick={onUpload}
        disabled={isPending}
        className="w-full"
        data-testid="button-upload-job-plans"
      >
        {isPending ? "Creating Job Plan..." : `Create Job Plan with ${data.lines.length} resource lines`}
      </Button>
    </div>
  );
}

function UploadPanel({ type }: { type: UploadType }) {
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);
  const [fileName, setFileName] = useState("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [jobPlanTitle, setJobPlanTitle] = useState("");
  const [smartData, setSmartData] = useState<SmartJobPlanData | null>(null);
  const [useSmartImport, setUseSmartImport] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const fields = FIELD_DEFS[type];

  const endpoint = type === "opportunities" ? "/api/opportunities/upload"
    : type === "bids" ? "/api/bids/upload"
    : "/api/job-plans/upload";

  const invalidateKeys = type === "opportunities" ? ["/api/opportunities", "/api/dashboard/stats"]
    : type === "bids" ? ["/api/bids", "/api/dashboard/stats"]
    : ["/api/job-plans"];

  const derivedTitle = useMemo(() => {
    if (jobPlanTitle.trim()) return jobPlanTitle.trim();
    if (fileName) return fileName.replace(/\.(xlsx|xls|csv|txt)$/i, "").replace(/_\d+$/, "").trim();
    return "Uploaded Job Plan";
  }, [fileName, jobPlanTitle]);

  const derivedDates = useMemo(() => {
    if (type !== "job-plans" || parsedRows.length === 0 || useSmartImport) return null;
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    parsedRows.forEach((r) => {
      [r.startDate, r.endDate].forEach((d) => {
        if (!d) return;
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return;
        if (!minDate || dt < minDate) minDate = dt;
        if (!maxDate || dt > maxDate) maxDate = dt;
      });
    });
    return { contractStartDate: minDate, forecastDate: maxDate };
  }, [parsedRows, type, useSmartImport]);

  const resetState = useCallback(() => {
    setParsedRows([]);
    setRawHeaders([]);
    setFileName("");
    setWorkbook(null);
    setSheetNames([]);
    setJobPlanTitle("");
    setSmartData(null);
    setUseSmartImport(false);
  }, []);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (type === "job-plans" && useSmartImport && smartData) {
        const payload = [{
          title: derivedTitle,
          bidId: null,
          contractStartDate: smartData.meta.contractStartDate || null,
          forecastDate: smartData.meta.forecastDate || null,
          lines: smartData.lines.map((l) => ({
            ...l,
            weeklyAllocations: JSON.stringify(l.weeklyAllocations),
          })),
        }];
        const res = await apiRequest("POST", endpoint, payload);
        return res.json();
      }

      if (type === "job-plans") {
        const validRows = parsedRows.filter((r) => r.milestone);
        const lines = validRows.map((row, i) => ({
          milestone: String(row.milestone || "Unassigned"),
          deliverable: row.deliverable || "",
          resource: row.resource || "",
          chargeOutLevel: row.chargeOutLevel || "Senior Consultant",
          jobRole: row.jobRole || "",
          panelHourlyRate: row.panelHourlyRate || 212.5,
          discountPercent: row.discountPercent || 0,
          hourlyGrossCost: row.hourlyGrossCost || 0,
          budgetHours: row.budgetHours || 0,
          forecastHours: row.forecastHours || 0,
          actualHours: 0,
          weeklyAllocations: "{}",
          sortOrder: i + 1,
        }));
        const payload = [{
          title: derivedTitle,
          bidId: null,
          contractStartDate: derivedDates?.contractStartDate?.toISOString() || null,
          forecastDate: derivedDates?.forecastDate?.toISOString() || null,
          lines,
        }];
        const res = await apiRequest("POST", endpoint, payload);
        return res.json();
      }

      const knownKeys = new Set(fields.map((f) => f.key));
      const allowedExtra = new Set(["name", "title", "value", "margin", "phase", "workType", "vat", "status", "comment", "casLead", "csdLead", "category", "partner", "clientContact", "clientCode", "opportunityId", "bidId", "stage", "casQualified", "csdQualified", "dueDate", "startDate", "expiryDate", "channel", "priority", "assignedTo", "careDecision", "dateIn", "source"]);
      const trimmed = parsedRows.map((r) => {
        const clean: Record<string, any> = {};
        for (const [k, v] of Object.entries(r)) {
          if (knownKeys.has(k) || allowedExtra.has(k)) {
            clean[k] = v;
          }
        }
        return clean;
      }).filter((r) => Object.keys(r).length > 0);
      const res = await apiRequest("POST", endpoint, trimmed);
      return res.json();
    },
    onSuccess: (result) => {
      invalidateKeys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      if (type === "job-plans") {
        const lineCount = useSmartImport && smartData ? smartData.lines.length : parsedRows.filter((r) => r.milestone).length;
        toast({ title: `Job plan "${derivedTitle}" created with ${lineCount} resource lines` });
      } else {
        const label = type === "opportunities"
          ? "opportunit" + (result.created !== 1 ? "ies" : "y")
          : "bid" + (result.created !== 1 ? "s" : "");
        toast({
          title: `${result.created} ${label} uploaded`,
          description: result.errors?.length > 0 ? `${result.errors.length} row(s) had errors` : undefined,
        });
      }
      resetState();
    },
    onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const loadSheet = useCallback((wb: XLSX.WorkBook, idx: number) => {
    setSelectedSheet(idx);
    const sheet = wb.Sheets[wb.SheetNames[idx]];
    const parsed = parseSheetData(sheet);
    setRawHeaders(parsed.headers);
    setParsedRows(parsed.rows);
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);

      if (type === "job-plans" && detectTimePlanSheet(wb)) {
        const smart = parseSmartJobPlan(wb);
        if (smart && smart.lines.length > 0) {
          setSmartData(smart);
          setUseSmartImport(true);
          const tpIdx = wb.SheetNames.indexOf("Time Plan");
          if (tpIdx >= 0) setSelectedSheet(tpIdx);
          return;
        }
      }

      setSmartData(null);
      setUseSmartImport(false);
      loadSheet(wb, 0);
    };
    reader.readAsArrayBuffer(file);
  };

  const switchSheet = (idx: number) => {
    if (!workbook) return;
    if (type === "job-plans" && workbook.SheetNames[idx] === "Time Plan" && smartData) {
      setUseSmartImport(true);
      setSelectedSheet(idx);
      return;
    }
    setUseSmartImport(false);
    loadSheet(workbook, idx);
  };

  const handlePasteCSV = (text: string) => {
    if (!text.trim()) return;
    const wb = XLSX.read(text, { type: "string" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const parsed = parseSheetData(sheet);
    setRawHeaders(parsed.headers);
    setParsedRows(parsed.rows);
    setFileName("");
    setWorkbook(null);
    setSheetNames([]);
    setSmartData(null);
    setUseSmartImport(false);
  };

  const requiredField = fields.find((f) => f.required);
  const validRows = parsedRows.filter((r) => requiredField ? r[requiredField.key] : true);
  const matchedFields = fields.filter((f) => rawHeaders.includes(f.key));

  const displayHeaders = useMemo(() => {
    const known = fields.map((f) => f.key);
    return [...known.filter((k) => rawHeaders.includes(k)), ...rawHeaders.filter((h) => !known.includes(h))].slice(0, 10);
  }, [rawHeaders, fields]);

  if (useSmartImport && smartData) {
    return (
      <div className="space-y-4">
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
          <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground mb-1">
            {fileName ? `Selected: ${fileName}` : "Upload an Excel (.xlsx, .xls) or CSV file"}
          </p>
          <p className="text-xs text-muted-foreground/60 mb-4">Supports .xlsx, .xls, .csv — headers are auto-detected</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={handleFile} data-testid={`input-upload-file-${type}`} />
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} data-testid={`button-browse-${type}`}>Browse Files</Button>
        </div>

        {sheetNames.length > 1 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Select sheet to import:</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {sheetNames.map((name, i) => (
                <Button key={name} size="sm" variant={i === selectedSheet ? "default" : "outline"} className="h-7 px-3 text-[11px]" onClick={() => switchSheet(i)} data-testid={`button-sheet-${i}`}>
                  {name}
                </Button>
              ))}
            </div>
          </div>
        )}

        <SmartJobPlanPreview
          data={smartData}
          title={jobPlanTitle || derivedTitle}
          onTitleChange={setJobPlanTitle}
          onUpload={() => uploadMutation.mutate()}
          isPending={uploadMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
        <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground mb-1">
          {fileName ? `Selected: ${fileName}` : "Upload an Excel (.xlsx, .xls) or CSV file"}
        </p>
        <p className="text-xs text-muted-foreground/60 mb-4">Supports .xlsx, .xls, .csv — headers are auto-detected</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={handleFile} data-testid={`input-upload-file-${type}`} />
        <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} data-testid={`button-browse-${type}`}>Browse Files</Button>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Or paste CSV/tab-separated data:</p>
        <textarea
          className="w-full h-24 text-xs font-mono border rounded-md p-2 bg-muted/30 resize-y"
          placeholder={`Paste data here... e.g.\n${fields.map((f) => f.label).slice(0, 5).join("\t")}\nRow 1 data...`}
          onChange={(e) => handlePasteCSV(e.target.value)}
          data-testid={`textarea-paste-${type}`}
        />
      </div>

      {sheetNames.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Select sheet to import:</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {sheetNames.map((name, i) => (
              <Button key={name} size="sm" variant={i === selectedSheet ? "default" : "outline"} className="h-7 px-3 text-[11px]" onClick={() => switchSheet(i)} data-testid={`button-sheet-${i}`}>
                {name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {type === "job-plans" && parsedRows.length > 0 && !useSmartImport && (
        <div className="bg-muted/30 rounded-lg p-4 space-y-3 border">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Info className="h-3.5 w-3.5 text-primary" />
            Job Plan Settings
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-[11px]">Plan Title</Label>
              <Input className="h-8 text-xs mt-1" value={jobPlanTitle} onChange={(e) => setJobPlanTitle(e.target.value)} placeholder={derivedTitle} data-testid="input-job-plan-title" />
              <p className="text-[10px] text-muted-foreground mt-0.5">Leave blank to use filename</p>
            </div>
            <div>
              <Label className="text-[11px]">Contract Start</Label>
              <Input className="h-8 text-xs mt-1" value={derivedDates?.contractStartDate ? derivedDates.contractStartDate.toISOString().split("T")[0] : "Not detected"} readOnly data-testid="input-derived-start" />
            </div>
            <div>
              <Label className="text-[11px]">Forecast End</Label>
              <Input className="h-8 text-xs mt-1" value={derivedDates?.forecastDate ? derivedDates.forecastDate.toISOString().split("T")[0] : "Not detected"} readOnly data-testid="input-derived-end" />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="font-medium text-foreground">{matchedFields.length}</span>/{fields.length} fields matched
        </span>
        <span className="flex items-center gap-1">
          <span className="font-medium text-foreground">{validRows.length}</span> valid rows
        </span>
        {parsedRows.length > validRows.length && (
          <span className="flex items-center gap-1 text-destructive">
            <AlertCircle className="h-3 w-3" />
            {parsedRows.length - validRows.length} rows missing required field
          </span>
        )}
      </div>

      <div>
        <p className="text-xs font-medium mb-2">Expected columns:</p>
        <div className="flex flex-wrap gap-1.5">
          {fields.map((f) => {
            const matched = rawHeaders.includes(f.key);
            return (
              <Badge key={f.key} variant={matched ? "default" : "outline"} className={`text-[10px] ${matched ? "" : "opacity-50"}`} data-testid={`badge-field-${f.key}`}>
                {matched && <CheckCircle className="h-2.5 w-2.5 mr-1" />}
                {f.label}{f.required ? " *" : ""}
              </Badge>
            );
          })}
        </div>
      </div>

      {parsedRows.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium text-muted-foreground w-8">#</th>
                  {displayHeaders.map((h) => (
                    <th key={h} className="text-left p-2 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 50).map((row, i) => {
                  const isValid = requiredField ? !!row[requiredField.key] : true;
                  return (
                    <tr key={i} className={`border-t ${isValid ? "" : "bg-destructive/5"}`}>
                      <td className="p-2 text-muted-foreground">{i + 1}</td>
                      {displayHeaders.map((h) => (
                        <td key={h} className="p-2 max-w-[200px] truncate">{String(row[h] ?? "")}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {parsedRows.length > 50 && (
            <p className="text-xs text-muted-foreground p-2 bg-muted/30 text-center">
              Showing first 50 of {parsedRows.length} rows
            </p>
          )}
        </div>
      )}

      {validRows.length > 0 && (
        <Button
          onClick={() => uploadMutation.mutate()}
          disabled={uploadMutation.isPending}
          className="w-full"
          data-testid={`button-upload-${type}`}
        >
          {uploadMutation.isPending ? "Uploading..." : type === "job-plans"
            ? `Create Job Plan with ${validRows.length} resource lines`
            : `Upload ${validRows.length} ${type === "opportunities" ? "Opportunities" : "Bids"}`}
        </Button>
      )}
    </div>
  );
}

export default function DataUpload() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="animate-fade-in">
        <p className="text-muted-foreground text-sm" data-testid="text-upload-title">
          Import data from Excel or CSV files
        </p>
      </div>

      <Card className="animate-fade-in stagger-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Data Upload
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="opportunities">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="opportunities" className="text-xs" data-testid="tab-upload-opportunities">
                <Target className="h-3.5 w-3.5 mr-1.5" />
                Opportunities
              </TabsTrigger>
              <TabsTrigger value="bids" className="text-xs" data-testid="tab-upload-bids">
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Bids
              </TabsTrigger>
              <TabsTrigger value="job-plans" className="text-xs" data-testid="tab-upload-job-plans">
                <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
                Job Plans
              </TabsTrigger>
            </TabsList>
            <TabsContent value="opportunities" className="mt-4">
              <UploadPanel type="opportunities" />
            </TabsContent>
            <TabsContent value="bids" className="mt-4">
              <UploadPanel type="bids" />
            </TabsContent>
            <TabsContent value="job-plans" className="mt-4">
              <UploadPanel type="job-plans" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
