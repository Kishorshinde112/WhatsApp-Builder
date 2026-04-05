# WhatsApp Campaign Builder

A production-ready WhatsApp campaign operations dashboard with three core modules: **Campaigns**, **Contacts**, and **Tracking**.

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript + TailwindCSS v4 + shadcn/ui
- **Backend**: Node.js 24 + Express 5 + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **API**: OpenAPI 3.1 spec with generated React Query hooks

## Quick Start (Development)

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# Push database schema
pnpm --filter @workspace/db run push

# Seed database (optional)
pnpm --filter @workspace/scripts run seed

# Start development servers
pnpm --filter @workspace/api-server run dev   # API on :8080
pnpm --filter @workspace/dashboard run dev    # Dashboard on :3000
```

## Deployment Options

### Option 1: Docker Compose (Recommended)

```bash
# Build and start all services
docker-compose up -d

# Services:
# - PostgreSQL: localhost:5432
# - API: localhost:8080
# - Dashboard: localhost:3000
# - Nginx: localhost:80 (reverse proxy)
```

### Option 2: PM2 (Oracle VPS)

```bash
# Install PM2 globally
npm install -g pm2

# Build the project
pnpm run build

# Start with PM2
pm2 start ecosystem.config.cjs

# Save PM2 process list
pm2 save

# Set up PM2 startup script
pm2 startup
```

### Option 3: Manual

```bash
# Build
pnpm run build

# Start API
cd artifacts/api-server && node --enable-source-maps dist/index.mjs

# Start Dashboard (in another terminal)
cd artifacts/dashboard && pnpm serve
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `PORT` | API server port | 8080 |
| `BASE_PATH` | Dashboard base path | / |
| `GREEN_API_INSTANCE_ID` | Green API instance ID | - |
| `GREEN_API_TOKEN` | Green API token | - |
| `EVOLUTION_API_URL` | Evolution API base URL | - |
| `EVOLUTION_API_KEY` | Evolution API key | - |
| `EVOLUTION_API_INSTANCE` | Evolution API instance name | - |

## Project Structure

```
├── artifacts/
│   ├── api-server/      # Express backend
│   └── dashboard/       # React frontend
├── lib/
│   ├── api-client-react/  # Generated React Query hooks
│   ├── api-spec/          # OpenAPI specification
│   ├── api-zod/           # Generated Zod schemas
│   └── db/                # Drizzle ORM schemas
├── scripts/               # Database seeding
├── docker-compose.yml     # Docker deployment
├── ecosystem.config.cjs   # PM2 configuration
├── Dockerfile             # Multi-stage build
└── nginx.conf             # Reverse proxy config
```

## WhatsApp Provider Integration

The app supports pluggable WhatsApp providers:

- **Mock Provider**: Built-in simulator for testing (default)
- **Green API**: Stub ready for implementation
- **Evolution API**: Stub ready for implementation

To implement a real provider, update the corresponding file in:
`artifacts/api-server/src/services/provider/`

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/healthz` | Health check |
| `GET /api/dashboard` | Dashboard stats |
| `GET /api/contacts` | List contacts |
| `POST /api/contacts/import` | CSV import |
| `GET /api/campaigns` | List campaigns |
| `POST /api/campaigns/:id/launch` | Launch campaign |
| `GET /api/tracking/messages` | Message tracking |
| `POST /api/tracking/messages/bulk-retry` | Bulk retry failed |
| `GET /api/tracking/export` | Export CSV |

## License

MIT
