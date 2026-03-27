# Backend Task: Department Avatar Feature

**From**: Product Owner
**To**: Backend Developer
**Date**: 2026-03-27
**Priority**: P1

---

## Xülasə

Department-lara avatar dəstəyi əlavə edilməlidir. İstifadəçi bir department-a təyin ediləndə, həmin department-ın avatarı avtomatik olaraq istifadəçinin avatarına çevrilməlidir.

**Dəyişiklik nöqtələri:**
1. EF Core migration — `departments` cədvəlinə `avatar_url` sütunu
2. `Department` entity — `AvatarUrl` field
3. `DepartmentConfiguration` — `avatar_url` mapping
4. `CreateDepartmentCommand` — `AvatarUrl` parametri
5. `UpdateDepartmentCommand` — `AvatarUrl` parametri
6. `DepartmentDto` — `AvatarUrl` field
7. `AssignEmployeeToDepartment` handler — user avatarını auto-set et
8. `FilesController` — department avatar upload endpoint

---

## 1. EF Core Migration

Migration adı: `AddAvatarUrlToDepartments`

```bash
dotnet ef migrations add AddAvatarUrlToDepartments --project ChatApp.Modules.Identity.Infrastructure --startup-project ChatApp.Api
dotnet ef database update --project ChatApp.Modules.Identity.Infrastructure --startup-project ChatApp.Api
```

Migration-da:
```csharp
migrationBuilder.AddColumn<string>(
    name: "avatar_url",
    table: "departments",
    type: "character varying(500)",
    maxLength: 500,
    nullable: true);
```

---

## 2. Department Entity

**Fayl:** `ChatApp.Modules.Identity.Domain/Entities/Department.cs`

`AvatarUrl` property və `SetAvatarUrl()` metodu əlavə et:

```csharp
public string? AvatarUrl { get; private set; }

public void SetAvatarUrl(string? avatarUrl)
{
    AvatarUrl = avatarUrl;
    UpdateTimestamp();
}
```

---

## 2. DepartmentConfiguration

**Fayl:** `ChatApp.Modules.Identity.Infrastructure/Persistence/Configurations/DepartmentConfiguration.cs`

```csharp
builder.Property(d => d.AvatarUrl)
    .HasColumnName("avatar_url")
    .HasMaxLength(500)
    .IsRequired(false);
```

---

## 3. CreateDepartmentCommand

**Fayl:** `ChatApp.Modules.Identity.Application/Commands/Departments/CreateDepartmentCommand.cs`

`AvatarUrl` parametrini əlavə et:

```csharp
public record CreateDepartmentCommand(
    string Name,
    Guid? CallerCompanyId,
    Guid? ParentDepartmentId,
    string? AvatarUrl         // ← YENİ
) : IRequest<Result<Guid>>;
```

Handler-da department yaradılarkən:
```csharp
department.SetAvatarUrl(request.AvatarUrl);
```

---

## 4. UpdateDepartmentCommand

**Fayl:** `ChatApp.Modules.Identity.Application/Commands/Departments/UpdateDepartmentCommand.cs`

`AvatarUrl` parametrini əlavə et:

```csharp
public record UpdateDepartmentCommand(
    Guid DepartmentId,
    string? Name,
    Guid? ParentDepartmentId,
    Guid? CallerCompanyId,
    bool IsSuperAdmin,
    string? AvatarUrl         // ← YENİ
) : IRequest<Result>;
```

Handler-da `AvatarUrl` null deyilsə update et:
```csharp
if (request.AvatarUrl is not null)
    department.SetAvatarUrl(request.AvatarUrl);
```

---

## 5. DepartmentDto

**Fayl:** `ChatApp.Modules.Identity.Application/Queries/Departments/GetAllDepartmentsQuery.cs`

`DepartmentDto`-ya `AvatarUrl` əlavə et:

