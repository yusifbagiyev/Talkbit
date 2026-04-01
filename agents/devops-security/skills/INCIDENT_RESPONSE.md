# Skill: Incident Response

## Purpose

Production incident-ləri sürətlə detect etmək, triaj etmək, həll etmək və təkrarlanmasının qarşısını almaq.

## Scope

- Incident detection və classification
- Root cause analysis
- Mitigation və recovery
- Post-mortem və prevention

## Process

### 1. Incident Classification

| Severity | Təsvir | Response Time | Nümunə |
|----------|--------|---------------|--------|
| **P0 Critical** | Service tamamilə işləmir, bütün istifadəçilər təsirli | <15 dəq | Database down, SSL expired, server unreachable |
| **P1 Major** | Əsas funksionallıq işləmir, çox istifadəçi təsirli | <30 dəq | Login failed, mesaj göndərilmir, file upload broken |
| **P2 Minor** | Bəzi funksiyalar işləmir, az istifadəçi təsirli | <4 saat | Bir endpoint 500 qaytarır, avatar yüklənmir |
| **P3 Low** | Kosmetik, performance degradation | Növbəti iş günü | Yavaş response, log xətaları |

### 2. Incident Response Steps

```
1. DETECT → Monitoring alert / user report / log anomaly
2. TRIAGE → Severity müəyyən et (P0-P3)
3. COMMUNICATE → Journal entry yaz, stakeholder-ları xəbərdar et
4. INVESTIGATE → Loglar, metrics, recent changes yoxla
5. MITIGATE → Quick fix (restart, rollback, config change)
6. RESOLVE → Root cause fix
7. VERIFY → Health check, smoke test
8. POST-MORTEM → Incident report yaz, prevention plan
```

### 3. Common Incident Playbooks

**Service Down:**
```bash
docker compose ps -a                    # Hansı service down?
docker compose logs --tail 100 SERVICE  # Niyə?
docker compose restart SERVICE          # Restart
docker compose logs -f SERVICE          # Gözlə, health check
```

**Database Connection Error:**
```bash
docker compose logs --tail 50 postgres  # PG logları
docker exec talkbit_postgres pg_isready # PG health
docker compose restart backend          # Backend restart
```

**Redis Auth Error:**
```bash
docker exec talkbit_redis redis-cli -a 'PASSWORD' ping  # Test
docker compose down redis
docker volume rm talkbit_redis_data     # Volume sil (data itkisi!)
docker compose up -d redis              # Yeni password ilə yarat
docker compose restart backend          # Backend reconnect
```

**SSL Certificate Expired:**
```bash
certbot renew                           # Renew
docker compose restart nginx            # Nginx reload
```

**Disk Full:**
```bash
df -h                                   # Hansı partition?
docker system prune -f                  # Docker cleanup
journalctl --vacuum-size=100M           # System log cleanup
```

### 4. Post-Mortem Template

```markdown
# Incident Report — YYYY-MM-DD

## Summary
- **Severity**: P0/P1/P2/P3
- **Duration**: Start → End (total minutes)
- **Impact**: Neçə istifadəçi, hansı funksiyalar

## Timeline
- HH:MM — Incident detected
- HH:MM — Investigation started
- HH:MM — Root cause identified
- HH:MM — Mitigation applied
- HH:MM — Service restored

## Root Cause
Nə baş verdi və niyə.

## Fix Applied
Nə edildi.

## Prevention
Bu incident-in təkrarlanmaması üçün nə edilməlidir.
```

## Quality Bar

- P0/P1 incident-lər üçün post-mortem mütləqdir
- Hər incident journal-a log olunmalıdır
- Prevention plan implement olunmalıdır (yalnız sənəd deyil)
- Playbook-lar test olunmalıdır (dry-run)
