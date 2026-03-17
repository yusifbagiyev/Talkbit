# ChatApp

A **Slack/Bitrix24-style internal communication platform** built with .NET 8 and React. Designed as a modular monolith, it delivers real-time messaging, file sharing, and team collaboration features — all self-hosted and production-ready.

> Built to replace third-party SaaS tools and eliminate recurring subscription costs.

---

## ✨ Features

- 💬 **Real-time messaging** — Direct messages and channel-based group conversations via SignalR WebSockets
- 📢 **Channels** — Public/private channels for team communication
- 📁 **File sharing** — Upload and share files within conversations
- 🔍 **Search** — Full-text search across messages and channels
- 🔔 **Notifications** — Real-time in-app notifications
- ⚙️ **User settings** — Profile management and preferences
- 🔐 **Authentication** — JWT with HttpOnly cookies and refresh token rotation
- 🟢 **User presence** — Online/offline/away status tracking via Redis
- 🐳 **Fully containerized** — One command Docker Compose deployment

---

## 🏗️ Architecture

ChatApp uses a **Modular Monolith** architecture — each feature is a fully isolated module with its own Domain, Application, Infrastructure, and API layers, all running within a single deployable unit.

```
ChatApp/
├── ChatApp.Api                          # Main entry point — registers all modules
├── ChatApp.Shared.Kernel                # Shared abstractions (events, interfaces, base types)
├── ChatApp.Shared.Infrastructure        # Shared infrastructure (DB context, middleware)
│
├── ChatApp.Modules.Identity.*           # Auth, users, JWT, refresh tokens
├── ChatApp.Modules.DirectMessages.*     # 1-to-1 real-time messaging
├── ChatApp.Modules.Channels.*           # Group channels and channel messaging
├── ChatApp.Modules.Files.*              # File upload and retrieval
├── ChatApp.Modules.Notifications.*      # Real-time notification delivery
├── ChatApp.Modules.Search.*             # Full-text message/channel search
├── ChatApp.Modules.Settings.*           # User preferences and profile settings
│
├── chatapp-frontend/                    # React frontend
├── nginx/                               # Reverse proxy config
├── monitoring/                          # Observability setup
└── docker-compose.yml
```

Each module follows **Clean Architecture**:
```
Module/
├── Domain          → Entities, value objects, domain events
├── Application     → Use cases, CQRS commands/queries, interfaces
├── Infrastructure  → EF Core, repositories, external integrations
└── Api             → Controllers, SignalR hubs, module registration
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | .NET 8, ASP.NET Core, C# |
| **Architecture** | Modular Monolith, Clean Architecture, CQRS |
| **Real-time** | SignalR (WebSockets) |
| **Database** | PostgreSQL + Entity Framework Core |
| **Caching / Presence** | Redis (Pub/Sub, distributed cache) |
| **Frontend** | React, JavaScript |
| **Auth** | JWT, HttpOnly Cookies, Refresh Token Rotation |
| **Containerization** | Docker, Docker Compose |
| **Reverse Proxy** | Nginx (SSL termination) |
| **CI/CD** | GitHub Actions |

---

## 🚀 Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- .NET 8 SDK (for local development without Docker)

### Run with Docker Compose

**1. Clone the repository**
```bash
git clone https://github.com/yusifbagiyev/ChatApp.git
cd ChatApp
```

**2. Create your environment file**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Database
POSTGRES_USER=chatapp_user
POSTGRES_PASSWORD=your_strong_password
POSTGRES_DB=chatapp_db

# JWT
JWT_SECRET=your-secret-key-minimum-32-characters
JWT_ISSUER=https://yourdomain.com
JWT_AUDIENCE=https://yourdomain.com

# Redis
REDIS_CONNECTION=redis:6379

# Environment
ASPNETCORE_ENVIRONMENT=Production
```

**3. Start all services**
```bash
docker compose up -d
```

**4. Apply database migrations**
```bash
docker compose exec chatapp-api dotnet ef database update
```

**5. Open the app**
```
http://localhost:80
```

---

### Run Locally (without Docker)

```bash
# Start infrastructure only
docker compose up -d postgres redis

# Run backend
cd ChatApp.Api
dotnet run

# Run frontend
cd chatapp-frontend
npm install
npm run dev
```

Default local ports:
| Service | Port |
|---------|------|
| API | `http://localhost:5000` |
| Frontend | `http://localhost:5173` |
| PostgreSQL | `5432` |
| Redis | `6379` |

---

## 📡 API Overview

All API endpoints are served through `ChatApp.Api` which acts as the single entry point.

| Module | Base Path | Description |
|--------|-----------|-------------|
| Identity | `/api/auth` | Register, login, token refresh, logout |
| Direct Messages | `/api/direct-messages` | Send/receive 1-to-1 messages |
| Channels | `/api/channels` | Create/join channels, send messages |
| Files | `/api/files` | Upload and download files |
| Notifications | `/api/notifications` | Fetch notification history |
| Search | `/api/search` | Search messages and channels |
| Settings | `/api/settings` | User profile and preferences |

### SignalR Hubs

| Hub | Path | Description |
|-----|------|-------------|
| Chat Hub | `/hubs/chat` | Real-time message delivery |
| Notification Hub | `/hubs/notifications` | Real-time notification push |
| Presence Hub | `/hubs/presence` | User online/offline status |

> Swagger UI is available at `http://localhost:5000/swagger` in Development mode.

---

## 🔒 Security Highlights

- JWT tokens stored in **HttpOnly cookies** (no localStorage exposure)
- **Refresh token rotation** — old tokens invalidated on each refresh
- File upload validation — type and size restrictions enforced server-side
- Input sanitization on all message content
- HTTPS enforced via Nginx in production

---

## 📦 CI/CD

GitHub Actions workflow handles:
- Build and test on every push
- Docker image build
- Automated deployment to VPS on merge to `master`

See `.github/workflows/` for pipeline configuration.
