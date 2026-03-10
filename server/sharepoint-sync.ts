import { db } from "./db";

interface SharePointToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface SharePointListItem {
  Title?: string;
  Phase?: string;
  ItemType?: string;
  Value?: number;
  Margin?: number;
  WorkType?: string;
  StartDate?: string;
  ExpiryDate?: string;
  DueDate?: string;
  VAT?: string;
  Status?: string;
  Comment?: string;
  CASLead?: string;
  CSDLead?: string;
  Category?: string;
  Partner?: string;
  ClientContact?: string;
  ClientCode?: string;
  FileLeafRef?: string;
  [key: string]: any;
}

const PHASE_MAP: Record<string, string> = {
  "1.A - Activity": "1.A - Activity",
  "2.Q - Qualified": "2.Q - Qualified",
  "3.DF - Submitted": "3.DF - Submitted",
  "4.DVF - Shortlisted": "4.DVF - Shortlisted",
  "5.S - Selected": "5.S - Selected",
  "A": "1.A - Activity",
  "Q": "2.Q - Qualified",
  "DF": "3.DF - Submitted",
  "DVF": "4.DVF - Shortlisted",
  "S": "5.S - Selected",
};

async function getGraphToken(): Promise<SharePointToken> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Missing Azure credentials. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET.");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    console.error(`[SharePoint] Token request failed (HTTP ${resp.status}): ${errBody}`);
    throw new Error(`Failed to get Azure AD token (HTTP ${resp.status}). Check Azure credentials and tenant configuration.`);
  }

  console.log(`[SharePoint] Graph token acquired successfully`);
  return resp.json();
}

