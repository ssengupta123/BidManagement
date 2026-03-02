# Bid Management — Azure Deployment Guide

## Architecture

The app uses **Knex.js** as its query builder, which supports both:
- **Azure SQL (MSSQL)** — for production on Azure (set `DB_TYPE=mssql`)
- **PostgreSQL** — for local/Replit development (default, uses `DATABASE_URL`)

Tables are created automatically on first startup via the built-in migration system.

## Prerequisites

- Azure account with an active subscription
- GitHub repository with this code pushed
- Azure CLI installed locally (optional, for initial setup)

## Azure Resources Required

### 1. Azure SQL Database

Create an Azure SQL server and database:

```bash
az group create \
  --name bid-management-rg \
  --location australiaeast

az sql server create \
  --resource-group bid-management-rg \
  --name bid-management-sql \
  --location australiaeast \
  --admin-user bidadmin \
  --admin-password '<YOUR_PASSWORD>'

az sql db create \
  --resource-group bid-management-rg \
  --server bid-management-sql \
  --name bidmanagement \
  --service-objective S0

az sql server firewall-rule create \
  --resource-group bid-management-rg \
  --server bid-management-sql \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### 2. Azure App Service

```bash
az appservice plan create \
  --resource-group bid-management-rg \
  --name bid-management-plan \
  --sku B1 \
  --is-linux

az webapp create \
  --resource-group bid-management-rg \
  --plan bid-management-plan \
  --name bid-management \
  --runtime "NODE:20-lts"
```

### 3. Configure Environment Variables

```bash
az webapp config appsettings set \
  --resource-group bid-management-rg \
  --name bid-management \
  --settings \
    DB_TYPE="mssql" \
    MSSQL_SERVER="bid-management-sql.database.windows.net" \
    MSSQL_DATABASE="bidmanagement" \
    MSSQL_USER="bidadmin" \
    MSSQL_PASSWORD="<YOUR_PASSWORD>" \
    SESSION_SECRET="<RANDOM_SECRET_STRING>" \
    OPENAI_API_KEY="<YOUR_OPENAI_API_KEY>" \
    NODE_ENV="production" \
    PORT="8080"
```

## Deployment Options

### Option A: ZIP Deploy via GitHub Actions (Recommended)

Uses `.github/workflows/deploy-azure.yml`.

**Setup steps:**

1. In Azure Portal → App Service → Deployment Center → Manage publish profile
2. Download the publish profile XML file
3. In GitHub repo → Settings → Secrets → Actions
4. Create secret `AZURE_WEBAPP_PUBLISH_PROFILE` with the XML content
5. Update `AZURE_WEBAPP_NAME` in the workflow file to match your App Service name
6. Push to `main` — deployment runs automatically

Tables are created automatically on first startup — no separate migration step needed.

### Option B: Docker Deploy via GitHub Actions

Uses `.github/workflows/deploy-azure-docker.yml`.

**Setup steps:**

1. Same publish profile setup as Option A
2. Docker image is built and pushed to GitHub Container Registry (ghcr.io)
3. Azure pulls the image on each deployment

**Azure Container configuration:**

```bash
az webapp config container set \
  --resource-group bid-management-rg \
  --name bid-management \
  --container-image-name ghcr.io/<YOUR_GITHUB_USERNAME>/bid-management:latest \
  --container-registry-url https://ghcr.io
```

## Post-Deployment

### Verify Deployment

1. Navigate to `https://bid-management.azurewebsites.net`
2. Check startup logs for "Migrations complete" message
3. Verify the dashboard loads correctly
4. Test data upload functionality

### Custom Domain (Optional)

```bash
az webapp config hostname add \
  --resource-group bid-management-rg \
  --webapp-name bid-management \
  --hostname bids.reasongroup.com.au

az webapp config ssl bind \
  --resource-group bid-management-rg \
  --name bid-management \
  --certificate-thumbprint <CERT_THUMBPRINT> \
  --ssl-type SNI
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_TYPE` | Yes (Azure) | Set to `mssql` for Azure SQL. Defaults to `pg` for PostgreSQL |
| `MSSQL_SERVER` | Yes (Azure) | Azure SQL server hostname (e.g., `myserver.database.windows.net`) |
| `MSSQL_DATABASE` | Yes (Azure) | Database name |
| `MSSQL_USER` | Yes (Azure) | Database admin username |
| `MSSQL_PASSWORD` | Yes (Azure) | Database admin password |
| `DATABASE_URL` | Dev only | PostgreSQL connection string (used when `DB_TYPE=pg` or unset) |
| `SESSION_SECRET` | Yes | Random string for session encryption |
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI features (CARE assessment, response generation) |
| `PORT` | No | Server port (defaults to 8080 in Docker, 5000 locally) |
| `NODE_ENV` | No | Set to `production` on Azure (auto-set in Docker) |

## Troubleshooting

**App won't start:**
- Check App Service logs: `az webapp log tail --resource-group bid-management-rg --name bid-management`
- Verify `PORT` is set to 8080
- Ensure all `MSSQL_*` variables are set correctly

**Database connection fails:**
- Verify the Azure SQL firewall allows Azure services (rule with 0.0.0.0)
- Check that `MSSQL_SERVER` includes `.database.windows.net`
- Ensure the username and password are correct
- Confirm `DB_TYPE=mssql` is set

**Tables not created:**
- Check logs for migration errors
- The app creates tables automatically on startup if they don't exist
- If tables exist with a different schema, they won't be recreated — drop and restart if needed

**Build fails in GitHub Actions:**
- Check that `npm ci` succeeds
- Verify Node.js version matches (20.x)

## Local Development

For local development, the app defaults to PostgreSQL:

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/bidmanagement" npm run dev
```

To test against Azure SQL locally:

```bash
DB_TYPE=mssql \
MSSQL_SERVER="your-server.database.windows.net" \
MSSQL_DATABASE="bidmanagement" \
MSSQL_USER="bidadmin" \
MSSQL_PASSWORD="yourpassword" \
npm run dev
```
