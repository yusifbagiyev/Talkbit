# Frontend Developer Memory

> This file is private to the frontend-developer agent. Updated after weekly reviews with confirmed patterns.

## What Works
<!-- Proven patterns with evidence — all ChatApp-specific patterns live in CHATAPP_FRONTEND_UX.md -->

## Available Skills

### chatapp-frontend-ux (`skills/CHATAPP_FRONTEND_UX.md`)
- ChatApp-specific UX patterns for Bitrix24-style components
- Covers: dropdown positioning, member picker, sidebar cache (SWR), animations, scrollbar, disabled states
- Common pitfalls: hook order errors, useEffect cleanup with refs, variable initialization order, chip display
- Use when: working on sidebar panels, ChannelPanel, DetailSidebar, member picker, file/media grid, any Bitrix24-style component

### frontend-audit
- `skills/FRONTEND_AUDIT.md` — Workflow, audit phases, report structure, condensed reference
- `skills/AUDIT_CHECKLIST.md` — Full 80+ point checklist across 8 domains
- `skills/ANTI_AI_DESIGN.md` — AI fingerprints, font pairing library, color palette recipes, texture/depth patterns
- `skills/PERFORMANCE_GUIDE.md` — Memory leaks, React re-renders, CSS performance, N+1 patterns, bundle optimization
- Use when: reviewing components, catching performance issues, ensuring UI doesn't look AI-generated

## What Doesn't Work
<!-- Anti-patterns to avoid with evidence -->

### Virtual Scrolling — FORBIDDEN
- Never use `react-virtual`, windowing, or any virtualization library
- **Reason:** Tried multiple times, caused scroll breakage and other UI issues
- **Alternative:** `React.memo`, `useMemo`, `useCallback`, debounce/throttle, cursor-based pagination

### DTO Field Names — Always verify in backend before writing frontend
- `UserDetailDto`, `UserListItemDto`, `UserSearchResultDto`, `SupervisorDto`, `SubordinateDto` all use **`position`** (not `positionName`)
- `SupervisorDto` uses **`userId`** (not `id`) — normalize on load: `id: s.id ?? s.userId`
- `UserDetailDto` has **`companyId`** field (needed for company-scoped API calls)
- Rule: Before using `user.someField` in JSX, open the DTO file and confirm the exact camelCase field name
- Wrong field → shows "—" silently with no error, extremely hard to notice

### Search vs List — Two different endpoints, different contracts
- `GET /api/users` → paginated list, no search support, returns `List<UserListItemDto>` (direct array, not `{ items }`)
- `GET /api/users/search?q=...` → full-text search, returns `List<UserSearchResultDto>` (direct array), **minimum 2 chars** (returns `[]` for 1 char silently)
- Never pass `?search=...` to the list endpoint — it silently ignores it
- Frontend must enforce the 2-char minimum: `q.length >= 2 ? searchUsers(q) : getUsers({ pageSize: 50 })`
- Both return direct arrays — use: `d?.items ?? (Array.isArray(d) ? d : [])`

### Backend search minimum constraints — mirror on frontend
- When backend has minimum length / format constraints on inputs, always enforce the same on frontend
- Silent empty responses (no error, just `[]`) are the hardest bugs to diagnose
- Check the query handler for early returns: `if (searchTerm.Length < 2) return empty`

### Enum serialization — always send integers, never strings
- Backend has NO global `JsonStringEnumConverter` — only camelCase naming policy
- All enums must be sent as integers: `Role` (User=0, Admin=1, SuperAdmin=2), `ChannelType` (Public=1, Private=2), `MemberRole` (Member=1, Admin=2, Owner=3)
- Exception: `NodeType` in OrganizationHierarchyNodeDto has local `[JsonConverter(typeof(JsonStringEnumConverter))]` — reads as string
- Pattern: `const ROLE_VALUES = { User: 0, Admin: 1, SuperAdmin: 2 }; role: ROLE_VALUES[role] ?? 0`

### Password validation rules — backend requires all of these
- Minimum 8 characters (NOT 6)
- At least one uppercase letter: `/[A-Z]/`
- At least one lowercase letter: `/[a-z]/`
- At least one number: `/[0-9]/`
- At least one special character: `/[^a-zA-Z0-9]/`
- Applies to: CreateUser, AdminChangePassword, ChangePassword (user self-service)
- Always validate ALL rules on frontend before API call — `extractErrorMessage` in api.js will surface backend messages if missed

## Patterns Noticed
<!-- Emerging signals needing more data -->

## Component Decisions
<!-- Why certain patterns were chosen -->

## Performance Insights
<!-- Rendering patterns, bundle size findings -->

## Process Improvements
<!-- How this agent's own workflow should improve -->

## Last Updated
- 2026-03-27: Added DTO field name verification rule, search vs list endpoint contract, backend constraint mirroring
