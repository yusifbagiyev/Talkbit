# ChatApp Project Notes

## Arxitektura
- **Pattern**: Modular Monolith + Clean Architecture + DDD
- **Backend**: ASP.NET Core API, CQRS (MediatR), SignalR, EF Core
- **Frontend**: React (Vite + JavaScript) — migrated from Blazor WASM due to UI freezing
- **UI Style**: Bitrix 24 style, use modern ui/ux tools

## React Migration Context
- User works on 2 PCs. Always keep `tasks/todo.md` updated so progress syncs via GitHub.
- Progress tracker: `tasks/todo.md` — read this first when resuming.
- Lessons file: `tasks/lessons.md` — read this at session start.
- React project location: `C:\Users\Joseph\Desktop\ChatApp\chatapp-frontend\`

## Modullar
Identity | Channels | DirectMessages | Files | Notifications | Search | Settings

- İstifadə olunan funksiyanın optimizasiyaya ehtiyacı varsa, optimizasiya et.
- Yeni bir method əlavə edərkən, əgər köhnə və ya ona oxşar method varsa optimallaşdırmağa çalış.
- Lazımsız kodları silməyi unutma
- Həmişə kodları optimizasiya etmək, code refactor etmək və performansı yüksəltmək lazımdır.
- Yeni bir kod yazmamışdan öncə yazılan arxitekturanı, yanaşmanı təhlil et , daha sonra kod yaz.
- Hər dəfə plan yaratmağa ehtiyac yoxdur. Sadəcə fikrini cəmlə və həll et
- Kodun strukturu , arxitekturası hansı üsullarla yazılıbsa, o qaydanı pozma!

## Workflow Orchestration

### 1. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 2. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 3. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 4. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes – don't over-engineer
- Challenge your own work before presenting it

### 5. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests – then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

### 6. Kod optimizasiyası
- Əgər doğru olmayan bir kod yazdıqdan sonra problemin onda deyil də başqa bir yerdən qaynaqlandığını görərsən, etdiyin lazımsız kod dəyişikliklərini ləğv et ki, lazımsız kod kütləsi yaranmasın.
- Kodları mümkün qədər optimizasiya et, optimizasiya etdikdən sonra doğruluğuna əmin ol və lazımsız kodları sil.


### 7. Agentlərlə iş
- Agentlər nəticələri düzgün və dəqiq şəkildə təqdim etməlidir.
- Yanlış nəticə verilən agentlərdən istifadə olunmamalıdır.
- Commentləri azərbaycan dilində yaz, xətaları, warningləri və informasiyaları isə mütləq ingilis dilində yaz.

## Task Management

1. **Track Progress**: Mark items complete as you go
2. **Explain Changes**: High-level summary at each step
3. **Document Results**: Add review section to `tasks/todo.md`
4. **Capture Lessons**: Update `tasks/lessons.md` after corrections
5. **Dont build**: Əgər sadəcə frontenddə iş görürsənsə, backend proyektini build etmə və ya əksinə.
6. **Performance**: Kod yazarkən həm mövcud kodun vəziyyətinə bax, həm də yeni implementasiya edəcəyin kodun vəziyyətinə. Hansı üsul daha optimal, daha performans artırıcıdırsa, onu yaz. Lazımsız kodları sil.

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Agent Team System

Multi-agent system powered by markdown files. Agents live in `agents/` and communicate through `journal/entries/`.

### Agents

| Agent | Folder | Heartbeat | Skills |
|-------|--------|-----------|--------|
| Product Owner | `agents/product-owner/` | Monday AM | Requirements, Backlog Management, Sprint Planning |
| Backend Developer | `agents/backend-developer/` | Tuesday | API Development, Testing, Code Review, SignalR Development |
| Frontend Developer | `agents/frontend-developer/` | Wednesday | Component Development, SignalR Integration, State Management |
| UI/UX Developer | `agents/uiux-developer/` | Monday PM | User Research, Wireframing, Interaction Design |
| Database Developer | `agents/database-developer/` | Tuesday | Schema Design, Query Optimization, Migration Management |
| DevOps & Security Admin | `agents/devops-security/` | Friday | CI/CD Pipeline, Container Security, Security Audit, Infrastructure, Monitoring, Incident Response, SSL & Network, Backup & Recovery |

### Agent System Files

- `AGENT_REGISTRY.md` — Master list of all agents
- `CONVENTIONS.md` — Naming rules and structure
- `knowledge/` — Static reference (STRATEGY, AUDIENCE, BRAND) — read-only for agents
- `journal/entries/` — Shared communication channel — agents read and write here
- `orchestrator/` — Task routing and priority management
- `templates/` — Journal entry, task intake, weekly review templates

### Information Flow

```
product-owner → journal → uiux-developer → journal → database-developer → journal → backend-developer → journal → frontend-developer
                                                                                                                        ↓
                                                                                                              devops-security (deploy, audit)
```

Agents never talk directly. All communication flows through `journal/entries/`.