function parseSharePointDate(val: string | null | undefined): string | null {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

function cleanMultiValueField(val: string | null | undefined): string | null {
  if (!val) return null;
  return val.replaceAll(/;#\d+;#/g, "; ").replaceAll(";#", "; ").trim() || null;
}

const VAT_CANONICAL_MAP: Record<string, string> = {
  daff: "DAFF",
  disr: "DISR",
  emerging: "Emerging",
  growth: "GROWTH",
  sau: "SAU",
  "vic gov": "Vic Gov",
  vicgov: "Vic Gov",
  "vic-gov": "Vic Gov",
  victoria: "Vic Gov",
  "victorian gov": "Vic Gov",
  "victorian government": "Vic Gov",
};

function cleanVat(val: string | null | undefined): string | null {
  if (!val) return null;
  let vat = val.replaceAll(";#", "").replace(/\|.*$/, "").trim();
  if (!vat) return null;
  const mapped = VAT_CANONICAL_MAP[vat.toLowerCase()];
  if (mapped) return mapped;
  for (const [key, canonical] of Object.entries(VAT_CANONICAL_MAP)) {
    if (vat.toLowerCase().includes(key) || key.includes(vat.toLowerCase())) {
      return canonical;
    }
  }
  return vat;
}

function formatNumericField(raw: any, decimals: number): number | null {
  const num = Number(raw);
  return raw != null && !Number.isNaN(num) ? Number.parseFloat(num.toFixed(decimals)) : null;
}

function extractFieldText(val: any): string | null {
  if (val == null) return null;
  if (typeof val === "string") return val || null;
  if (typeof val === "number") return String(val);
  if (Array.isArray(val)) {
    const parts = val.map((v) => {
      if (typeof v === "string") return v;
      if (v && typeof v === "object") return v.LookupValue || v.Description || v.Email || v.Title || v.displayName || JSON.stringify(v);
      return String(v);
    }).filter(Boolean);
    return parts.length > 0 ? parts.join("; ") : null;
  }
  if (typeof val === "object") {
    return val.LookupValue || val.Description || val.Email || val.Title || val.displayName || null;
  }
  return String(val) || null;
}

function extractLookupId(item: SharePointListItem, baseName: string): string | null {
  const lookupIdKey = `${baseName}LookupId`;
  const lookupId = item[lookupIdKey];
  const directVal = item[baseName];
  if (directVal && typeof directVal !== "number") return extractFieldText(directVal);
  if (lookupId) return String(lookupId);
  return null;
}

function resolveDueDateRaw(item: SharePointListItem): string | null {
  if (typeof item.DueDate === "string") return item.DueDate;
  if (typeof item.Due === "string") return item.Due;
  return null;
}

function extractItemFields(item: SharePointListItem): Record<string, any> {
  return {
    workType: extractFieldText(item.Work_x0020_Type || item.OppWorkType || item.WorkType),
    status: extractFieldText(item.Status0 || item.RAGStatus || item.OppStatus),
    comment: extractFieldText(item.ChimComment || item.Comment || item.Comments || item.OppComment),
    casLead: extractLookupId(item, "BidLead0") || extractFieldText(item.CAS_x0020_Lead || item.CASLead),
    csdLead: extractFieldText(item.ClientManager || item.CSD_x0020_Lead || item.CSDLead),
    category: extractFieldText(item.Business || item.Category || item.OppCategory),
    partner: extractFieldText(item.Partner || item.OppPartner),
    clientContact: extractFieldText(item.Planner || item.Client_x0020_Contact || item.ClientContact),
    clientCode: extractFieldText(item.CC || item.Client_x0020_Code || item.ClientCode),
    vat: cleanVat(extractFieldText(item.Team || item.VAT || item.VATCategory || item.VAT_x0020_Category)),
    dueDate: parseSharePointDate(resolveDueDateRaw(item)),
    startDate: parseSharePointDate(typeof item.StartDate === "string" ? item.StartDate : null),
    expiryDate: parseSharePointDate(typeof item.ExpiryDate === "string" ? item.ExpiryDate : null),
  };
}

function transformSharePointOpportunity(item: SharePointListItem): { record?: any; error?: string } {
  const name = item.Title || item.FileLeafRef || "";
  if (!name) return {};

  const phaseRaw = item.Phase || item.OppPhase || item.Status || "";
  const phase = PHASE_MAP[phaseRaw] || phaseRaw || "1.A - Activity";

  const sharepointId = item._sharepointItemId ? String(item._sharepointItemId) : null;

  try {
    const value = formatNumericField(item["Value_x0024_exGST"] ?? item.Value_x0020__x0024__x0020_est_ ?? item["Value $ est."] ?? item.Value ?? item.OppValue ?? item.TotalValue, 2);
    const margin = formatNumericField(item.Margin ?? item.MarginPercent ?? item.Margin_x0025_ ?? item.OppMargin, 3);
    const fields = extractItemFields(item);

    return {
      record: {
        name,
        phase,
        value,
        margin,
        sharepointId,
        workType: fields.workType,
        status: fields.status || "New",
        comment: fields.comment,
        casLead: fields.casLead,
        csdLead: fields.csdLead,
        category: fields.category,
        partner: fields.partner,
        clientContact: fields.clientContact,
        clientCode: fields.clientCode,
        vat: fields.vat,
        dueDate: fields.dueDate,
        startDate: fields.startDate,
        expiryDate: fields.expiryDate,
        source: "SharePoint",
      },
    };
  } catch (err: any) {
    return { error: `Item "${name}": ${err.message}` };
  }
}

function getSharePointConfig(): { domain: string; sitePath: string; listName: string; folderPath: string } {
  const domain = process.env.SHAREPOINT_DOMAIN || "reasongroup.sharepoint.com";
  const sitePath = process.env.SHAREPOINT_SITE_PATH || "/sites/RGSales";
  const listName = process.env.SHAREPOINT_LIST_NAME || "Issue tracker  TEST MV";
  const folderPath = process.env.SHAREPOINT_FOLDER_PATH || "";

  if (!domain) {
    throw new Error(
      "Missing SharePoint config. Set SHAREPOINT_DOMAIN (e.g. reasongroup.sharepoint.com)."
    );
  }

  return { domain, sitePath: sitePath.startsWith("/") ? sitePath : `/${sitePath}`, listName, folderPath };
}

async function lookupSharePointSite(token: SharePointToken, siteHost: string, sitePath: string): Promise<string> {
  const siteUrl = `https://graph.microsoft.com/v1.0/sites/${siteHost}:${sitePath}`;
  console.log(`[SharePoint] Looking up site: ${siteUrl}`);
  const siteResp = await fetch(siteUrl, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!siteResp.ok) {
    const errBody = await siteResp.text();
    console.error(`[SharePoint] Site lookup failed (HTTP ${siteResp.status}): ${errBody.substring(0, 500)}`);
    throw new Error(`SharePoint site not found (HTTP ${siteResp.status}). Check SHAREPOINT_DOMAIN and SHAREPOINT_SITE_PATH.`);
  }
  const siteData = await siteResp.json();
  console.log(`[SharePoint] Found site ID: ${siteData.id}`);
  return siteData.id;
}

async function fetchFolderChildren(token: SharePointToken, siteId: string, folderPath: string): Promise<SharePointListItem[]> {
  const allItems: SharePointListItem[] = [];
  const encodedPath = folderPath.split("/").map(seg => encodeURIComponent(seg)).join("/");
  let nextUrl: string | null = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${encodedPath}:/children?$expand=listItem($expand=fields)&$top=999`;
  console.log(`[SharePoint] Fetching folder children: ${folderPath}`);

  while (nextUrl) {
    const resp: Response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error(`[SharePoint] Folder API error (HTTP ${resp.status}): ${errBody.substring(0, 500)}`);
      throw new Error(`SharePoint folder API error (HTTP ${resp.status}).`);
    }

    const data: any = await resp.json();
    for (const driveItem of (data.value || [])) {
      const fields = driveItem.listItem?.fields || {};
      fields._sharepointItemId = driveItem.listItem?.id || driveItem.id;
      if (!fields.FileLeafRef && driveItem.name) fields.FileLeafRef = driveItem.name;
      allItems.push(fields);
    }

    nextUrl = data["@odata.nextLink"] || null;
  }

  console.log(`[SharePoint] Retrieved ${allItems.length} folder children`);
  return allItems;
}

async function findSharePointList(token: SharePointToken, siteId: string, listName: string): Promise<string> {
  const listsUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists`;
  const listsResp = await fetch(listsUrl, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!listsResp.ok) {
    const errBody = await listsResp.text();
    console.error(`[SharePoint] Lists lookup failed (HTTP ${listsResp.status}): ${errBody.substring(0, 500)}`);
    throw new Error(`Failed to retrieve SharePoint lists (HTTP ${listsResp.status}).`);
  }
  const listsData = await listsResp.json();
  const allLists = listsData.value || [];

  const targetList = allLists.find((l: any) =>
    l.displayName === listName || l.name === listName
  );
  if (targetList) {
    console.log(`[SharePoint] Found list "${listName}" with ID: ${targetList.id}`);
    return targetList.id;
  }

  const available = allLists.map((l: any) => l.displayName).join(", ");
  throw new Error(`SharePoint list "${listName}" not found. Available lists: ${available}`);
}

async function fetchListItems(token: SharePointToken, siteId: string, listId: string): Promise<SharePointListItem[]> {
  const allItems: SharePointListItem[] = [];
  let nextUrl: string | null = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=999`;
  console.log(`[SharePoint] Fetching list items...`);

  while (nextUrl) {
    const resp: Response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
      },
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error(`[SharePoint] List API error (HTTP ${resp.status}): ${errBody.substring(0, 500)}`);
      throw new Error(`SharePoint List API error (HTTP ${resp.status}).`);
    }

    const data: any = await resp.json();
    const items = (data.value || []).map((item: any) => {
      const fields = item.fields || {};
      fields._sharepointItemId = item.id || fields.id;
      return fields;
    });
    allItems.push(...items);

    nextUrl = data["@odata.nextLink"] || null;
    if (allItems.length > 0 && allItems.length % 5000 === 0) {
      console.log(`[SharePoint] Fetched ${allItems.length} list items so far...`);
    }
  }

  console.log(`[SharePoint] Retrieved ${allItems.length} total list items`);
  return allItems;
}

async function listFolderNames(token: SharePointToken, siteId: string, folderPath: string): Promise<string[]> {
  let url: string;
  if (folderPath) {
    const encodedPath = folderPath.split("/").map(seg => encodeURIComponent(seg)).join("/");
    url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${encodedPath}:/children?$select=name,folder&$top=999`;
  } else {
    url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children?$select=name,folder&$top=999`;
  }
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!resp.ok) return [];
  const data: any = await resp.json();
  return (data.value || []).filter((item: any) => item.folder).map((item: any) => item.name as string);
}

async function fetchDriveFolderFiles(token: SharePointToken, siteId: string, folderPath: string): Promise<{ name: string; downloadUrl: string; id: string }[]> {
  const files: { name: string; downloadUrl: string; id: string }[] = [];
  const encodedPath = folderPath.split("/").map(seg => encodeURIComponent(seg)).join("/");
  let nextUrl: string | null = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${encodedPath}:/children?$top=999`;

  while (nextUrl) {
    const resp: Response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`Failed to list folder files (HTTP ${resp.status}): ${errBody.substring(0, 300)}`);
    }
    const data: any = await resp.json();
    for (const item of (data.value || [])) {
      if (item.file && item.name && (item.name.endsWith(".xlsx") || item.name.endsWith(".xls"))) {
        const downloadUrl = item["@microsoft.graph.downloadUrl"] || item["@content.downloadUrl"] || `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${item.id}/content`;
        files.push({ name: item.name, downloadUrl, id: item.id });
      }
    }
    nextUrl = data["@odata.nextLink"] || null;
  }

  return files;
}

