# Skill: SSL & Network Security

## Purpose

SSL/TLS sertifikat idarəetməsi, network təhlükəsizliyi, firewall, DDoS protection.

## Scope

- SSL certificate management (Let's Encrypt)
- TLS configuration hardening
- Firewall rules (UFW/firewalld)
- Cloudflare security settings
- Network isolation (Docker networks)
- Rate limiting

## Process

### 1. SSL/TLS Management
```bash
# Certificate status
certbot certificates

# Manual renew
certbot renew

# Auto-renew cron (hər 12 saatda)
0 0,12 * * * certbot renew --quiet && docker compose restart nginx

# Test SSL grade
# https://www.ssllabs.com/ssltest/analyze.html?d=ittech.az
```

### 2. TLS Hardening (nginx)
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
```

### 3. Firewall Rules
```bash
# AlmaLinux (firewalld)
firewall-cmd --list-all
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-port=22/tcp    # SSH (dəyişdirilmiş port)
firewall-cmd --reload

# Yalnız lazımi portlar açıq: 22 (SSH), 80 (HTTP→HTTPS redirect), 443 (HTTPS)
# Docker, PostgreSQL, Redis portları EXTERNAL-ə açıq olmamalıdır
```

### 4. Cloudflare Security
- **SSL Mode**: Full (Strict) — server-də valid cert var
- **Always Use HTTPS**: ON
- **Minimum TLS Version**: 1.2
- **HSTS**: ON (max-age: 6 months)
- **WAF**: Managed rules enabled
- **Bot Management**: Challenge suspicious bots
- **Rate Limiting**: 100 req/10sec per IP on `/api/auth/*`
- **Under Attack Mode**: Manual trigger for DDoS

### 5. Rate Limiting (nginx)
```nginx
# Login brute force protection
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/s;

location /api/auth/login {
    limit_req zone=login burst=10 nodelay;
    proxy_pass http://backend;
}

# General API rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

location /api/ {
    limit_req zone=api burst=50 nodelay;
    proxy_pass http://backend;
}
```

### 6. Docker Network Isolation
```yaml
# docker-compose.yml — service-lər yalnız lazımi portlarla danışır
# External: yalnız nginx (80, 443)
# Internal: backend, frontend, postgres, redis — external port yoxdur
```

## Quality Bar

- SSL Labs test: A+ grade
- Yalnız 80, 443, SSH portu açıq (external)
- Rate limiting aktiv olmalıdır
- Cloudflare WAF aktiv olmalıdır
- Certificate auto-renew test olunmalıdır
