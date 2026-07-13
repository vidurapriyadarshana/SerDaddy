# Implementation Plan: SerDaddy - Self-Hosted PaaS (NestJS + Fastify Hub)

This document details the step-by-step implementation plan for building **SerDaddy**, a self-hosted PaaS platform featuring GitHub OAuth integration, Nginx automation, custom environment management, real-time log streaming, and server monitoring using a **Next.js Frontend**, a **NestJS (powered by Fastify) Backend Hub**, and a lightweight **Go-based Agent**.

The development is divided into **4 distinct implementation phases** to ensure structured execution and early validation of features.

---

## Monorepo Layout Structure

We structure the project under the workspace root `d:\SerDaddy`:

```bash
SerDaddy/
├── panel/                  # Next.js Frontend Dashboard (UI Only)
├── hub-api/                # NestJS Backend API Server (Fastify + Prisma + BullMQ + Socket.io)
└── agent/                  # Go Agent Daemon (Target VPS)
```

---

## Feature Coverage Mapping

All 13 requested features are mapped directly to specific database models and codebase components:

| # | Requested Feature | Implementation Component | Technical Execution |
|---|---|---|---|
| **1** | GitHub login & repo access | **Hub-API** (`auth/`) / **Panel** | NestJS GitHub OAuth module, `@octokit/rest` client |
| **2** | Add & manage servers | **Hub-API** (`servers/`) / **DB** | Server registry routes, server status, `Server` table |
| **3** | Install/connect deployment agent | **Bootstrap script** / **Agent** | Outbound WebSocket connection (TLS) using server `agentToken` |
| **4** | Link repository to server | **Hub-API** (`projects/`) / **DB** | Project mapping routing, port allocation, `Project` table |
| **5** | Automatic framework detection | **Agent Daemon** (`executor.go`) | File checks (`package.json`, `requirements.txt`) in code root |
| **6** | Pre-deployment validation | **Agent Daemon** (`executor.go`) | Port availability, disk capacity, and Nginx health checks |
| **7** | Auto install dependencies | **Agent Daemon** (`executor.go`) | Automatic execution of installer scripts (Node, Python, Nginx) |
| **8** | Env variable management | **Hub-API** (`projects/`) / **DB** | DB encryption of keys, write to secure local `.env` during builds |
| **9** | One-click manual deployments | **Hub-API** (`deployments/`) | Frontend trigger action enqueued via NestJS `@nestjs/bull` |
| **10**| Webhook-based auto deploys | **Hub-API** (`deployments/`) | Fastify Webhook signature controller pushing to `BullMQ` |
| **11**| Deployment logs and history | **Hub-API** / **Agent** | Streaming output via WebSockets (`socket/`), stored in DB |
| **12**| Rollback to previous build | **Agent Daemon** (`nginx.go`) | Symlink switching (pointing Nginx root to older successful builds) |
| **13**| Basic system monitoring | **Agent Daemon** (`monitor.go`) | Periodical OS polling (`gopsutil`), pushed every 10s to NestJS Socket |

---

## User Review Required

> [!IMPORTANT]
> **Splitting UI and API**: We now separate the user dashboard (`panel/` via Next.js) from the control services API (`hub-api/` via NestJS + Fastify).
> *   The Next.js panel serves purely static dashboard pages, communicating with the NestJS API over standard HTTP/WebSocket requests.
> *   NestJS acts as the single source of truth, managing WebSocket links with both Go Agents and Next.js frontends.

---

## Open Questions

> [!NOTE]
> 1. Do you prefer hosting the database (PostgreSQL) inside the same server hosting the NestJS API, or do you want to configure an external database URI?
> 2. For the agent binary, should we pre-compile binaries for popular architectures (amd64, arm64) during development, or compile them dynamically? (We recommend pre-compiling on github actions or during panel build for faster installation).

---

## Proposed Changes (Phased Roadmap)

---

### 🚀 Phase 1: Workspace & NextJS + NestJS Core Setup
Set up the base workspace folders, compile database schemas with Prisma, and boot the Next.js login pages and the NestJS (Fastify) core framework.

#### [NEW] [hub-api/package.json](file:///d:/SerDaddy/hub-api/package.json)
*   Initialize dependencies: `@nestjs/core`, `@nestjs/platform-fastify`, `@nestjs/websockets`, `@nestjs/platform-socket.io`, `@nestjs/bull`, `@prisma/client`, `class-validator`, `bcrypt`.