async function downloadExcelFile(url: string, token: SharePointToken): Promise<Buffer> {
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!resp.ok) {
    throw new Error(`Failed to download file (HTTP ${resp.status})`);
  }
  const arrayBuffer = await resp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

const OPP_DELTA_FIELDS = [
  "name", "phase", "value", "margin", "work_type", "status",
  "due_date", "start_date", "expiry_date", "comment", "cas_lead", "csd_lead",
  "category", "partner", "client_contact", "client_code", "vat",
];

function hasOppChanges(existing: Record<string, any>, incoming: Record<string, any>): boolean {
  for (const field of OPP_DELTA_FIELDS) {
    const oldVal = existing[field] ?? null;
    const newVal = incoming[field] ?? null;
    if (String(oldVal) !== String(newVal)) return true;
  }
  return false;
}

function recordToSnake(record: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(record)) {
    out[k.replaceAll(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = v;
  }
  return out;
}

async function upsertIncomingRecord(
  trx: any,
  record: any,
  existingBySpId: Map<string, any>,
  incomingSpIds: Set<string>,
): Promise<"inserted" | "updated" | "unchanged"> {
  const snakeRecord = recordToSnake(record);
  snakeRecord.updated_at = new Date();
  const spId = snakeRecord.sharepoint_id;

  if (!spId) {
    snakeRecord.created_at = new Date();
    await trx("opportunities").insert(snakeRecord);
    return "inserted";
  }

  incomingSpIds.add(String(spId));
  const existing = existingBySpId.get(String(spId));

  if (!existing) {
    snakeRecord.created_at = new Date();
    await trx("opportunities").insert(snakeRecord);
    return "inserted";
  }

  if (hasOppChanges(existing, snakeRecord)) {
    await trx("opportunities").where("id", existing.id).update(snakeRecord);
    return "updated";
  }

  return "unchanged";
}

async function removeStaleRecords(
  trx: any,
  existingBySpId: Map<string, any>,
  incomingSpIds: Set<string>,
): Promise<number> {
  let removed = 0;
  for (const [spId, row] of Array.from(existingBySpId)) {
    if (incomingSpIds.has(spId)) continue;
    const linkedBids = await trx("bids").where("opportunity_id", row.id).count("* as count");
    if (Number(linkedBids[0]?.count) > 0) {
      await trx("opportunities").where("id", row.id).update({
        sharepoint_id: null,
        status: "Archived",
        source: "SharePoint (removed)",
        updated_at: new Date(),
      });
    } else {
      await trx("opportunities").where("id", row.id).del();
    }
    removed++;
  }
  return removed;
}

async function performOppDeltaSync(staged: any[]): Promise<{ inserted: number; updated: number; removed: number; unchanged: number }> {
  let inserted = 0;
  let updated = 0;
  let removed = 0;
  let unchanged = 0;

  await db.transaction(async (trx) => {
    const existingRows = await trx("opportunities").whereNotNull("sharepoint_id").select("*");
    const existingBySpId = new Map<string, any>();
    for (const row of existingRows) {
      if (row.sharepoint_id) {
        existingBySpId.set(String(row.sharepoint_id), row);
      }
    }

    const incomingSpIds = new Set<string>();

    for (const record of staged) {
      const result = await upsertIncomingRecord(trx, record, existingBySpId, incomingSpIds);
      if (result === "inserted") inserted++;
      else if (result === "updated") updated++;
      else unchanged++;
    }

    removed = await removeStaleRecords(trx, existingBySpId, incomingSpIds);
  });

  return { inserted, updated, removed, unchanged };
}

export async function syncSharePointOpenOpps(): Promise<{
  imported: number;
  updated: number;
  removed: number;
  unchanged: number;
  errors: string[];
  message: string;
}> {
  const config = getSharePointConfig();
  const token = await getGraphToken();
  const siteId = await lookupSharePointSite(token, config.domain, config.sitePath);

  let allItems: SharePointListItem[];

  if (config.folderPath) {
    console.log(`[SharePoint] Opps: Using folder mode: ${config.folderPath}`);
    allItems = await fetchFolderChildren(token, siteId, config.folderPath);
  } else {
    console.log(`[SharePoint] Opps: Using list mode: "${config.listName}" on ${config.sitePath}`);
    const listId = await findSharePointList(token, siteId, config.listName);
    allItems = await fetchListItems(token, siteId, listId);
  }

  const staged: any[] = [];
  const errors: string[] = [];
  for (const item of allItems) {
    const result = transformSharePointOpportunity(item);
    if (result.error) {
      errors.push(result.error);
    } else if (result.record) {
      staged.push(result.record);
    }
  }

  console.log(`[SharePoint] Opps: Staged ${staged.length} items from ${allItems.length} total (${errors.length} errors)`);
  if (errors.length > 0) {
    console.log(`[SharePoint] Opps first 5 errors: ${errors.slice(0, 5).join(" | ")}`);
  }

  const counts = await performOppDeltaSync(staged);

  const parts = [];
  if (counts.inserted > 0) parts.push(`${counts.inserted} added`);
  if (counts.updated > 0) parts.push(`${counts.updated} updated`);
  if (counts.removed > 0) parts.push(`${counts.removed} removed`);
  if (counts.unchanged > 0) parts.push(`${counts.unchanged} unchanged`);
  if (errors.length > 0) parts.push(`${errors.length} errors`);

  console.log(`[SharePoint] Opps delta sync complete: ${parts.join(", ")}`);

  return {
    imported: counts.inserted,
    updated: counts.updated,
    removed: counts.removed,
    unchanged: counts.unchanged,
    errors,
    message: `Opportunity Tracker sync: ${parts.join(", ")}.`,
  };
}

const STANDARD_WEEKLY_HOURS = 40;
const MAX_WEEKS_FROM_FIRST = 56;
const JP_HEADER_ROWS = 5;
const STD_RESOURCE_COL = 3;
const STD_RATE_COLS = { panelHourly: 6, discount: 7, discountedHourly: 8, discountedDaily: 9, grossCost: 10 };
const STD_FIRST_WEEK_COL = 20;

interface PersonData {
  rates: {
    chargeOutRate: number | null;
    discountPercent: number | null;
    discountedHourlyRate: number | null;
    discountedDailyRate: number | null;
    hourlyGrossCost: number | null;
  };
  weeklyAllocs: Record<string, number>;
}

function isJobPlanNameValid(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  const n = name.trim();
  if (n.length <= 3) return false;
  const lower = n.toLowerCase();
  if (lower === "total" || lower.startsWith("unresourced")) return false;
  if (lower.startsWith("contractor-") || lower.startsWith("subcontractor-")) return false;
  if (/^(account|engagement)\s+manager$/i.test(lower)) return false;
  if (lower === "contingency" || lower === "delivery manager") return false;
  if (lower === "perm-project administrator") return false;
  return true;
}

function extractProjectCode(filename: string): string | null {
  const m = /^([A-Z]{2,4}\d{3}(?:-\d{2,3})?)/i.exec(filename);
  return m ? m[1].toUpperCase() : null;
}

function excelDateToMonday(serial: any): Date | null {
  if (!serial || typeof serial !== "number" || serial < 40000 || serial > 55000) return null;
  const epoch = new Date(1899, 11, 30);
  const d = new Date(epoch.getTime() + serial * 86400000);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function jpDateToKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function jpParseNum(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v));
  return Number.isNaN(n) ? null : n;
}

