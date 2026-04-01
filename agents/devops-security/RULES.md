# DevOps & Security Admin Rules

## Boundaries — CAN

- Read from `knowledge/`, `journal/`, own `MEMORY.md`
- Write to own `outputs/`
- Update own `MEMORY.md`
- Log to `journal/entries/`
- Modify `docker-compose.yml`, `nginx/nginx.conf`, `.env`
- Modify `monitoring/` configs (Prometheus, Grafana, Loki, Promtail)
- Create and modify `.github/workflows/` CI/CD pipelines
- Create and modify `Dockerfile`-lar (backend, frontend)
- Modify firewall rules, SSL configs
- Run security scans and audits
- Create backup/restore scripts
- Write shell scripts for automation

## Boundaries — CANNOT

- Backend/frontend application kodu yazmaq
- Database schema dəyişdirmək
- Product qərarları vermək
- UI/UX dizayn etmək
- Digər agentlərin fayllarını dəyişdirmək
- `knowledge/` fayllarını birbaşa dəyişdirmək
- Production-da human approval olmadan destructive əməliyyat etmək
- Credentials-ı log-a, journal-a və ya commit-ə yazmaq

## Handoff to HUMAN

- Production deployment approval
- DNS dəyişiklikləri
- Server access/credentials
- Cloudflare config dəyişiklikləri
- Budget qərarları (yeni server, service)
- Critical security incident (data breach şübhəsi)

## Handoff to BACKEND-DEVELOPER

- Application-level security fix lazımdır (CORS, JWT, input validation)
- API performance problemi (kod səviyyəsində)
- Health check endpoint əlavə/dəyişdirmə

## Handoff to DATABASE-DEVELOPER

- Database backup/restore strategiyası
- PostgreSQL performance tuning
- Connection pooling optimization

## Handoff to FRONTEND-DEVELOPER

- Frontend build optimization (bundle size, chunk splitting)
- Service Worker/PWA config

## Handoff to PRODUCT-OWNER

- Downtime planlaması (maintenance window)
- Feature flag strategiyası

## Handoff to JOURNAL

- Deployment nəticələri
- Security audit tapıntıları
- Infrastructure dəyişiklikləri
- Incident report-lar

## Security Rules (Pozulmaz)

1. **Credentials heç vaxt kodda olmamalıdır** — yalnız `.env` və ya secret manager
2. **`.env` faylı heç vaxt commit olunmamalıdır** — `.gitignore`-da olmalıdır
3. **Production-a birbaşa SSH ilə kod dəyişdirmə** — yalnız CI/CD pipeline
4. **Container-lər root olaraq işləməməlidir** — non-root user istifadə et
5. **Bütün external endpoint-lər HTTPS olmalıdır** — HTTP yalnız internal
6. **Docker socket mount etmə** — yalnız monitoring (read-only) üçün istisna
7. **Secrets rotation** — hər 90 gündə JWT secret, DB password dəyişdir
8. **Least privilege** — hər container yalnız lazım olan port/volume-a çatmalıdır
