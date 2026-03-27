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

### EF Core Aggregation — DB-də et, Memory-ə çəkmə (2026-03-27)
İstifadəçi bu yanaşmadan narazı qaldı — düzəliş tələb etdi.

**YASAQ:**
```csharp
var items = await query.ToListAsync(); // bütün sətirləri memory-ə çəkir
var count = items.Count(x => x.Type == FileType.Image); // C#-da sayır
```

**DOĞRU:**
```csharp
var result = await query
    .GroupBy(_ => 1)
    .Select(g => new {
        Total = g.Count(),
        ImageCount = g.Count(f => f.FileType == FileType.Image),
        TotalBytes = g.Sum(f => f.FileSizeInBytes)
    })
    .FirstOrDefaultAsync(cancellationToken);
```

### EF Core — Tək Proyeksiya Sorğusu (2026-03-27)
Bir entity üçün 3 ayrı `await` çağırmaq əvəzinə tək `.Select()` proyeksiyası ilə bütün məlumatı DB-dən al.

**YASAQ:** 3 ayrı round trip
```csharp
var company = await repo.FirstOrDefaultAsync(...);
var userCount = await users.CountAsync(...);
var deptCount = await depts.CountAsync(...);
```

**DOĞRU:** Tək round trip, DB-də aggregasiya
```csharp
var result = await repo
    .AsNoTracking()
    .Where(c => c.Id == id)
    .Select(c => new {
        c.Id, c.Name,
        UserCount = c.Users.Count(u => u.IsActive),
        DeptCount = c.Departments.Count()
    })
    .FirstOrDefaultAsync(cancellationToken);
```

### Lazımsız Include-lar (2026-03-27)
- Navigation property-ni Include etmə əgər yalnız FK column (Id) lazımdırsa
- `Include(d => d.ParentDepartment)` YASAQ — `d.ParentDepartmentId` birbaşa column-dur, Include tələb etmir
- Yalnız related entity-nin FIELD-inə ehtiyac varsa Include et (məs. `d.HeadOfDepartment.FullName`)

## Process Improvements
<!-- How this agent's own workflow should improve -->

## Last Updated
-
