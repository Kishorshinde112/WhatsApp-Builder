# WhatsApp Campaign Builder - Deployment Verification & Checklist

## 1. Run/Build Verification

### Install Command
```bash
pnpm install
```
> Uses pnpm workspaces. Will install all dependencies for all packages.

### Development Commands
```bash
# Terminal 1: API Server (builds then runs)
pnpm --filter @workspace/api-server run dev

# Terminal 2: Dashboard
pnpm --filter @workspace/dashboard run dev
```
> API runs on :8080, Dashboard on :3000

### Production Build Command
```bash
pnpm run build
```
> Runs typecheck then builds all packages (api-server/dist, dashboard/dist)

### Database Commands
```bash
# Push schema to database (creates/updates tables)
pnpm --filter @workspace/db run push

# Force push (drops and recreates - USE WITH CAUTION)
pnpm --filter @workspace/db run push-force

# Seed database with test data
pnpm --filter @workspace/scripts run seed
```

### Local Testing Sequence
```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment
cp .env.example .env
# Edit .env: set DATABASE_URL to your PostgreSQL instance

# 3. Push database schema
pnpm --filter @workspace/db run push

# 4. (Optional) Seed test data
pnpm --filter @workspace/scripts run seed

# 5. Build everything
pnpm run build

# 6. Start API
cd artifacts/api-server && node --enable-source-maps dist/index.mjs

# 7. (New terminal) Start Dashboard
cd artifacts/dashboard && pnpm serve
```

---

## 2. Deployment Verification

### PM2 Ecosystem Config ✅
| Field | Value | Verified |
|-------|-------|----------|
| API cwd | `./artifacts/api-server` | ✅ Correct |
| API script | `dist/index.mjs` | ✅ Correct |
| API port | 8080 | ✅ Correct |
| Dashboard cwd | `./artifacts/dashboard` | ✅ Correct |
| Dashboard script | `../../node_modules/.bin/vite` | ✅ Fixed (uses root node_modules) |
| Dashboard args | `preview --port 3000 --host 0.0.0.0` | ✅ Correct |

### Dockerfile Paths ✅
| Stage | Path | Verified |
|-------|------|----------|
| deps | Copies all package.json + tsconfig.json | ✅ Correct |
| builder | Full COPY + pnpm run build | ✅ Correct |
| api | `artifacts/api-server/dist/index.mjs` | ✅ Correct |
| dashboard | `artifacts/dashboard` with `pnpm serve` | ✅ Correct |

### Docker Compose Services ✅
| Service | Port | Target | Verified |
|---------|------|--------|----------|
| postgres | 5432 | - | ✅ PostgreSQL 16 |
| api | 8080 | api | ✅ Correct target |
| dashboard | 3000 | dashboard | ✅ Correct target |
| nginx | 80 | - | ✅ Reverse proxy |

### Nginx Config ✅
| Route | Upstream | Verified |
|-------|----------|----------|
| `/api/*` | `api:8080` | ✅ Correct |
| `/api/webhooks/*` | `api:8080` | ✅ Correct (larger body limit) |
| `/` | `dashboard:3000` | ✅ Correct |
| `/health` | Direct 200 | ✅ Correct |

### Required Environment Variables
| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | **YES** | - | PostgreSQL connection string |
| `PORT` | No | 8080 | API server port |
| `BASE_PATH` | No | `/` | Dashboard base path |
| `GREEN_API_INSTANCE_ID` | No | - | For Green API |
| `GREEN_API_TOKEN` | No | - | For Green API |
| `EVOLUTION_API_URL` | No | - | For Evolution API |
| `EVOLUTION_API_KEY` | No | - | For Evolution API |
| `EVOLUTION_API_INSTANCE` | No | - | For Evolution API |

### Health Check Endpoint ✅
```bash
curl http://localhost:8080/api/healthz
# Returns: {"status":"ok"}
```

---

## 3. Provider Readiness