#### [NEW] [hub-api/src/main.ts](file:///d:/SerDaddy/hub-api/src/main.ts)
*   NestJS bootstrap file configured to use the `FastifyAdapter` instead of Express:
    ```typescript
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter()
    );
    ```

#### [NEW] [hub-api/prisma/schema.prisma](file:///d:/SerDaddy/hub-api/prisma/schema.prisma)
*   Prisma schemas for `User`, `Server`, `Project`, `Deployment`, and `EnvironmentVariable`.

#### [NEW] [panel/package.json](file:///d:/SerDaddy/panel/package.json)
*   Initialize static Next.js frontend with Tailwind CSS, TypeScript, and Lucide icon components.

#### [NEW] [panel/app/page.tsx](file:///d:/SerDaddy/panel/app/page.tsx) & [panel/app/dashboard/page.tsx](file:///d:/SerDaddy/panel/app/dashboard/page.tsx)
*   Dashboard pages listing active server counts, connection state checkers, and registration panels.

---

### 🔌 Phase 2: Go Agent & NestJS WebSocket Handshake
Construct the Go-based agent and implement the NestJS Gateway utilizing Fastify socket pipelines for secure persistent metrics transmissions.

#### [NEW] [hub-api/src/socket/agent.gateway.ts](file:///d:/SerDaddy/hub-api/src/socket/agent.gateway.ts)
*   NestJS WebSocket Gateway. Authenticates connecting Agents using `X-Agent-Token` headers and routes metrics pushes.

#### [NEW] [agent/main.go](file:///d:/SerDaddy/agent/main.go)
*   Go Agent entry point. Connects to WSS gateway at `wss://hub-api/` and handles socket reconnect loops.
*   Supports `--mock` flag to bypass actual Linux systems operations on Windows/macOS.

#### [NEW] [agent/monitor/telemetry.go](file:///d:/SerDaddy/agent/monitor/telemetry.go)
*   Uses `gopsutil` to compile CPU, memory, and disk numbers. Streams them back every 10 seconds.

#### [NEW] [panel/app/dashboard/servers/[id]/page.tsx](file:///d:/SerDaddy/panel/app/dashboard/servers/[id]/page.tsx)
*   Responsive monitoring charts (CPU/RAM dials) subscribing to live WebSocket channels.

---

### 📦 Phase 3: Deployment Pipelines & Webhook Processing
Configure NestJS BullMQ queue tasks, compile the Go code executors, and create webhook handlers using Fastify validators.

#### [NEW] [hub-api/src/deployments/deployments.processor.ts](file:///d:/SerDaddy/hub-api/src/deployments/deployments.processor.ts)
*   BullMQ Queue Processor. Takes deployment tasks, registers logs in DB, and emits `deploy:start` socket signals to target Agents.

#### [NEW] [agent/runner/executor.go](file:///d:/SerDaddy/agent/runner/executor.go)
*   Go build runner. Clones repositories, checks for framework indicators (`package.json`, etc.), installs requirements, and streams stdout console logs byte-by-byte.

#### [NEW] [agent/runner/nginx.go](file:///d:/SerDaddy/agent/runner/nginx.go)
*   Generates Nginx vhost files, formats symlinks, and executes reload services.

#### [NEW] [hub-api/src/deployments/webhooks.controller.ts](file:///d:/SerDaddy/hub-api/src/deployments/webhooks.controller.ts)
*   Fastify request controller that validates GitHub HMAC webhook header signatures and puts deployment jobs in BullMQ.

---

### 🔄 Phase 4: Rollbacks & Production Tuning
Enable version deployment logs history tracking, directory-based symlink hot-swapping, and UI dashboard xterm log consoles.

#### [MODIFY] [agent/runner/nginx.go](file:///d:/SerDaddy/agent/runner/nginx.go)
*   Incorporate rollback hooks. Changes domain symlinks instantly back to older target repository directory tags on command.

#### [NEW] [panel/components/log-viewer.tsx](file:///d:/SerDaddy/panel/components/log-viewer.tsx)
*   React terminal view module using `xterm.js` to view active streaming build logs.

---

## Verification Plan

### Automated Tests
- Build verification tests for NestJS: `npm run build` in `/hub-api`.
- Build verification tests for Next.js panel: `npm run build` in `/panel`.
- Compile test for Go Agent: `go build -o serdaddy-agent` in `/agent`.

