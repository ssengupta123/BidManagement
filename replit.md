# Bid Management - Reason Group

## Overview
A comprehensive bid management system for Reason Group that manages the full bid lifecycle from opportunity identification through qualification, response writing, executive review, and final submission. Includes interactive Job Plans for resource allocation and costing.

## Architecture
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, Shadcn UI components
- **Backend**: Express.js REST API with Knex.js query builder
- **AI**: OpenAI (via Replit AI Integrations) for CARE assessments, response generation, delivery plans, and resource plans
- **Database**: Azure SQL (MSSQL) for production, PostgreSQL for development. Configurable via `DB_TYPE` env var

## Key Features
1. **Opportunities Management** - CRUD for panel opportunities (based on SharePoint data model)
2. **Bid Workflow** - CAS qualification → CSD qualification → Bid Manager assignment → Technical writing → Executive review → Approval
3. **CARE Assessment** - AI-powered evaluation (Competitive Position, Attractiveness, Relationship Strength, Ease of Response)
4. **Response Generation** - AI-generated technical responses, delivery plans, and resource plans
5. **PDF Export** - Download responses in Reason Group template format
6. **Job Plans** - Interactive resource allocation and costing plans with milestones, rate cards, weekly allocation, auto-calculated financials (budget, forecast, margin, variance)
7. **Resource Allocation** - Cross-plan resource heatmap with overallocation detection, expandable breakdown per plan, configurable time horizon (13–78 weeks)
8. **REST API** - GET/POST endpoints for automation hooks

## Data Model
- `users` - Team members (CAS leads, CSD leads, bid managers, writers, executives)
- `opportunities` - Panel opportunities with fields matching SharePoint structure + qualification tracker fields (channel, priority, assignedTo, careDecision, dateIn, source) + `sharepoint_id` for delta sync
- `bids` - Bid records linked to opportunities with workflow stage tracking
- `workflow_logs` - Audit trail of all workflow actions
- `job_plans` - Resource allocation plans (optionally linked to bids)
- `job_plan_lines` - Individual resource lines with rates, hours, weekly allocations (stored as JSON)
- `data_sources` - SharePoint sync connection configs (name, type, syncTarget, status, lastSyncAt)

## File Structure
```
shared/schema.ts              - Data model definitions (Zod schemas + TypeScript types)
server/db.ts                  - Knex database connection (MSSQL or PostgreSQL)
server/migrate.ts             - Auto-migration: creates tables on startup
server/storage.ts             - CRUD operations interface (Knex queries)
server/routes.ts              - API routes (including AI endpoints)
server/sharepoint-sync.ts     - SharePoint sync via Microsoft Graph API (opportunities + job plans)
server/seed.ts                - Database seeding with sample data
client/src/App.tsx            - Main app with sidebar layout
client/src/pages/             - Dashboard, Opportunities, Bids, BidDetail, JobPlans, JobPlanDetail, ResourceAllocation, DataUpload
client/src/components/        - AppSidebar, ThemeProvider, ThemeToggle
```

## API Endpoints
- `GET/POST /api/opportunities` - Opportunity CRUD
- `GET/POST /api/bids` - Bid CRUD
- `POST /api/bids/:id/qualify-cas` - CAS qualification
- `POST /api/bids/:id/qualify-csd` - CSD qualification
- `POST /api/bids/:id/assign-writer` - Assign bid manager & writer
- `POST /api/bids/:id/care-assessment` - Run CARE assessment
- `POST /api/bids/:id/generate-response` - Generate technical response
- `POST /api/bids/:id/generate-delivery-plan` - Generate delivery plan
- `POST /api/bids/:id/generate-resource-plan` - Generate resource plan
- `POST /api/bids/:id/generate-final` - Compile final response
- `POST /api/bids/:id/submit-for-review` - Submit for executive review
- `POST /api/bids/:id/executive-decision` - Executive approve/reject
- `GET /api/bids/:id/logs` - Workflow history
- `GET /api/bids/:id/download-pdf` - Download bid response as HTML (print to PDF)
- `POST /api/bids/upload` - Bulk upload bids from CSV/Excel (array of bid objects)
- `POST /api/opportunities/upload` - Bulk upload opportunities from CSV/Excel
- `POST /api/job-plans/upload` - Bulk upload job plans from CSV/Excel (with optional nested lines)
- `GET/POST /api/job-plans` - Job plan CRUD
- `GET /api/job-plans/:id/lines` - Get resource lines
- `POST /api/job-plans/:id/lines` - Add resource line
- `PATCH /api/job-plan-lines/:id` - Update resource line
- `DELETE /api/job-plan-lines/:id` - Delete resource line
- `GET /api/data-sources` - List SharePoint sync sources
- `POST /api/data-sources` - Create data source
- `POST /api/data-sources/seed` - Initialize default SharePoint sources (opportunities + job plans)
- `POST /api/data-sources/:id/sync` - Trigger SharePoint sync for a data source