### Provider Interface Contract
```typescript
interface ProviderInterface {
  name: string;
  
  // Send a WhatsApp message
  sendMessage(options: {
    contactId: number;
    phone: string;      // E.164 format: +5511999999999
    message: string;
    campaignId: number;
  }): Promise<{
    externalMessageId: string;  // Provider's message ID
    responsePayload: Record<string, unknown>;
  }>;
  
  // Check message status (polling fallback)
  getStatus(externalMessageId: string): Promise<StatusUpdateEvent>;
  
  // Handle incoming webhook from provider
  handleWebhook(payload: Record<string, unknown>): Promise<StatusUpdateEvent | null>;
}

interface StatusUpdateEvent {
  externalMessageId: string;
  status: "sent" | "delivered" | "read" | "failed" | "noAccount";
  errorMessage?: string;
  timestamp: Date;
}
```

### Green API Webhook Payload Mapping
```typescript
// Incoming webhook from Green API:
{
  "typeWebhook": "outgoingMessageStatus",
  "instanceData": { "idInstance": 123, "wid": "..." },
  "timestamp": 1234567890,
  "idMessage": "ABC123",           // → externalMessageId
  "status": "sent"                 // → status mapping below
}

// Status mapping:
// Green API → Internal
// "sent"      → "sent"
// "delivered" → "delivered"  
// "read"      → "read"
// "noAccount" → "noAccount"
// "failed"    → "failed"
```

### Evolution API Webhook Payload Mapping
```typescript
// Incoming webhook from Evolution API:
{
  "event": "messages.update",
  "instance": "my-instance",
  "data": {
    "key": { "id": "ABC123" },     // → externalMessageId
    "status": "DELIVERY_ACK"       // → status mapping below
  }
}

// Status mapping:
// Evolution API  → Internal
// "PENDING"      → "sent"
// "SERVER_ACK"   → "sent"
// "DELIVERY_ACK" → "delivered"
// "READ"         → "read"
// "PLAYED"       → "read"
// "ERROR"        → "failed"
```

### Mock Provider Fallback ✅
- Mock provider is always available as `provider: "mock"`
- Simulates: sent → delivered → read with ~10% failure rate
- Uses in-process callbacks (no real webhooks)
- Safe for testing without real WhatsApp credentials

---

## 4. Final QA List

### Known Issues
1. **No real provider implementations** - Green API and Evolution API are stubs only
2. **No scheduled campaigns** - Only immediate launch supported
3. **No real WhatsApp validation** - Phone validation is regex-only, not actual WhatsApp check
4. **Audit logs unused** - Schema exists but not populated

### Still Mocked
| Component | Mock Behavior |
|-----------|---------------|
| WhatsApp sending | `MockProvider` simulates delivery lifecycle |
| Webhook delivery | In-process callback, not HTTP |
| Provider test | Returns success for mock, config check for others |

### Manual Configuration Required
1. **PostgreSQL database** - Must be provisioned separately
2. **Domain/SSL** - Nginx config has no SSL, needs certbot or Cloudflare
3. **Provider credentials** - GREEN_API_* or EVOLUTION_API_* env vars if using real providers
4. **Webhook URL** - Must configure provider dashboard to point to `https://yourdomain/api/webhooks/{provider}`

---

## 5. Oracle VPS Deployment Checklist

### Option A: PM2 Deployment (Ubuntu 22.04+)