### Manual Verification
1. Run NestJS api and Next.js panel locally.
2. Spin up a local VM or temporary VPS (Ubuntu).
3. Execute the installation script on the VPS and verify that it successfully registers back with the local panel.
4. Trigger a test deployment of a static HTML/React repo, check Nginx site mapping, and check if metrics stream live on the Next.js Dashboard.

---

## Security Specifications

To ensure the safety of both the Control Panel and the target servers, the following security practices are implemented:

### 1. Zero Inbound Ports (Firewall Hardening)
*   The Go Agent communicates with the Hub solely via **outbound WebSocket connections (WSS)**. 
*   Target servers can configure a firewall (`ufw`) to block all incoming traffic except ports `80` (HTTP) and `443` (HTTPS) for public web access. You **do not** need to open SSH (Port 22) or any custom database ports to the internet.

### 2. Secure Token Handshake & Authentication
*   Every server is registered in the Hub database with a unique, cryptographically random `agentToken`.
*   During connection initialization, the Agent sends this token as a custom header (`X-Agent-Token`). The Hub validates the token against the database. If verification fails, the WebSocket handshake is instantly terminated.

### 3. Database Secrets Encryption (Encryption at Rest)
*   Sensitive data, such as project environment variables (`.env` keys) and GitHub OAuth user access tokens, are encrypted in the PostgreSQL database using **AES-256-GCM**.
*   The decryption key is stored strictly as a server environment variable (`ENCRYPTION_KEY`) in the Next.js panel host, never checked into version control.

### 4. Least Privilege Daemon Execution
*   The Go Agent runs under a dedicated, low-privilege system user account (e.g., `serdaddy`), rather than root.
*   To enable the Agent to perform system-level Nginx reloads and systemd service restarts, we configure a scoped `/etc/sudoers.d/serdaddy` rule:
    ```bash
    serdaddy ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload nginx, /usr/bin/systemctl restart *
    ```
    This grants the Agent the power it needs without exposing full root access.

### 5. Secure GitHub Webhook Signatures
*   When receiving automatic git push triggers from GitHub, the Next.js API route validates the payload using an HMAC-SHA256 signature calculated with a shared `WEBHOOK_SECRET`. This prevents attackers from sending fake deployment signals.

---

## Local Development & Setup Guide

To run this project locally on your machine for development:

### Prerequisites
- **Bun** (v1.1 or later - used for NestJS fast execution)
- **pnpm** (v8.x or later - handles workspaces package linking)
- **Go** (v1.20 or later)
- **SQLite / PostgreSQL** (SQLite is used locally for convenience)

### 1. Monorepo Setup (All Frontend & Backend)
1. Run `pnpm install` in the root **`SerDaddy`** directory. Thanks to `pnpm-workspace.yaml`, this automatically configures node_modules for both `panel` and `hub-api` packages in a single run:
   ```bash
   pnpm install
   ```

### 2. Hub-API Setup (NestJS Backend via Bun)
1. Navigate to the api folder:
   ```bash
   cd hub-api
   ```
2. Setup local configurations in a `.env` file in the `hub-api/` directory:
   ```env
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="super-secret-key-change-in-production"
   ENCRYPTION_KEY="32-byte-hexadecimal-encryption-key"
   GITHUB_CLIENT_ID="your_github_client_id"
   GITHUB_CLIENT_SECRET="your_github_client_secret"
   ```
3. Push database schema to the local SQLite database file using Bun:
   ```bash
   bun x prisma db push
   ```
4. Start the backend with the **Bun** runtime engine:
   ```bash
   bun run start:dev
   ```
   The NestJS backend runs on `http://localhost:4000` (Fastify routing).

### 3. Panel Setup (Next.js Frontend via pnpm)
1. Navigate to the panel folder:
   ```bash
   cd ../panel
   ```
2. Set up the local `.env` pointing to the NestJS API:
   ```env
   NEXT_PUBLIC_API_URL="http://localhost:4000"
   ```
3. Start the Next.js dev server:
   ```bash
   pnpm dev
   ```
   The Dashboard runs on `http://localhost:3000`.

### 4. Agent Setup (Go Daemon)
1. Navigate to the agent folder:
   ```bash
   cd ../agent
   ```
2. Initialize Go package:
   ```bash
   go mod init serdaddy-agent
   go get github.com/gorilla/websocket
   go get github.com/shirou/gopsutil/v3
   ```
3. Run the agent client:
   ```bash
   go run main.go --panel http://localhost:4000 --token MOCK_SERVER_TOKEN --mock
   ```

