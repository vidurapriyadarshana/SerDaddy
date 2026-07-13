# SerDaddy: Tech Stack & API Endpoints Specification

This document details the selected technologies, REST API endpoints, and WebSocket payload schemas for communication between the **SerDaddy Control Panel (Hub)** and the **SerDaddy Agent**.

---

## 🛠️ Complete Tech Stack Reference

### 1. Control Panel (Hub)
*   **Frontend & Routing**: Next.js 14+ (App Router) with TypeScript.
*   **Styling**: Tailwind CSS + shadcn/ui (Radix UI primitives).
*   **Database Client**: Prisma ORM.
*   **Real-time Handlers**: Socket.io (Node.js engine adapter).
*   **Task Scheduling**: BullMQ + Redis (Handles background deployments).
*   **GitHub Integration**: Octokit API client SDK.

### 2. Target Agent (Daemon)
*   **Language**: Go (Golang) 1.20+.
*   **WebSocket Engine**: `github.com/gorilla/websocket`.
*   **Telemetry library**: `github.com/shirou/gopsutil/v3` (reads Unix system stats).

---

## 🔄 API & WebSocket Sequence Flow

This diagram illustrates the sequence of REST API calls and WebSocket events during authentication, server registration, project linking, deployment execution, and monitoring telemetry loops.

```mermaid
sequenceDiagram
    autonumber
    actor Developer
    participant Browser
    participant Hub as Next.js Hub
    participant Agent as Go Agent
    participant GitHub

    %% Phase 1: Authentication & Server Registry
    Note over Developer, GitHub: Phase 1: Authentication & Server Registry
    Developer->>Browser: Click Login with GitHub
    Browser->>Hub: GET /api/auth/github
    Hub->>GitHub: Redirect to OAuth authorization
    GitHub-->>Browser: Callback redirect code
    Browser->>Hub: GET /api/auth/callback/github
    Hub-->>Browser: Session active

    %% Phase 2: Server Setup & Handshake
    Developer->>Browser: Register Server
    Browser->>Hub: POST /api/servers
    Hub-->>Browser: Returns agentToken & Install Command
    Note over Developer, Agent: User runs install command on VPS
    Agent->>Hub: WSS Handshake (wss://panel.serdaddy.com/api/agent/socket)
    Agent->>Hub: WebSocket Event: agent:auth { agentToken }
    Hub-->>Agent: Handshake confirmed (Server state = ONLINE)

    %% Phase 3: Project Configuration
    Developer->>Browser: Link repository to server
    Browser->>Hub: POST /api/projects { serverId, repoUrl, branch }
    Hub-->>Browser: Project configured (Assigned internal port)

    %% Phase 4: Deploy Pipeline Execution
    Note over Developer, Agent: Phase 4: Deploy Pipeline Execution
    alt Manual Trigger
        Developer->>Browser: Click "Deploy Now"
        Browser->>Hub: POST /api/projects/:id/deploy
        Hub-->>Browser: Deployment ID (Queued)
    else GitHub Webhook
        GitHub->>Hub: POST /api/webhooks/github (HMAC Signature validated)
        Hub-->>GitHub: 200 OK
    end
    
    Hub->>Agent: WebSocket Event: deploy:start { deploymentId, repoUrl, branch, env }
    loop Running build steps
        Agent->>Hub: WebSocket Event: deploy:log { deploymentId, stream, chunk }
        Hub->>Browser: Stream logs to Dashboard Console
    end
    Agent->>Hub: WebSocket Event: deploy:status { deploymentId, status: SUCCESS }
    Hub->>Browser: Update UI state (Deploy complete)

    %% Phase 5: Telemetry Metrics
    loop Telemetry Metrics
        Agent->>Hub: WebSocket Event: metrics:push { cpu, ram, disk }
        Hub->>Browser: Stream live dashboard charts
    end
```

---

## 🌐 HTTP REST API Endpoints (Hub Panel)

### 1. GitHub Integration

#### `GET /api/auth/github`
*   **Description**: Redirects user to GitHub OAuth login page.
*   **Scopes Requested**: `repo` (private repos access), `admin:repo_hook` (manage webhooks).

#### `GET /api/auth/callback/github`
*   **Description**: Handles OAuth redirection code callback from GitHub. Retrieves GitHub access token and creates/updates user profile.
*   **Response (JSON)**:
    ```json
    {
      "success": true,
      "user": {
        "id": "usr_456",
        "username": "developer_john",
        "avatarUrl": "https://github.com/developer_john.png"
      }
    }
    ```

---

### 2. Server Management

#### `GET /api/servers`
*   **Description**: Returns all servers registered by the logged-in user.
*   **Response (JSON)**:
    ```json
    [
      {
        "id": "srv_001",
        "name": "Production VPS 1",
        "ip": "192.168.1.50",
        "status": "ONLINE",
        "createdAt": "2026-07-13T12:00:00Z"
      }
    ]
    ```