```bash
# === SERVER SETUP ===

# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install pnpm
corepack enable
corepack prepare pnpm@latest --activate

# 4. Install PM2
npm install -g pm2

# 5. Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# 6. Create database
sudo -u postgres psql << EOF
CREATE USER whatsapp WITH PASSWORD 'your_secure_password';
CREATE DATABASE whatsapp_campaigns OWNER whatsapp;
GRANT ALL PRIVILEGES ON DATABASE whatsapp_campaigns TO whatsapp;
EOF

# 7. Install Nginx
sudo apt install -y nginx
sudo systemctl enable nginx

# === APP DEPLOYMENT ===

# 8. Clone repository
cd /opt
sudo git clone https://github.com/Kishorshinde112/WhatsApp-Builder.git whatsapp-builder
cd whatsapp-builder
sudo chown -R $USER:$USER .

# 9. Set up environment
cp .env.example .env
nano .env
# Set: DATABASE_URL=postgresql://whatsapp:your_secure_password@localhost:5432/whatsapp_campaigns

# 10. Install dependencies
pnpm install

# 11. Push database schema
pnpm --filter @workspace/db run push

# 12. Build application
pnpm run build

# 13. Start with PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup

# === NGINX SETUP ===

# 14. Configure Nginx for wa.kishorlab.dev
sudo nano /etc/nginx/sites-available/whatsapp

# Paste this config:
server {
    listen 80;
    server_name wa.kishorlab.dev;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 15. Enable site
sudo ln -s /etc/nginx/sites-available/whatsapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 16. Set up SSL with Certbot
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d wa.kishorlab.dev

# === VERIFY ===

# 17. Check services
pm2 status
curl http://localhost:8080/api/healthz
curl https://wa.kishorlab.dev/api/healthz
```

### Option B: Docker Compose Deployment

```bash
# === SERVER SETUP ===

# 1. Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Log out and back in

# 2. Install Docker Compose
sudo apt install -y docker-compose-plugin

# === APP DEPLOYMENT ===

# 3. Clone repository
cd /opt
sudo git clone https://github.com/Kishorshinde112/WhatsApp-Builder.git whatsapp-builder
cd whatsapp-builder
sudo chown -R $USER:$USER .

# 4. Set up environment
cp .env.example .env
nano .env
# Set your POSTGRES_PASSWORD and any provider credentials

# 5. Build and start
docker compose up -d --build

# 6. Push database schema (after containers are up)
docker compose exec api pnpm --filter @workspace/db run push

# 7. (Optional) Seed data
docker compose exec api pnpm --filter @workspace/scripts run seed

# === NGINX/SSL (Host-level) ===

# 8. Update nginx.conf for your domain
# Edit the nginx.conf to add SSL or use Cloudflare

# Or use Certbot on the host:
sudo apt install -y certbot
# Stop nginx container temporarily
docker compose stop nginx
sudo certbot certonly --standalone -d wa.kishorlab.dev
# Mount certs in docker-compose.yml and update nginx.conf
docker compose up -d

# === VERIFY ===

docker compose ps
curl http://localhost/api/healthz
```

### Update After Git Pull

```bash
cd /opt/whatsapp-builder

# PM2 method:
git pull
pnpm install
pnpm run build
pnpm --filter @workspace/db run push  # If schema changed
pm2 restart all

# Docker method:
git pull
docker compose down
docker compose up -d --build
docker compose exec api pnpm --filter @workspace/db run push  # If schema changed
```

### DNS Configuration
Point `wa.kishorlab.dev` A record to your Oracle VPS public IP address.

### Firewall Rules (Oracle Cloud)
Ensure these ports are open in your VCN security list:
- 22 (SSH)
- 80 (HTTP)
- 443 (HTTPS)

---

## Summary

| Item | Status |
|------|--------|
| Install command | `pnpm install` ✅ |
| Build command | `pnpm run build` ✅ |
| DB push | `pnpm --filter @workspace/db run push` ✅ |
| Seed | `pnpm --filter @workspace/scripts run seed` ✅ |
| PM2 config | ✅ Fixed |
| Dockerfile | ✅ Fixed |
| docker-compose | ✅ Verified |
| nginx.conf | ✅ Verified |
| Health endpoint | `/api/healthz` ✅ |
| Provider interface | Documented ✅ |
| Mock provider | Working ✅ |
| Green API stub | Ready for implementation |
| Evolution API stub | Ready for implementation |

**Ready for Oracle VPS deployment.**
