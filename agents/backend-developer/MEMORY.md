# Backend Developer Memory

> This file is private to the backend-developer agent. Updated after weekly reviews with confirmed patterns.

## What Works
<!-- Proven patterns with evidence -->

### DateTime UTC — PostgreSQL `timestamp with time zone` (2026-03-24)
- Frontend `<input type="date">` sends `YYYY-MM-DD` → .NET parses as `Kind=Unspecified`
- PostgreSQL `timestamptz` rejects `Kind=Unspecified` → throws at runtime
- **Fix**: In Command Handler, always wrap date values with `DateTime.SpecifyKind(value, DateTimeKind.Utc)`
  ```csharp
  if (request.HiringDate.HasValue)
      employee.UpdateHiringDate(DateTime.SpecifyKind(request.HiringDate.Value, DateTimeKind.Utc));
  ```
- Apply to ALL `DateTime` fields that come from frontend date inputs

### EF Core ThenInclude for Nested Navigation (2026-03-24)
- `Include(u => u.Employee!.Department)` alone does NOT load `Department.HeadOfDepartment`
- Must chain: `.Include(u => u.Employee!.Department).ThenInclude(d => d!.HeadOfDepartment)`
- Pattern for deeply nested navigation: each level needs its own `ThenInclude`
- Forgetting this causes `null` reference — DTO mapping silently returns `null` instead of throwing

### DTO Fields for Related Entity Names (2026-03-24)
- When frontend needs a related entity's display name (e.g., head of department's full name), add a dedicated nullable string field to the DTO
- Do NOT expose the full nested object — map only what's needed: `HeadOfDepartmentName = user.Employee?.Department?.HeadOfDepartment?.FullName`
- Keep DTOs flat for frontend consumption

## What Doesn't Work
<!-- Anti-patterns to avoid with evidence -->

### Computed Property Shortcut-lar Entity-də YASAQDIR (2026-03-25)
- `bool IsAdmin => Role == Role.Admin` kimi shortcut property-lər Entity-yə əlavə etmə
- Çaşqınlıq yaradır: DB sütunudur yoxsa computed-dır? JWT claim-dir yoxsa entity property-dir?
- EF Core `builder.Ignore()` tələb edir — əlavə konfiqurasiya yükü
- **Doğru yanaşma**: Birbaşa `user.Role == Role.Admin` yaz. Hər yerdə eyni qaydada, aydın və açıq.
- Eyni qaydada JWT-də dublikat claim-lər saxlama — `role` claim-indən derive et
- **Qayda**: Əgər bir dəyər başqa field-dən derive olunursa, onu ayrıca saxlama — nə entity-də, nə JWT-də, nə DTO-da

## Patterns Noticed
<!-- Emerging signals needing more data -->

## Technical Decisions
<!-- Architecture and design decisions with reasoning -->

## Performance Insights
<!-- Query patterns, caching strategies that proved effective -->

→ Bütün EF Core query anti-pattern-lər skill-də: `skills/EF_CORE_QUERY_OPTIMIZATION.md`

**Xülasə (2026-03-27) — istifadəçi bu səhvləri kodda tapdı, düzəliş tələb etdi:**
- Loop içində `ExistsAsync` → N+1 (BatchMarkChannelMessagesAsRead)
- `GetChannelMessagesAsync(int.MaxValue)` sonra memory filter (2 komanda)
- While loop + hər iterasiyada DB sorğusu (GetDepartmentUsers hierarchy traversal)
- Supervisor sorğusuna lazımsız `Include(SupervisorLinks)` — `.Any()` üçün AnyAsync kifayətdir
- `ToListAsync()` sonra C#-da `.Count()/.Sum()` — aggregasiya DB-də olmalıdır
- 3 ayrı round trip əvəzinə tək `.Select()` proyeksiyası

**Yanlış alarm (false positive) — bunlar problemdir sanıla bilər amma deyil:**
- `UpdateAsync` loop içindədirsə amma `_context.Update()` + `Task.CompletedTask`-dırsa — DB hit yoxdur
- `.Select()` proyeksiyası içindəki `c.Users.Count()` — EF Core SQL subquery-ə çevirir

## Process Improvements
<!-- How this agent's own workflow should improve -->

## Last Updated
- 2026-03-27: EF Core query anti-patterns skill-ə köçürüldü