```csharp
record DepartmentDto(
    Guid Id,
    string Name,
    Guid? ParentDepartmentId,
    string? ParentDepartmentName,
    Guid? HeadOfDepartmentId,
    string? HeadOfDepartmentName,
    string? AvatarUrl,         // ← YENİ
    DateTime CreatedAtUtc);
```

Query-də `AvatarUrl = d.AvatarUrl` əlavə et.

---

## 6. AssignEmployeeToDepartment Handler — Auto Avatar

**Fayl:** `ChatApp.Modules.Identity.Application/Commands/Employees/AssignEmployeeToDepartmentCommand.cs`

İstifadəçi department-a təyin ediləndə, əgər department-ın `AvatarUrl`-u varsa, istifadəçinin avatarını auto-set et:

Handler-da department yüklənəndən sonra (department obyekti artıq mövcuddur çünki `user.Employee.AssignToDepartment(departmentId, ...)` çağırılır, lakin department entity-si ayrıca yüklənməlidir):

```csharp
// Department-ı yüklə
var department = await _unitOfWork.Departments.GetByIdAsync(request.DepartmentId, cancellationToken);
if (department is null)
    return Result.Failure("Department not found");

// ... mövcud assignment məntiqi ...
user.Employee.AssignToDepartment(department.Id, department.HeadOfDepartmentId);

// Auto avatar: department-ın avatarı varsa user-ə keç
if (!string.IsNullOrEmpty(department.AvatarUrl))
    user.UpdateAvatarUrl(department.AvatarUrl);
```

> **Qeyd:** `User.UpdateAvatarUrl()` artıq mövcuddur (`ChatApp.Modules.Identity.Domain/Entities/User.cs`, line 132-136). Mövcud metodu istifadə et.

---

## 7. FilesController — Department Avatar Upload Endpoint

**Fayl:** `ChatApp.Modules.Files.Api/Controllers/FilesController.cs`

Yeni endpoint: `POST /api/files/upload/department-avatar`

```csharp
[HttpPost("upload/department-avatar")]
[Authorize]
[ProducesResponseType(typeof(FileUploadResult), StatusCodes.Status200OK)]
public async Task<IActionResult> UploadDepartmentAvatar(
    IFormFile file,
    CancellationToken cancellationToken)
{
    if (file == null || file.Length == 0)
        return BadRequest("File is required");

    var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
    if (!allowedTypes.Contains(file.ContentType.ToLower()))
        return BadRequest("Only image files are allowed");

    var callerId = GetCallerId(); // mövcud helper metod
    var companyId = GetCallerCompanyId(); // mövcud helper metod

    var command = new UploadFileCommand(
        File: file,
        UploadedBy: callerId,
        CompanyId: companyId,
        SubDirectory: $"departments/avatars",
        IsProfilePicture: true   // eyni image processing (resize + compress)
    );

    var result = await _mediator.Send(command, cancellationToken);
    return result.IsSuccess ? Ok(result.Value) : BadRequest(result.Error);
}
```

> **Qeyd:** `UploadFileCommand`-ın `SubDirectory` parametri mövcuddursa istifadə et. Yoxdursa, `IsProfilePicture: true` ilə eyni upload command-ı işlət — storage path-in fərqli olması vacib deyil, URL qaytarılması vacibdir.
> Əgər `SubDirectory` yoxdursa, mövcud profil şəkli upload logic-ini uyğunlaşdır: `company/{companyId}/departments/avatars/{uniqueFileName}` path-i ilə.

**Response:** `FileUploadResult` — mövcud struktur, frontend `downloadUrl` field-ini götürəcək.

---

## Qeydlər

- Department avatarını yüklədikdə `downloadUrl` alınır → frontend onu `CreateDepartmentCommand.AvatarUrl` kimi göndərəcək
- Bu iki ayrı request-dir: əvvəl upload → sonra create/update department
- Department dəyişəndə user-in avatarı **həmişə** department avatarı ilə override edilir — user-in öz avatarı olsa belə:

```csharp
if (!string.IsNullOrEmpty(department.AvatarUrl))
    user.UpdateAvatarUrl(department.AvatarUrl);
```
