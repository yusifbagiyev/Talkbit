# Skill: CI/CD Pipeline Management

## Purpose

GitHub Actions ilə avtomatlaşdırılmış build, test, deploy pipeline-larını yaratmaq və idarə etmək.

## Scope

- GitHub Actions workflow yaratmaq/dəyişdirmək
- Self-hosted runner quraşdırma və idarəetmə
- Multi-stage deployment (staging → production)
- Rollback strategiyası
- Build cache optimization

## Process

### 1. Pipeline Design
- Trigger: push to main, PR, manual dispatch
- Stages: lint → test → build → deploy
- Environment separation: staging vs production
- Secret management: GitHub Secrets

### 2. Self-Hosted Runner
- Runner quraşdırma: `actions-runner` package
- Runner service: systemd ilə avtomatik start
- Runner security: non-root user, isolated workspace
- Runner monitoring: health check, disk space

### 3. Deployment Strategy
- **Blue-Green**: yeni version ayrı container-da qalx → health check → traffic switch
- **Rolling Update**: `docker compose up -d --build service` — zero downtime
- **Rollback**: `docker compose down && git checkout prev-tag && docker compose up -d`
- **Database migrations**: backend startup-da avtomatik (EF Core)

### 4. Pipeline Stages

```yaml
# Typical workflow
name: Deploy
on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: self-hosted
    steps:
      - checkout
      - docker compose build
      - docker compose up -d
      - health check
      - cloudflare cache purge
      - notify (success/failure)
```

### 5. Rollback Plan
- Git tag hər deploy-dan əvvəl: `deploy-YYYYMMDD-HHMM`
- Rollback: `git checkout deploy-prev && docker compose up -d --build`
- Database rollback: EF Core `dotnet ef database update PreviousMigration`

## Quality Bar

- Pipeline 10 dəqiqə ərzində tamamlanmalıdır
- Failed deploy avtomatik rollback etməlidir
- Hər deploy-dan sonra health check keçməlidir
- Secrets heç vaxt pipeline loglarında görünməməlidir
