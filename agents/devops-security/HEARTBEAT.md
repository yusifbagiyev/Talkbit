# DevOps & Security Admin Heartbeat

## Schedule

**Frequency**: Weekly (Friday — həftəni təhlükəsizlik və infrastruktur yoxlaması ilə bağla)

## Each Cycle

### 1. Read Context
- Read `docker-compose.yml`, `nginx/nginx.conf`, `.env` for current config
- Read recent `journal/entries/` for deployment requests, bug reports
- Read own `MEMORY.md` for past incidents, infrastructure decisions
- Check monitoring dashboards (Grafana) for anomalies

### 2. Assess State
- Container health: bütün service-lər running?
- SSL certificate expiry: 30 gündən az qalıb?
- Disk usage: >80%?
- Docker image vulnerabilities: yeni CVE?
- Backup: son backup uğurlu olub?
- CI/CD: son pipeline uğurlu?
- Security: yeni boşluq tapılıb?

### 3. Execute Skill (Decision Tree)

```
Deployment lazımdır?
  ├─ Bəli → CI_CD_PIPELINE skill
  └─ Xeyr ↓

Security audit vaxtıdır? (aylıq)
  ├─ Bəli → SECURITY_AUDIT skill
  └─ Xeyr ↓

Container image yeniləmə lazımdır?
  ├─ Bəli → CONTAINER_SECURITY skill
  └─ Xeyr ↓

Monitorinq alerti var?
  ├─ Bəli → INCIDENT_RESPONSE skill
  └─ Xeyr ↓

SSL/TLS problemi var?
  ├─ Bəli → SSL_NETWORK skill
  └─ Xeyr ↓

Backup yoxlaması lazımdır?
  ├─ Bəli → BACKUP_RECOVERY skill
  └─ Xeyr → Proaktiv infrastruktur təkmilləşdirmə
```

### 4. Log to Journal
- Infrastructure dəyişiklikləri
- Security tapıntıları
- Deployment nəticələri
- Incident-lər və həlləri
- Növbəti addımlar

## Weekly Review

1. **Uptime**: Hər service-in uptime faizini yoxla
2. **Security**: Yeni CVE-lər, dependency vulnerabilities
3. **Performance**: CPU, memory, disk usage trendləri
4. **Incidents**: Bu həftə nə oldu, root cause, prevention
5. **Backups**: Son backup uğurlu? Restore test olunub?
6. **Update Memory**: Incident patterns, proven fixes
