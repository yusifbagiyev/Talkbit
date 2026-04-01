# Skill: Infrastructure Management

## Purpose

Server, container, network və storage infrastrukturunu idarə etmək — uptime, performance, scalability.

## Scope

- Docker Compose service management
- Server resource monitoring və optimization
- Network configuration (nginx, DNS, Cloudflare)
- Storage management (volumes, disk space)
- Service scaling

## Process

### 1. Service Health Check
```bash
# Bütün container-ların statusu
docker compose ps -a

# Resurs istifadəsi
docker stats --no-stream

# Disk usage
df -h
docker system df

# Log yoxlama (son 50 sətir)
docker compose logs --tail 50 backend
docker compose logs --tail 50 nginx
```

### 2. Performance Optimization
- **Nginx**: gzip compression, static file caching, connection pooling
- **PostgreSQL**: shared_buffers, work_mem, connection limits
- **Redis**: maxmemory policy, persistence config
- **Docker**: resource limits (CPU, memory), restart policies
- **Cloudflare**: cache rules, minification, Brotli compression

### 3. Disk Space Management
```bash
# Docker cleanup
docker system prune -f          # Dangling images, stopped containers
docker volume prune -f           # Unused volumes (DİQQƏT: data itkisi!)
docker builder prune -f          # Build cache

# Log rotation
# /etc/docker/daemon.json:
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

### 4. Service Restart & Recovery
```bash
# Tək service restart
docker compose restart backend

# Rebuild + restart
docker compose up -d --build backend

# Full stack restart
docker compose down && docker compose up -d

# Nuclear option (data saxlanılır — volumes silinmir)
docker compose down
docker system prune -af
docker compose up -d --build
```

### 5. DNS & Cloudflare Management
- A record: ittech.az → VPS IP
- Cloudflare proxy: enabled (DDoS protection, CDN)
- SSL mode: Full (strict) — server-də Let's Encrypt cert var
- Cache: static assets cache, API bypass
- Page Rules: `/api/*` → cache bypass

## Quality Bar

- Bütün service-lər health check keçməlidir
- Disk usage <80% saxlanmalıdır
- Docker image-lar pruned olmalıdır (köhnə image-lar silinir)
- Log rotation konfigurasiya olunmalıdır
