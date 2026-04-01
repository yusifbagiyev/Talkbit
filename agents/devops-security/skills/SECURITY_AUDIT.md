# Skill: Security Audit

## Purpose

Proaktiv təhlükəsizlik auditi — OWASP Top 10, infrastruktur boşluqları, dependency vulnerabilities, access control yoxlaması.

## Scope

- OWASP Top 10 yoxlaması
- Dependency vulnerability scan
- Infrastructure security review
- Access control audit
- Penetration testing (authorized)
- Compliance check

## Process

### 1. OWASP Top 10 Audit Checklist

| # | Risk | Yoxla |
|---|------|-------|
| A01 | Broken Access Control | API endpoint-lərində authorization yoxlaması, company isolation |
| A02 | Cryptographic Failures | JWT secret strength, password hashing (bcrypt), HTTPS enforcement |
| A03 | Injection | SQL injection (EF Core parameterized), XSS (React auto-escape), command injection |
| A04 | Insecure Design | Rate limiting, account lockout, business logic flaws |
| A05 | Security Misconfiguration | Default credentials, unnecessary endpoints (Swagger production-da?), CORS |
| A06 | Vulnerable Components | NuGet/npm dependency CVEs, outdated base images |
| A07 | Authentication Failures | Brute force protection, session management, token rotation |
| A08 | Software & Data Integrity | CI/CD pipeline integrity, dependency pinning |
| A09 | Logging & Monitoring | Audit logging, failed login tracking, anomaly detection |
| A10 | SSRF | URL validation, internal service access restriction |

### 2. Dependency Scan
```bash
# .NET dependencies
dotnet list package --vulnerable --include-transitive

# npm dependencies
cd chatapp-frontend && npm audit

# Docker images
docker scout cves talkbit-backend
docker scout cves talkbit-frontend
```

### 3. Infrastructure Security Review
- [ ] SSH: key-only auth, no root login, non-standard port
- [ ] Firewall: yalnız 80, 443 açıq (UFW/firewalld)
- [ ] Docker: daemon socket protected
- [ ] Redis: password protected, no external exposure
- [ ] PostgreSQL: no external exposure, strong password
- [ ] Nginx: security headers (X-Frame-Options, CSP, HSTS)
- [ ] Cloudflare: WAF rules, bot protection, DDoS mitigation

### 4. Access Control Audit
- [ ] SuperAdmin: yalnız 1 nəfər, güclü password
- [ ] Admin: company-scoped, cross-company access yoxdur
- [ ] User: yalnız öz company data-sına access
- [ ] API: bütün endpoint-lər [Authorize] attribute-u var
- [ ] File serving: authenticated proxy, direct access blocked
- [ ] SignalR: JWT token required

### 5. Penetration Testing (Authorized)
- [ ] Authentication bypass attempts
- [ ] Privilege escalation (User → Admin → SuperAdmin)
- [ ] Cross-company data access
- [ ] File path traversal
- [ ] Rate limit bypass
- [ ] WebSocket injection

### 6. Nginx Security Headers
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' wss:;" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## Output

Audit report formatı:
```markdown
# Security Audit Report — YYYY-MM-DD

## Summary
- Critical: X
- High: X
- Medium: X
- Low: X

## Findings
### [CRITICAL] Finding title
- **Risk**: Description
- **Impact**: What can happen
- **Fix**: How to fix
- **Status**: Open/Fixed

## Recommendations
```

## Quality Bar

- Aylıq audit mütləqdir
- Critical finding → 24 saat ərzində fix
- High finding → 1 həftə ərzində fix
- Audit report `outputs/`-a yazılmalıdır
- Bütün fix-lər journal-a log olunmalıdır