function findResourceLoadingRow(ws: any, range: any, XLSX: any): number {
  for (let r = JP_HEADER_ROWS; r <= range.e.r; r++) {
    for (let c = 0; c <= 3; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && /^resource\s+loading$/i.test(String(cell.v).trim())) return r;
    }
  }
  return -1;
}

function getWeekColumns(ws: any, range: any, headerRow: number, firstWeekCol: number, XLSX: any): { col: number; date: Date; key: string }[] {
  const weekCols: { col: number; date: Date; key: string }[] = [];
  for (let c = firstWeekCol; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
    if (!cell) continue;
    const d = excelDateToMonday(cell.v);
    if (d) weekCols.push({ col: c, date: d, key: jpDateToKey(d) });
  }
  if (weekCols.length > MAX_WEEKS_FROM_FIRST) weekCols.length = MAX_WEEKS_FROM_FIRST;
  return weekCols;
}

function extractRates(ws: any, r: number, rateCols: typeof STD_RATE_COLS, XLSX: any) {
  return {
    chargeOutRate: jpParseNum(ws[XLSX.utils.encode_cell({ r, c: rateCols.panelHourly })]?.v),
    discountPercent: jpParseNum(ws[XLSX.utils.encode_cell({ r, c: rateCols.discount })]?.v),
    discountedHourlyRate: jpParseNum(ws[XLSX.utils.encode_cell({ r, c: rateCols.discountedHourly })]?.v),
    discountedDailyRate: rateCols.discountedDaily >= 0 ? jpParseNum(ws[XLSX.utils.encode_cell({ r, c: rateCols.discountedDaily })]?.v) : null,
    hourlyGrossCost: jpParseNum(ws[XLSX.utils.encode_cell({ r, c: rateCols.grossCost })]?.v),
  };
}

