# Frontend Developer Memory

> This file is private to the frontend-developer agent. Updated after weekly reviews with confirmed patterns.

## What Works
<!-- Proven patterns with evidence -->

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

## Patterns Noticed
<!-- Emerging signals needing more data -->

## Component Decisions
<!-- Why certain patterns were chosen -->

## Performance Insights
<!-- Rendering patterns, bundle size findings -->

## Process Improvements
<!-- How this agent's own workflow should improve -->

## Last Updated
-
