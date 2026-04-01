# DevOps & Security Admin Memory

> This file is private to the devops-security agent. Updated after incidents and infrastructure changes.

## Current Infrastructure State

- VPS: AlmaLinux 10.1, yusif@alma-machine (Hetzner), 8GB RAM, 75GB disk, no swap, SSH port 4624
- Domain: ittech.az → Cloudflare (proxy enabled)
- SSL: Let's Encrypt, auto-renew
- Docker Compose: 11 services (postgres, redis, backend, frontend, nginx, prometheus, grafana, loki, promtail, cadvisor, node-exporter)
- GitHub Actions: self-hosted runner on VPS (runner v2.333.1, systemd service, yusif user)

## Server Structure

```
/home/yusif/talkbit/
├── actions-runner/                        # GitHub Actions self-hosted runner
│   ├── runsvc.sh                          # Systemd service script
│   ├── config.sh                          # Runner configuration
│   ├── hetzner-machine/                   # Runner work directory (named after runner)
│   │   └── Talkbit/
│   │       └── Talkbit/                   # Checkout directory — docker compose runs FROM HERE
│   │           ├── .env                   # Copied by workflow from talkbit/.env
│   │           ├── docker-compose.yml
│   │           ├── nginx/
│   │           ├── monitoring/
│   │           └── ...
│   └── _diag/                             # Runner diagnostic logs
│
└── talkbit/                               # Git repo (master branch, manual pull)
    ├── .env                               # Production env file — primary source
    ├── docker-compose.yml
    ├── ChatApp.Api/
    ├── chatapp-frontend/
    ├── nginx/nginx.conf
    ├── monitoring/
    ├── .github/workflows/deploy.yml
    └── ...

/etc/letsencrypt/live/ittech.az/           # SSL certificates (Let's Encrypt)
├── fullchain.pem
└── privkey.pem
```

### Key Paths
- **Active docker-compose**: `/home/yusif/talkbit/actions-runner/hetzner-machine/Talkbit/Talkbit/docker-compose.yml`
- **`.env` source**: `/home/yusif/talkbit/talkbit/.env` (workflow copies this on every deploy)
- **Runner service**: `actions.runner.yusifbagiyev-Talkbit.hetzner-machine` (systemd, enabled)
- **SSL certs**: `/etc/letsencrypt/live/ittech.az/`

## Known Issues

- Redis password with special characters (`/`, `;`, `=`) breaks Docker Compose variable expansion → use simple alphanumeric passwords
- Frontend `env.js` must be overridden in Dockerfile (Vite build-time env doesn't work at runtime)
- Nginx frontend upstream port: 80 (nginx:alpine container), not 3000
- Cloudflare CDN caches old JS files → must "Purge Everything" after deploy
- SignalR nginx path: `/hubs/` (was `/hub/` before — fixed)

## Incidents

- 2026-04-01: Production login "Failed to fetch" — Redis NOAUTH (password mismatch) + frontend env.js returning localhost:7000 + wrong nginx SignalR path + CORS only allowing localhost

## Patterns

- Always purge Cloudflare cache after deploy
- When Redis password changes, delete Docker volume (`docker volume rm`) to clear stale data
- Never use special characters in `.env` passwords (Docker Compose variable expansion breaks)

## Last Updated
- 2026-04-01
