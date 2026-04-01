# Skill: Monitoring & Alerting

## Purpose

Prometheus + Grafana + Loki stack ilə real-time monitorinq, alerting, log aggregation.

## Scope

- Prometheus metric collection
- Grafana dashboard yaratma
- Loki log aggregation
- Alert rules
- Anomaly detection

## Process

### 1. Metric Collection (Prometheus)
- **Node Exporter**: CPU, memory, disk, network (host level)
- **cAdvisor**: container CPU, memory, network, disk I/O
- **Backend**: ASP.NET Core metrics (request duration, error rate, active connections)
- **PostgreSQL**: pg_exporter (connections, queries, locks)
- **Redis**: redis_exporter (memory, connections, commands)
- **Nginx**: nginx_exporter (requests, connections, status codes)

### 2. Grafana Dashboards
- **Overview**: bütün service-lərin statusu, uptime, error rate
- **API Performance**: request/sec, p50/p95/p99 latency, error rate by endpoint
- **Container Resources**: CPU, memory, network per container
- **Database**: active connections, query duration, cache hit ratio
- **SignalR**: active WebSocket connections, message throughput

### 3. Alert Rules (Prometheus Alertmanager)

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| ServiceDown | container not running for >1m | Critical | Restart, notify |
| HighCPU | CPU >90% for >5m | Warning | Scale, investigate |
| HighMemory | Memory >85% for >5m | Warning | Investigate, restart |
| DiskFull | Disk >85% | Warning | Cleanup, expand |
| HighErrorRate | 5xx >5% of requests for >2m | Critical | Investigate, rollback |
| SSLExpiry | Certificate expires in <14 days | Warning | Renew |
| DatabaseConnExhausted | Active connections >80% of max | Warning | Tune pool |
| RedisMemoryHigh | Memory >80% of maxmemory | Warning | Eviction policy |

### 4. Log Aggregation (Loki)
- Bütün container logları Promtail ilə Loki-yə göndərilir
- Grafana-da log exploration: service, level, keyword filter
- Error log pattern detection
- Structured logging format (Serilog JSON)

### 5. Incident Detection
- Grafana alert → notification channel (email, Telegram, Slack)
- Automatic incident creation
- Runbook links in alert description

## Quality Bar

- Bütün service-lər metric expose etməlidir
- Hər critical service üçün alert rule olmalıdır
- Dashboard-lar 30 saniyə refresh interval
- Log retention: 15 gün (Loki)
- Metric retention: 15 gün (Prometheus)