#### `POST /api/servers`
*   **Description**: Registers a new server target, generating an installation token.
*   **Request Payload**:
    ```json
    {
      "name": "Staging VPS",
      "ip": "192.168.1.51"
    }
    ```
*   **Response (JSON)**:
    ```json
    {
      "id": "srv_002",
      "name": "Staging VPS",
      "agentToken": "sd_agt_4f9103c8b4ef8d1",
      "installCommand": "curl -sSL https://panel.serdaddy.com/api/agent/install | bash -s sd_agt_4f9103c8b4ef8d1"
    }
    ```

---

### 3. Project Configuration

#### `POST /api/projects`
*   **Description**: Creates a new project by linking a repository to a target server.
*   **Request Payload**:
    ```json
    {
      "serverId": "srv_001",
      "repoUrl": "github.com/developer_john/my-nextjs-app",
      "branch": "main",
      "subdomain": "app.domain.com"
    }
    ```
*   **Response (JSON)**:
    ```json
    {
      "id": "proj_999",
      "repoUrl": "github.com/developer_john/my-nextjs-app",
      "subdomain": "app.domain.com",
      "assignedPort": 3001,
      "status": "READY"
    }
    ```

---

### 4. Deployments

#### `POST /api/projects/:id/deploy`
*   **Description**: Triggers a manual deployment for the project.
*   **Response (JSON)**:
    ```json
    {
      "deploymentId": "dep_111",
      "status": "QUEUED",
      "createdAt": "2026-07-13T12:35:00Z"
    }
    ```

#### `GET /api/deployments/:id/logs`
*   **Description**: Retrieves historical deployment build logs.
*   **Response (JSON)**:
    ```json
    {
      "deploymentId": "dep_111",
      "logs": "[SerDaddy] Starting deployment...\n[1/6] Cloning repo...\n"
    }
    ```

---

### 5. Webhooks

#### `POST /api/webhooks/github`
*   **Description**: GitHub webhook receiver for automated pushes.
*   **Headers**: Requires `X-Hub-Signature-256` HMAC validation.
*   **Payload**: Raw GitHub payload from push events.
*   **Response (JSON)**:
    ```json
    {
      "success": true,
      "message": "Deployment queued for commit: a7b1c3d"
    }
    ```

---

## 🔌 WebSocket Events (Real-time Communication)

All Agent-Hub WebSocket calls require a secure connection. The Agent connects to `wss://panel.serdaddy.com/api/agent/socket`.

### 1. Connection Authentication (Agent $\rightarrow$ Hub)
On opening the WebSocket connection, the Agent must authenticate immediately.

*   **Event Name**: `agent:auth`
*   **Payload**:
    ```json
    {
      "agentToken": "sd_agt_4f9103c8b4ef8d1"
    }
    ```

---

### 2. Telemetry Metrics (Agent $\rightarrow$ Hub)
Pushed by the Agent to the Hub every 10 seconds.

*   **Event Name**: `metrics:push`
*   **Payload**:
    ```json
    {
      "cpuPercent": 14.5,
      "ramUsedBytes": 512000000,
      "ramTotalBytes": 1024000000,
      "diskUsedBytes": 12800000000,
      "diskTotalBytes": 25600000000,
      "uptimeSeconds": 172800,
      "networkRxSpeed": 102400,
      "networkTxSpeed": 45600
    }
    ```

---

### 3. Deployment Flow Events

#### Initiate Build (Hub $\rightarrow$ Agent)
The Hub instructs the Agent to deploy a project.

*   **Event Name**: `deploy:start`
*   **Payload**:
    ```json
    {
      "deploymentId": "dep_111",
      "repoUrl": "https://github.com/developer_john/my-nextjs-app.git",
      "branch": "main",
      "assignedPort": 3001,
      "env": {
        "PORT": "3001",
        "DATABASE_URL": "postgresql://user:pass@host:5432/db"
      }
    }
    ```

#### Real-time Log Stream (Agent $\rightarrow$ Hub)
The Agent pipes execution console outputs back to the Hub dashboard during build execution.

*   **Event Name**: `deploy:log`
*   **Payload**:
    ```json
    {
      "deploymentId": "dep_111",
      "stream": "stdout",
      "chunk": "npm run build output line here..."
    }
    ```

#### Deployment State Report (Agent $\rightarrow$ Hub)
Sent by the Agent upon success or failure of the deployment.

*   **Event Name**: `deploy:status`
*   **Payload**:
    ```json
    {
      "deploymentId": "dep_111",
      "status": "SUCCESS",
      "commitHash": "a7b1c3d90eef88b1234",
      "releasePath": "/var/www/my-nextjs-app/releases/a7b1c3d"
    }
    ```

---

### 4. Rollback Flow (Hub $\rightarrow$ Agent)
Instructs the agent to swap Nginx symlinks to an older, successful deployment directory.

*   **Event Name**: `deploy:rollback`
*   **Payload**:
    ```json
    {
      "projectName": "my-nextjs-app",
      "assignedPort": 3001,
      "targetReleasePath": "/var/www/my-nextjs-app/releases/previous_hash"
    }
    ```