## SharePoint Sync
Ported from Finance-Hub (ssengupta123/FinanceHub) and adapted for this project's data model.

### Opportunity Tracker Sync (`syncSharePointOpenOpps`)
- Reads items from SharePoint List "Issue tracker  TEST MV" on reasongroup.sharepoint.com/sites/RGSales
- Uses Graph API List Items endpoint (not drive/folder — this is a SharePoint List, not a doc library)
- Maps SharePoint fields to `opportunities` table (name, phase, value, margin, VAT, leads, etc.)
- Delta sync using `sharepoint_id`: inserts new, updates changed, archives/deletes removed items
- Soft-delete for opportunities with linked bids (archives instead of hard-deleting)
- Phase mapping: A→1.A, Q→2.Q, DF→3.DF, DVF→4.DVF, S→5.S
- VAT canonicalization: normalizes various VAT spellings to canonical form

### Job Plans Sync (`syncSharePointJobPlans`)
- Reads Excel (.xlsx) files from SharePoint folder (default: `/sites/RGDelivery/General/00.Mgmt/Job Plans/01.Active plans`)
- Auto-detects sheet format (standard vs SAU046)
- Selects best "Time Plan" sheet, extracts resource names, rates, and weekly allocations
- Creates/updates `job_plans` + `job_plan_lines` records
- Weekly allocations stored as JSON (week-start-date → percentage)

### Required Env Vars
- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` - Azure AD app registration (client credentials flow)
- Defaults hardcoded: SHAREPOINT_DOMAIN=reasongroup.sharepoint.com, SHAREPOINT_SITE_PATH=/sites/RGSales, SHAREPOINT_LIST_NAME="Issue tracker  TEST MV"
- Optional overrides: `SHAREPOINT_DOMAIN`, `SHAREPOINT_SITE_PATH`, `SHAREPOINT_LIST_NAME`, `SHAREPOINT_FOLDER_PATH`
- Job Plans overrides: `SHAREPOINT_JP_SITE_PATH` (default: /sites/RGDelivery), `SHAREPOINT_JP_FOLDER_PATH` (default: General/00.Mgmt/Job Plans/01.Active plans)

## Stage Guards
All workflow transition endpoints validate that the bid is in the correct stage before allowing the action:
- qualify-cas: requires stage = cas_qualification
- qualify-csd: requires stage = csd_qualification, qualified (boolean) required
- assign-writer: requires stage = bid_manager_review, writerId and bidManagerId required
- submit-for-review: requires stage = writing
- executive-decision: requires stage = executive_review, approved (boolean) required

## Job Plan Features
- Milestone-grouped resource lines with expand/collapse
- Inline editing of resource details (name, level, role, rates, hours)
- Auto-calculated: effective rate, daily rate, budget $, forecast $, gross margin, variance
- Weekly allocation view with click-to-cycle and holiday-aware max allocation (national + state holidays; VIC default)
- State/territory selector for holiday calculation (VIC, NSW, QLD, etc.)
- Color-coded allocation cells with gradient styling: emerald gradients (80-100%), sky gradients (20-50%), amber-to-red gradient (over limit)
- Public holiday weeks marked with asterisk and capped allocation
- Summary cards showing forecast revenue, gross margin, forecast hours, budget variance
- Charge out levels: Partner, Principal, Director, Senior Manager, Manager, Senior Consultant, Consultant

## Azure Deployment
- Dockerfile and GitHub Actions workflows included for Azure App Service deployment
- Two deployment options: ZIP deploy or Docker container deploy
- See `AZURE_DEPLOYMENT.md` for full setup instructions
- Required Azure env vars: `DB_TYPE=mssql`, `MSSQL_SERVER`, `MSSQL_DATABASE`, `MSSQL_USER`, `MSSQL_PASSWORD`, `SESSION_SECRET`, `OPENAI_API_KEY`
- App builds to `dist/` with `npm run build` (Vite frontend + esbuild server bundle)
- Tables are auto-created on first startup via `server/migrate.ts`

## Font & Readability
- Base font scales responsively: 16px default, 17px at 1920px+, 18px at 2560px+ (CSS media queries in index.css)
- All pages use minimum 11px for smallest text (allocation cells), 12-13px for labels/badges, text-sm (14px) for body text
- Muted foreground set to 38% lightness (stronger contrast than default 47%)
- Sidebar nav items: 15px with h-12 buttons, 20px icons
- Allocation grid cells: w-12 h-8 in job plans, w-[40px] h-7 in resource allocation heatmap
- All control heights increased to prevent text clipping (h-7 minimum for buttons, h-8 for inputs)

## Dependencies
- OpenAI (Replit AI Integrations on Replit / OPENAI_API_KEY on Azure)
- Knex.js for database queries (supports MSSQL + PostgreSQL)
- tedious for Azure SQL (MSSQL) connectivity
- pg for PostgreSQL connectivity (development)
- Shadcn UI components