function collectWeeklyAllocs(ws: any, r: number, weekCols: { col: number; date: Date; key: string }[], XLSX: any): Record<string, number> {
  const weeklyAllocs: Record<string, number> = {};
  for (const wc of weekCols) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: wc.col })];
    const val = jpParseNum(cell?.v);
    if (val !== null && val > 0 && val <= 2) {
      weeklyAllocs[wc.key] = Math.round(val * 100);
    }
  }
  return weeklyAllocs;
}

function mergePersonData(existing: PersonData, rates: PersonData["rates"], weeklyAllocs: Record<string, number>): void {
  for (const [k, v] of Object.entries(weeklyAllocs)) {
    existing.weeklyAllocs[k] = v;
  }
  for (const [k, v] of Object.entries(rates)) {
    if (v !== null && ((existing.rates as any)[k] === null || (existing.rates as any)[k] === undefined)) {
      (existing.rates as any)[k] = v;
    }
  }
}

function extractPersonData(ws: any, range: any, weekCols: { col: number; date: Date; key: string }[], resourceCol: number, rateCols: typeof STD_RATE_COLS, XLSX: any): Map<string, PersonData> {
  const rlRow = findResourceLoadingRow(ws, range, XLSX);
  const startRow = rlRow >= 0 ? rlRow + 1 : JP_HEADER_ROWS;
  const endRow = range.e.r;

  const personMap = new Map<string, PersonData>();
  for (let r = startRow; r <= endRow; r++) {
    const nameCell = ws[XLSX.utils.encode_cell({ r, c: resourceCol })];
    if (!nameCell) continue;
    const name = String(nameCell.v).trim();
    if (!isJobPlanNameValid(name)) continue;

    const rates = extractRates(ws, r, rateCols, XLSX);
    const weeklyAllocs = collectWeeklyAllocs(ws, r, weekCols, XLSX);

    if (rlRow >= 0 && personMap.has(name)) {
      mergePersonData(personMap.get(name)!, rates, weeklyAllocs);
    } else {
      personMap.set(name, { rates, weeklyAllocs });
    }
  }
  return personMap;
}

