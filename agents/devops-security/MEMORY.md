# DevOps & Security Admin Memory

> This file is private to the devops-security agent. Updated after incidents and infrastructure changes.

## Current Infrastructure State

- VPS: AlmaLinux, yusif@alma-machine
- Domain: ittech.az → Cloudflare (proxy enabled)
- SSL: Let's Encrypt, auto-renew
- Docker Compose: 11 service (postgres, redis, backend, frontend, nginx, prometheus, grafana, loki, promtail, cadvisor, node-exporter)
- GitHub Actions: self-hosted runner on VPS

## Known Issues

- Redis password-da xüsusi simvollar (`/`, `;`, `=`) Docker Compose-da problem yaradır → sadə alfanumerik password istifadə et
- Frontend `env.js` Dockerfile-da override olunmalıdır (Vite build-time env runtime-da işləmir)
- Nginx frontend upstream port: 80 (nginx:alpine container), 3000 deyil
- Cloudflare CDN köhnə JS fayllarını cache-ləyir → deploy-dan sonra Purge Everything lazımdır
- SignalR nginx path: `/hubs/` (əvvəl `/hub/` idi — düzəldildi)

## Incidents

- 2026-04-01: Production login "Failed to fetch" — Redis NOAUTH (password uyğunsuzluğu) + frontend env.js localhost:7000 qaytarırdı + nginx SignalR path yanlış idi + CORS yalnız localhost-a icazə verirdi

## Patterns

- Deploy sonrası mütləq Cloudflare cache purge et
- Redis password dəyişəndə volume silmək lazımdır (`docker volume rm`)
- `.env` faylında xüsusi simvol istifadə etmə (Docker Compose variable expansion pozur)

## Last Updated
- 2026-04-01
