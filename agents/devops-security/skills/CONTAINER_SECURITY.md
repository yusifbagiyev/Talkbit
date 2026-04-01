# Skill: Container Security

## Purpose

Docker container-ların təhlükəsizliyini təmin etmək — minimal image, vulnerability scan, runtime security.

## Scope

- Base image seçimi və hardening
- Dockerfile best practices
- Container runtime security
- Image vulnerability scanning
- Secret management in containers

## Process

### 1. Dockerfile Hardening Checklist
- [ ] Multi-stage build (build dependencies production-a düşməsin)
- [ ] Minimal base image (`alpine`, `distroless`)
- [ ] Non-root user: `RUN adduser -D appuser && USER appuser`
- [ ] No unnecessary packages (`--no-cache`, `--no-install-recommends`)
- [ ] COPY specific files (not `COPY . .` — use `.dockerignore`)
- [ ] Fixed version tags (`:15-alpine` not `:latest`)
- [ ] HEALTHCHECK instruction
- [ ] No secrets in image (use env vars at runtime)

### 2. Docker Compose Security
- [ ] Read-only root filesystem: `read_only: true` (mümkün olduqda)
- [ ] Resource limits: `deploy.resources.limits` (CPU, memory)
- [ ] No `privileged: true` (yalnız cAdvisor istisna)
- [ ] Internal network: external port yalnız nginx-ə
- [ ] Volume mount: minimum lazımi path, `:ro` mümkün olduqda
- [ ] No Docker socket mount (yalnız monitoring, read-only)

### 3. Image Vulnerability Scanning
- `docker scout cves image:tag` — CVE scan
- `trivy image image:tag` — comprehensive vulnerability scan
- CI/CD pipeline-da avtomatik scan
- Critical/High vulnerability → build fail

### 4. Runtime Security
- Container restart policy: `unless-stopped`
- Log driver: json-file with max-size/max-file rotation
- Network isolation: service-lər yalnız lazımi digər service-lərlə danışır
- Health checks: hər service üçün HEALTHCHECK

### 5. Secret Management
- `.env` faylı: `chmod 600`, `.gitignore`-da
- Docker secrets (Swarm mode) və ya external secret manager (gələcək)
- Rotation: hər 90 gündə password/key dəyişdir
- Audit: kim, nə vaxt, hansı secret-ə daxil olub

## Quality Bar

- Heç bir container root olaraq işləməməlidir (monitoring istisna)
- Heç bir Critical CVE production image-da olmamalıdır
- Bütün secrets `.env`-dən gəlməlidir, heç biri hardcode deyil
- Bütün service-lərin health check-i olmalıdır