function detectSheetFormat(ws: any, XLSX: any): string {
  const cell = ws[XLSX.utils.encode_cell({ r: 2, c: 6 })];
  if (cell && /DISCOUNTED CHARGE OUT/i.test(String(cell.v))) return "sau046";
  return "standard";
}

function extractSAU046Rates(ws: any, r: number, XLSX: any): PersonData["rates"] {
  const chargeOut = jpParseNum(ws[XLSX.utils.encode_cell({ r, c: 4 })]?.v);
  const discPct = jpParseNum(ws[XLSX.utils.encode_cell({ r, c: 5 })]?.v);
  const discountedRate = jpParseNum(ws[XLSX.utils.encode_cell({ r, c: 6 })]?.v);
  const costRate = jpParseNum(ws[XLSX.utils.encode_cell({ r, c: 7 })]?.v);
  return {
    chargeOutRate: chargeOut,
    discountPercent: discPct,
    discountedHourlyRate: discountedRate,
    discountedDailyRate: discountedRate ? discountedRate * 8 : null,
    hourlyGrossCost: costRate,
  };
}

function findFirstWeekCol(ws: any, range: any, headerRow: number, startCol: number, XLSX: any): number {
  for (let c = startCol; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
    if (cell && typeof cell.v === "number" && cell.v > 40000) return c;
  }
  return -1;
}

function processSAU046Sheet(ws: any, range: any, XLSX: any): Map<string, PersonData> {
  const resourceCol = 1;
  const firstWeekCol = findFirstWeekCol(ws, range, 2, 10, XLSX);
  if (firstWeekCol < 0) return new Map();
  const weekCols = getWeekColumns(ws, range, 2, firstWeekCol, XLSX);

  const personMap = new Map<string, PersonData>();
  for (let r = JP_HEADER_ROWS; r <= range.e.r; r++) {
    const nameCell = ws[XLSX.utils.encode_cell({ r, c: resourceCol })];
    if (!nameCell) continue;
    const name = String(nameCell.v).trim();
    if (!isJobPlanNameValid(name)) continue;

    const rates = extractSAU046Rates(ws, r, XLSX);
    const weeklyAllocs = collectWeeklyAllocs(ws, r, weekCols, XLSX);
    personMap.set(name, { rates, weeklyAllocs });
  }
  return personMap;
}

