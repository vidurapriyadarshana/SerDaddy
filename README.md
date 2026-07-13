# SerDaddy 🚀

**SerDaddy** is a modern, lightweight, self-hosted Platform-as-a-Service (PaaS) that turns clean Ubuntu/Debian VPS servers into high-performance web deployment targets using Nginx, Git, and a compiled background daemon.

Designed with a high-performance **NestJS (powered by Fastify)** Hub, an interactive **Next.js** Frontend, and a resource-efficient **Go (Golang)** target agent.

---

## 🏛️ Monorepo Structure

We configure the workspace utilizing **pnpm workspaces**:
*   **[`panel/`](file:///d:/SerDaddy/panel)**: The user-facing dashboard built in Next.js.
*   **[`hub-api/`](file:///d:/SerDaddy/hub-api)**: NestJS backend hub utilizing Fastify, Prisma, Socket.io, and BullMQ queues.
*   **[`agent/`](file:///d:/SerDaddy/agent)**: Target server background agent compiled in Go.
*   **[`docs/`](file:///d:/SerDaddy/docs)**: Architectural designs, endpoints mapping, and flow diagrams.

---

## 📊 Development Phases Status

| Phase | Description | Key Modules | Status |
| :--- | :--- | :--- | :---: |
| **Phase 1** | Hub Setup & OAuth | Next.js layout, NestJS Fastify setup, PostgreSQL push | **Completed** ✅ |
| **Phase 2** | Go Agent & WebSockets | Telemetry metrics streaming, agent authentication | *Up Next* 🚀 |
| **Phase 3** | Deployments Pipeline | Webhooks validation, BullMQ processes, Nginx mapping | *Pending* ⏳ |
| **Phase 4** | Rollbacks & Hardening | Symlink release swaps, xterm log viewer, SSL configs | *Pending* ⏳ |

---

## ⚡ Core Features Checklist

- [x] **Prerequisites**: Monorepo workspace mapping (`pnpm-workspace.yaml`).
- [ ] **GitHub integration**: OAuth login redirects and public/private repo query routes.
- [ ] **Server registration**: API tokens generation and registration handshakes.
- [ ] **Go WebSocket Client**: Persistent connection to Hub with auto-reconnect logic.
- [ ] **Auto Framework Detection**: Detect Node, Python, static HTML, etc.
- [ ] **Pre-deployment checks**: Validating port binds and server free memory capacity.
- [ ] **Dependency Provisioning**: Apt script triggers to install required packages.
- [ ] **Env Variable Management**: AES-256 encrypted configuration writes.
- [ ] **Manual Deployments**: Queue-based build runners using BullMQ.
- [ ] **Webhook Autodeploy**: Push-triggered signatures verification hooks.
- [ ] **Log streaming**: Real-time stdout/stderr console streaming.
- [ ] **Symlinks Rollbacks**: Swapping domain folder links instantly.
- [ ] **Telemetry Metrics**: Low-overhead CPU, memory, and disk telemetry parsing.

---

## 📖 Documentation Reference

For low-level designs and flowcharts, check:
*   📜 **[docs/implementation_plan.md](file:///d:/SerDaddy/docs/implementation_plan.md)**: Architectural phase outlines, local setup steps, and security guidelines.
*   📊 **[docs/project_flow_structure.md](file:///d:/SerDaddy/docs/project_flow_structure.md)**: Sequential Mermaid flow diagrams for provisioning, deploying, and telemetry metrics.
*   🌐 **[docs/tech_stack_endpoints.md](file:///d:/SerDaddy/docs/tech_stack_endpoints.md)**: Detailed Rest API endpoints, payload configurations, and WebSocket gateway events specs.

---

## 🛠️ Quick Local Setup

1.  **Workspace Package Installs**:
    Run pnpm in the root directory:
    ```bash
    pnpm install
    ```

2.  **Configure environment**:
    Create **`hub-api/.env`** and configure your local PostgreSQL database URL connection:
    ```env
    DATABASE_URL="postgres://postgres:PASSWORD@localhost:5432/serdaddy"
    ```

3.  **Create local Database tables**:
    ```bash
    cd hub-api
    bun x prisma db push
    ```

4.  **Start Services**:
    *   **Hub Backend API** (Runs on `http://localhost:4000` via Bun):
        ```bash
        cd hub-api
        bun run start:dev
        ```
    *   **Control Panel Dashboard** (Runs on `http://localhost:3000` via pnpm):
        ```bash
        cd panel
        pnpm dev
        ```