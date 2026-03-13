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