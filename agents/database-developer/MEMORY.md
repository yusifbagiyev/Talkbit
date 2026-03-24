# Database Developer Memory

> This file is private to the database-developer agent. Updated after weekly reviews with confirmed patterns.

## What Works
<!-- Proven schema patterns with evidence -->

### PostgreSQL `timestamptz` — Requires `DateTimeKind.Utc` (2026-03-24)
- EF Core / Npgsql rejects `DateTime` with `Kind=Unspecified` at runtime
- **Schema rule**: `timestamp with time zone` columns require application to provide `Kind=Utc` — note this in schema design for backend dev
- Affected fields: `DateOfBirth`, `HiringDate`, and any date-only field from HTTP requests

## What Doesn't Work
<!-- Anti-patterns to avoid with evidence -->

## Patterns Noticed
<!-- Emerging signals needing more data -->

## Schema Decisions
<!-- Why certain designs were chosen -->

## Performance Insights
<!-- Index strategies, query patterns that proved effective -->

## Process Improvements
<!-- How this agent's own workflow should improve -->

## Last Updated
-
