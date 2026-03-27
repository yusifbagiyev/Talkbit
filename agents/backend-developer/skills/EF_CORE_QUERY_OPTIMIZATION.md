# EF Core Query Optimization — Anti-Patterns & Rules

## 1. N+1: Loop İçində DB Sorğusu — YASAQDIR

**Yanlış:**
```csharp
foreach (var msgId in messageIds)
{
    if (await repo.ExistsAsync(msgId, userId, ct))
        existingIds.Add(msgId);
}
```

**Doğru:** Tək sorğu ilə bütün ID-ləri DB-dən al:
```csharp
var existingIds = await _context.Table
    .Where(r => messageIds.Contains(r.MessageId) && r.UserId == userId)
    .Select(r => r.MessageId)
    .ToListAsync(ct);
```

**Qayda:** Loop içində `await` olan hər DB çağırışı N+1-dir. Həmişə `Contains` ilə batch sorğuya çevir.

---

## 2. `.ToListAsync()` + Memory Aggregasiya — YASAQDIR

**Yanlış:**
```csharp
var items = await query.ToListAsync();
var count = items.Count(x => x.Type == FileType.Image); // C#-da sayır
var total = items.Sum(x => x.Size);
```

**Doğru:** Aggregasiya DB-də edilməlidir:
```csharp
var result = await query
    .GroupBy(_ => 1)
    .Select(g => new {
        Total = g.Count(),
        ImageCount = g.Count(f => f.FileType == FileType.Image),
        TotalBytes = g.Sum(f => f.FileSizeInBytes)
    })
    .FirstOrDefaultAsync(ct);
```

**Qayda:** `.ToListAsync()` sonra `.Count()`, `.Sum()`, `.Average()`, `.Max()`, `.Min()` — hamısı YASAQDIR. Aggregasiya həmişə DB-də.

---

## 3. `int.MaxValue` ilə Bütün Məlumatı Yükləmək — YASAQDIR

**Yanlış:**
```csharp
var allMessages = await repo.GetMessagesAsync(channelId, int.MaxValue, ...);
var filtered = allMessages.Where(m => ids.Contains(m.Id) && m.SenderId != userId).ToList();
```

**Doğru:** Filtri DB sorğusuna əlavə et, lazımsız məlumatı heç vaxt yükləmə:
```csharp
var filtered = await _context.Messages
    .Where(m => m.ChannelId == channelId && ids.Contains(m.Id) && m.SenderId != userId)
    .Select(m => m.Id)
    .ToListAsync(ct);
```

**Qayda:** Əgər yüklənən data sonra memory-də filter olunursa — filtri DB-yə köçür. Heç vaxt `int.MaxValue` istifadə etmə.

---

## 4. Lazımsız `Include` — YASAQDIR

**Yanlış:**
```csharp
// ParentDepartmentId artıq FK column-dur, Include lazım deyil
.Include(d => d.ParentDepartment)
// SupervisorLinks yalnız .Any() üçün yüklənir — memory-ə çəkir
.Include(u => u.Employee!.SupervisorLinks)
```

**Doğru:**
```csharp
// FK column-u birbaşa istifadə et
d.ParentDepartmentId

// .Any() üçün DB-də AnyAsync istifadə et
var isCircular = await _context.Users
    .Where(u => u.Id == supervisorId)
    .AnyAsync(u => u.Employee!.SupervisorLinks.Any(s => s.SupervisorEmployeeId == employeeId), ct);
```

**Qayda:** Include et yalnız related entity-nin öz **field-lərinə** ehtiyacın varsa (məs. `d.HeadOfDepartment.FullName`). Yalnız FK Id lazımdırsa — Include etmə. `.Any()` üçün — `AnyAsync` DB-də.

---

## 5. Çoxlu Round Trip — Tək Proyeksiya ilə Əvəz Et

**Yanlış:**
```csharp
var company = await repo.FirstOrDefaultAsync(c => c.Id == id);
var userCount = await users.CountAsync(u => u.CompanyId == id && u.IsActive);
var deptCount = await depts.CountAsync(d => d.CompanyId == id);
```

**Doğru:**
```csharp
var result = await _context.Companies
    .AsNoTracking()
    .Where(c => c.Id == id)
    .Select(c => new {
        c.Id, c.Name,
        UserCount = c.Users.Count(u => u.IsActive),
        DeptCount = c.Departments.Count()
    })
    .FirstOrDefaultAsync(ct);
```

**Qayda:** Eyni entity üçün 2+ ayrı `await` sorğusu varsa — tək `.Select()` proyeksiyasına birləşdir.

---

## 6. While Loop ilə Hierarchy Traversal — YASAQDIR

**Yanlış:**
```csharp
while (true)
{
    var dept = await _context.Departments
        .Where(d => d.Id == currentId)
        .Select(d => new { d.ParentDepartmentId })
        .FirstOrDefaultAsync(ct); // hər iterasiyada 1 sorğu
    if (dept?.ParentDepartmentId == null) return currentId;
    currentId = dept.ParentDepartmentId.Value;
}
```

**Doğru:** Bütün departamentləri tək sorğu ilə yüklə, in-memory traverse et:
```csharp
var allDepts = await _context.Departments
    .Where(d => d.CompanyId == companyId)
    .Select(d => new { d.Id, d.ParentDepartmentId })
    .AsNoTracking()
    .ToListAsync(ct);

var lookup = allDepts.ToDictionary(d => d.Id, d => d.ParentDepartmentId);
var rootId = departmentId;
while (lookup.TryGetValue(rootId, out var parentId) && parentId.HasValue)
    rootId = parentId.Value;
```

**Qayda:** Hierarchy traversal üçün heç vaxt while loop + DB sorğusu istifadə etmə. Bir dəfə yüklə, in-memory gəz.

---

## 7. `.Select()` Proyeksiyası İçindəki Aggregasiya — YAXŞIDIR (False Positive)

```csharp
// Bu DOĞRUDUR — EF Core bunu SQL COUNT subquery-ə çevirir
.Select(c => new CompanyDto(
    c.Users.Count(u => u.IsActive),  // SQL: (SELECT COUNT(*) FROM users WHERE ...)
    ...))
.ToListAsync(ct)
```

**Qayda:** `.Select()` proyeksiyası içindəki `.Count()`, `.Sum()` EF Core tərəfindən SQL subquery-ə çevrilir — problem deyil.

---

## 8. `UpdateAsync` Loop İçində — Baxılmalı (False Positive Ola Bilər)

```csharp
foreach (var message in messages)
{
    message.Delete();
    await repo.UpdateAsync(message, ct); // əgər bu sadəcə _context.Update(entity) isə — DB hit yoxdur
}
await _unitOfWork.SaveChangesAsync(ct); // tək DB round trip
```

**Qayda:** `UpdateAsync` implementation-ını yoxla. Əgər `_context.Entity.Update(item)` + `Task.CompletedTask` isə — N+1 deyil, change tracking-dir, `SaveChangesAsync` tək round trip edir.