function selectBestSheet(wb: any, XLSX: any): string {
  const candidates = wb.SheetNames.filter((s: string) => /time.?plan/i.test(s));
  if (candidates.length === 0) return wb.SheetNames[0];
  if (candidates.length === 1) return candidates[0];

  const filtered = candidates.filter(
    (s: string) => !/multiple|partial|single|lacy|old/i.test(s)
  );

  for (const name of filtered.length > 0 ? filtered : candidates) {
    const ws = wb.Sheets[name];
    if (!ws?.["!ref"]) continue;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    let count = 0;
    for (let r = JP_HEADER_ROWS; r <= Math.min(range.e.r, 50); r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: STD_RESOURCE_COL })];
      if (cell && isJobPlanNameValid(String(cell.v).trim())) count++;
    }
    if (count > 0) return name;
  }

  return candidates[0];
}

function extractPersonMapFromSheet(
  ws: any,
  range: any,
  format: string,
  XLSX: any,
): Map<string, PersonData> | { error: string } {
  if (format === "sau046") {
    return processSAU046Sheet(ws, range, XLSX);
  }
  const weekCols = getWeekColumns(ws, range, 2, STD_FIRST_WEEK_COL, XLSX);
  if (weekCols.length === 0) {
    return { error: "no week columns found" };
  }
  return extractPersonData(ws, range, weekCols, STD_RESOURCE_COL, STD_RATE_COLS, XLSX);
}

function excelSerialToDateStr(serial: any): string | null {
  if (!serial || typeof serial !== "number") return null;
  const d = excelDateToMonday(serial);
  return d ? d.toISOString().split("T")[0] : null;
}

async function findOrCreateJobPlan(planTitle: string, ws: any, XLSX: any): Promise<any | null> {
  const existingPlans = await db("job_plans").where("title", planTitle).select("*");
  if (existingPlans.length > 0) return existingPlans[0];

  const contractStartDate = excelSerialToDateStr(ws[XLSX.utils.encode_cell({ r: 1, c: 2 })]?.v);
  const forecastDate = excelSerialToDateStr(ws[XLSX.utils.encode_cell({ r: 0, c: 2 })]?.v);

  const [newPlan] = await db("job_plans").insert({
    title: planTitle,
    contract_start_date: contractStartDate,
    forecast_date: forecastDate,
  }).returning("*");
  console.log(`[SharePoint] Job Plans: auto-created job plan "${planTitle}"`);
  return newPlan;
}

function buildLineData(name: string, data: PersonData, planTitle: string, sortOrder: number) {
  const weeklyAllocationsJson = JSON.stringify(data.weeklyAllocs);
  const totalBudgetHours = Object.values(data.weeklyAllocs).reduce((s, pct) => s + (pct / 100) * STANDARD_WEEKLY_HOURS, 0);
  return {
    lineData: {
      resource: name,
      milestone: planTitle,
      charge_out_level: data.rates.chargeOutRate ? `$${data.rates.chargeOutRate}/hr` : null,
      panel_hourly_rate: data.rates.chargeOutRate,
      discount_percent: data.rates.discountPercent ? data.rates.discountPercent * 100 : 0,
      hourly_gross_cost: data.rates.hourlyGrossCost,
      budget_hours: Number.parseFloat(totalBudgetHours.toFixed(1)),
      forecast_hours: Number.parseFloat(totalBudgetHours.toFixed(1)),
      weekly_allocations: weeklyAllocationsJson,
      sort_order: sortOrder,
    },
    weeklyAllocationsJson,
  };
}

function hasLineChanged(existingLine: any, lineData: any, weeklyAllocationsJson: string): boolean {
  return (
    existingLine.weekly_allocations !== weeklyAllocationsJson ||
    Math.abs((existingLine.budget_hours || 0) - lineData.budget_hours) > 0.05 ||
    (existingLine.panel_hourly_rate || 0) !== (lineData.panel_hourly_rate || 0) ||
    (existingLine.hourly_gross_cost || 0) !== (lineData.hourly_gross_cost || 0)
  );
}

async function parseAndProcessJobPlanFile(
  buffer: Buffer,
  fileName: string,
): Promise<{ inserted: number; updated: number; unchanged: number; processed: boolean; error?: string }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const emptyResult = { inserted: 0, updated: 0, unchanged: 0, processed: false };

  const codeMatch = extractProjectCode(fileName.replace(/\.(xlsx|xls)$/i, ""));
  const projectCode = codeMatch || fileName.replace(/\.(xlsx|xls)$/i, "").toUpperCase();
  const planTitle = fileName.replace(/\.(xlsx|xls)$/i, "").replace(/[-_]?\s*Plan\b.*$/i, "").trim() || projectCode;

  const planSheetName = selectBestSheet(wb, XLSX);
  const ws = wb.Sheets[planSheetName];
  if (!ws?.["!ref"]) {
    return { ...emptyResult, error: `${fileName}: empty sheet` };
  }
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const format = detectSheetFormat(ws, XLSX);

  const personMapResult = extractPersonMapFromSheet(ws, range, format, XLSX);
  if ("error" in personMapResult) {
    return { ...emptyResult, error: `${fileName}: ${personMapResult.error}` };
  }
  const personMap = personMapResult;

  if (personMap.size === 0) {
    return { inserted: 0, updated: 0, unchanged: 0, processed: true };
  }

  const jobPlan = await findOrCreateJobPlan(planTitle, ws, XLSX);
  if (!jobPlan) {
    return { ...emptyResult, error: `${fileName}: failed to create/find job plan` };
  }

  const existingLines = await db("job_plan_lines").where("job_plan_id", jobPlan.id).select("*");
  const existingByResource = new Map<string, any>();
  for (const line of existingLines) {
    if (line.resource) {
      existingByResource.set(line.resource.toLowerCase(), line);
    }
  }

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let sortOrder = 0;

  for (const [name, data] of personMap) {
    sortOrder++;
    const { lineData, weeklyAllocationsJson } = buildLineData(name, data, planTitle, sortOrder);
    const existingLine = existingByResource.get(name.toLowerCase());

    if (existingLine) {
      if (hasLineChanged(existingLine, lineData, weeklyAllocationsJson)) {
        await db("job_plan_lines").where("id", existingLine.id).update(lineData);
        updated++;
      } else {
        unchanged++;
      }
    } else {
      await db("job_plan_lines").insert({ job_plan_id: jobPlan.id, ...lineData });
      inserted++;
    }
  }

  console.log(`[SharePoint] Job Plans: ${projectCode} sheet="${planSheetName}" fmt=${format} ${personMap.size} people, ${inserted} new, ${updated} upd, ${unchanged} unchg`);
  return { inserted, updated, unchanged, processed: true };
}

export async function syncSharePointJobPlans(): Promise<{
  imported: number;
  updated: number;
  removed: number;
  unchanged: number;
  errors: string[];
  message: string;
}> {
  const token = await getGraphToken();
  const domain = process.env.SHAREPOINT_DOMAIN;
  if (!domain) throw new Error("Missing SHAREPOINT_DOMAIN env var");

  const jpSitePath = process.env.SHAREPOINT_JP_SITE_PATH || "/sites/RGDelivery";
  const siteId = await lookupSharePointSite(token, domain, jpSitePath);

  const folderPath = process.env.SHAREPOINT_JP_FOLDER_PATH || "General/00.Mgmt/Job Plans/01.Active plans";
  const files = await fetchDriveFolderFiles(token, siteId, folderPath);
  console.log(`[SharePoint] Job Plans: Found ${files.length} Excel files in ${folderPath}`);

  const errors: string[] = [];
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalUnchanged = 0;
  let filesProcessed = 0;

  for (const file of files) {
    try {
      const buffer = await downloadExcelFile(file.downloadUrl, token);
      const result = await parseAndProcessJobPlanFile(buffer, file.name);
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      totalUnchanged += result.unchanged;
      if (result.processed) filesProcessed++;
      if (result.error) errors.push(result.error);
    } catch (err: any) {
      errors.push(`"${file.name}": ${err.message}`);
    }
  }

  const parts = [];
  if (totalInserted > 0) parts.push(`${totalInserted} lines added`);
  if (totalUpdated > 0) parts.push(`${totalUpdated} updated`);
  if (totalUnchanged > 0) parts.push(`${totalUnchanged} unchanged`);
  parts.push(`${filesProcessed} files processed`);
  if (errors.length > 0) parts.push(`${errors.length} errors`);

  console.log(`[SharePoint] Job Plans sync complete: ${parts.join(", ")}`);
  if (errors.length > 0) {
    console.log(`[SharePoint] Job Plans first 5 errors: ${errors.slice(0, 5).join(" | ")}`);
  }

  return {
    imported: totalInserted,
    updated: totalUpdated,
    removed: 0,
    unchanged: totalUnchanged,
    errors,
    message: `Job Plans sync: ${parts.join(", ")}.`,
  };
}
