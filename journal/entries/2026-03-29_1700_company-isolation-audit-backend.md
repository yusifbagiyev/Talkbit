# Backend Task: Company Isolation — Remaining Security Gaps

**From**: Product Owner
**To**: Backend Developer
**Date**: 2026-03-29
**Priority**: P0 — SECURITY CRITICAL

---

## Xülasə

Security audit nəticəsində 6 critical gap tapıldı. Əsas qayda:
- **SuperAdmin** → hər şeyi görür, hər şeyi edə bilər
- **Admin/User** → yalnız öz company-si daxilində

---

## 1. GetPublicChannelsQuery — CompanyId Filter Yoxdur

**File:** `ChatApp.Modules.Channels.Application/Queries/GetPublicChannels/GetPublicChannelsQuery.cs`

Hal-hazırda bütün company-lərin public channel-larını qaytarır. CompanyId parametri əlavə et:

```csharp
public record GetPublicChannelsQuery(
    Guid? CallerCompanyId,
    bool IsSuperAdmin
) : IRequest<Result<List<ChannelDto>>>;
```

Handler-da:
```csharp
var query = _unitOfWork.Channels.Where(c => c.Type == ChannelType.Public);

if (!request.IsSuperAdmin && request.CallerCompanyId.HasValue)
    query = query.Where(c => c.CompanyId == request.CallerCompanyId);

var channels = await query.ToListAsync(cancellationToken);
```

Repository-dəki `GetPublicChannelsAsync()` metodunu da uyğunlaşdır — `companyId` parametri qəbul etsin.

Controller-da `CallerCompanyId` və `IsSuperAdmin` JWT claim-dən alınıb ötürülməlidir.

---

## 2. SearchChannelsQuery — Cross-Company Axtarış

**File:** `ChatApp.Modules.Channels.Application/Queries/SearchChannels/SearchChannelsQuery.cs`

`GetPublicChannelsAsync()` çağırışı companyId filtrsiz işləyir. Fix 1-dəki dəyişiklik bunu da düzəldəcək — amma SearchChannelsQuery-ə də `CallerCompanyId` və `IsSuperAdmin` ötür:

```csharp
public record SearchChannelsQuery(
    string SearchTerm,
    Guid RequestedBy,
    Guid? CallerCompanyId,
    bool IsSuperAdmin
) : IRequest<Result<List<ChannelDto>>>;
```

Handler-da `GetPublicChannelsAsync(callerCompanyId, isSuperAdmin)` çağır.

---

## 3. GetAllCompaniesQuery — SuperAdmin Restriction Yoxdur

**File:** `ChatApp.Modules.Identity.Application/Queries/Companies/GetAllCompaniesQuery.cs`

İstənilən authenticated user bütün company-ləri görə bilər. Yalnız SuperAdmin görmək imidir.

**Controller-da:**
```csharp
[HttpGet]
[Authorize(Roles = "SuperAdmin")]  // ← Əlavə et (əgər yoxdursa)
public async Task<IActionResult> GetAll(...)
```

Əgər `[Authorize(Roles = "SuperAdmin")]` artıq CompaniesController-da varsa, yoxla ki doğru tətbiq olunub.

---

## 4-6. Company Commands — SuperAdmin Restriction Yoxdur

Aşağıdakı command-lar istənilən authenticated user tərəfindən çağırıla bilər:

- `DeleteCompanyCommand`
- `SetCompanyActiveCommand`
- `UpdateCompanyCommand`

**Fix:** CompaniesController-da bu endpoint-lərin hamısında `[Authorize(Roles = "SuperAdmin")]` olmalıdır:

```csharp
[HttpDelete("{id:guid}")]
[Authorize(Roles = "SuperAdmin")]
public async Task<IActionResult> DeleteCompany(...)

[HttpPatch("{id:guid}/status")]
[Authorize(Roles = "SuperAdmin")]
public async Task<IActionResult> SetCompanyStatus(...)

[HttpPut("{id:guid}")]
[Authorize(Roles = "SuperAdmin")]
public async Task<IActionResult> UpdateCompany(...)
```

> **Qeyd:** Əgər CompaniesController class-level `[Authorize(Roles = "SuperAdmin")]` attribute-u varsa, bu endpoint-lər artıq qorunmuşdur. Amma controller-dan yoxla — bəzi endpoint-lər Admin-ə də açıq ola bilər (məs. öz company-sini update etmək).

---

## JoinChannelCommand — Company Yoxlaması

**File:** `ChatApp.Modules.Channels.Application/Commands/JoinChannel/JoinChannelCommand.cs`

Public channel-a qoşulma zamanı company yoxlaması olmalıdır:

```csharp
// Channel-ın company-si ilə user-in company-si eyni olmalıdır
if (!isSuperAdmin && channel.CompanyId != callerCompanyId)
    return Result.Failure("Cannot join a channel from another company");
```

---

---

## Channels Module — Qalan Handler-lar

Aşağıdakı handler-ların hər birini yoxla. Əgər companyId filteri və ya member/participant yoxlaması yoxdursa, əlavə et:

### Queries:
- `GetChannelQuery` — public channel-lar üçün company yoxlaması əlavə et
- `GetChannelFilesQuery` — member yoxlaması olmalıdır
- `GetChannelLinksQuery` — member yoxlaması olmalıdır
- `GetChannelMembersQuery` — member yoxlaması olmalıdır
- `GetChannelMessagesAroundQuery` — member yoxlaması olmalıdır
- `GetFavoriteMessagesQuery` — user-ə aid (self) olmalıdır
- `GetMessageReactionsQuery` — member yoxlaması olmalıdır
- `GetMessagesAfterDateQuery` — member yoxlaması olmalıdır
- `GetMessagesBeforeDateQuery` — member yoxlaması olmalıdır
- `GetPinnedMessagesQuery` — member yoxlaması olmalıdır
- `GetUnreadCountQuery` — user-ə aid (self) olmalıdır
- `CheckChannelNameQuery` — companyId filteri olmalıdır
- `GetSharedChannelsQuery` — companyId filteri olmalıdır

### Commands:
- `LeaveChannelCommand` — member yoxlaması
- `UpdateChannelCommand` — member/admin yoxlaması + company yoxlaması
- `DeleteChannelMessageCommand` — sender/admin yoxlaması
- `EditChannelMessageCommand` — sender yoxlaması
- `MarkChannelMessageAsReadCommand` — member yoxlaması
- `MarkChannelMessagesAsReadCommand` — member yoxlaması
- `BatchMarkChannelMessagesAsReadCommand` — member yoxlaması
- `BatchDeleteChannelMessagesCommand` — sender/admin yoxlaması
- `RemoveMemberCommand` — admin yoxlaması
- `UpdateMemberRoleCommand` — admin yoxlaması
- `HideChannelCommand` — member yoxlaması
- `MarkAllChannelMessagesAsReadCommand` — member yoxlaması
- `TogglePinChannelCommand` — member yoxlaması
- `ToggleMuteChannelCommand` — member yoxlaması
- `ToggleMarkChannelAsReadLaterCommand` — member yoxlaması
- `UnmarkChannelReadLaterCommand` — member yoxlaması
- `ToggleReactionCommand` — member yoxlaması
- `AddFavoriteCommand` — member yoxlaması
- `PinMessageCommand` — member/admin yoxlaması
- `RemoveFavoriteCommand` — user-ə aid (self) yoxlaması
- `ToggleMessageAsLaterCommand` — member yoxlaması
- `UnpinMessageCommand` — member/admin yoxlaması

---

## DirectMessages Module — Qalan Handler-lar

### Queries:
- `GetConversationMessagesAroundQuery` — participant yoxlaması
- `GetConversationFilesQuery` — participant yoxlaması
- `GetConversationLinksQuery` — participant yoxlaması
- `GetFavoriteMessagesQuery` — user-ə aid (self)
- `GetMessageReactionsQuery` — participant yoxlaması
- `GetMessagesAfterDateQuery` — participant yoxlaması
- `GetMessagesBeforeDateQuery` — participant yoxlaması
- `GetPinnedMessagesQuery` — participant yoxlaması
- `GetUnreadCountQuery` — user-ə aid (self)

### Commands:
- `EditDirectMessageCommand` — sender yoxlaması
- `MarkDirectMessagesAsReadCommand` — participant yoxlaması
- `MarkMessageAsReadCommand` — participant yoxlaması
- `BatchMarkMessagesAsReadCommand` — participant yoxlaması
- `BatchDeleteDirectMessagesCommand` — sender yoxlaması
- `SendBatchDirectMessagesCommand` — participant yoxlaması + company yoxlaması
- `HideConversationCommand` — participant yoxlaması
- `MarkAllMessagesAsReadCommand` — participant yoxlaması
- `ToggleMarkConversationAsReadLaterCommand` — participant yoxlaması
- `ToggleMuteConversationCommand` — participant yoxlaması
- `TogglePinConversationCommand` — participant yoxlaması
- `UnmarkConversationReadLaterCommand` — participant yoxlaması
- `ToggleReactionCommand` — participant yoxlaması
- `AddFavoriteCommand` — participant yoxlaması
- `PinDirectMessageCommand` — participant yoxlaması
- `RemoveFavoriteCommand` — user-ə aid (self)
- `ToggleMessageAsLaterCommand` — participant yoxlaması
- `UnpinDirectMessageCommand` — participant yoxlaması

---

## Identity Module — Qalan Handler-lar

### Commands:
- `DeleteDepartmentCommand` — companyId yoxlaması (admin öz company-sinin dept-ini silə bilər)
- `RemoveDepartmentHeadCommand` — companyId yoxlaması
- `RemoveEmployeeFromDepartmentCommand` — companyId yoxlaması
- `AssignSupervisorToEmployeeCommand` — companyId yoxlaması (eyni company olmalıdır)
- `RemoveSupervisorFromEmployeeCommand` — companyId yoxlaması
- `CreatePositionCommand` — companyId yoxlaması (department-ın company-sinə aiddir)
- `UpdatePositionCommand` — companyId yoxlaması
- `DeletePositionCommand` — companyId yoxlaması
- `DeactivateUserCommand` — companyId yoxlaması (admin öz company-sinin user-ini deactivate edə bilər)
- `ChangePasswordCommand` — user-ə aid (self) — OK
- `AdminChangePasswordCommand` — companyId yoxlaması
- `AssignPermissionToUserCommand` — companyId yoxlaması (admin öz company-sinin user-inə permission verə bilər)
- `RemovePermissionFromUserCommand` — companyId yoxlaması

---

## Files Module

- `DeleteFileCommand` — uploader yoxlaması var, amma admin başqasının faylını silə bilməlidir? Yoxla.

---

## Notifications Module

- `GetUnreadCountQuery` — user-ə aid (self) olmalıdır
- `SendNotificationCommand` — system-level, OK
- `MarkNotificationAsReadCommand` — user-ə aid (self)
- `MarkAllNotificationsAsReadCommand` — user-ə aid (self)

---

## Search Module

- `SearchMessagesQuery` — companyId filteri olmalıdır. Yoxla ki, axtarış nəticəsində yalnız user-in üzv olduğu channel/conversation-ların mesajları görünsün.

---

## Settings Module

- `UpdateDisplaySettingsCommand` — user-ə aid (self)
- `UpdateNotificationSettingsCommand` — user-ə aid (self)
- `UpdatePrivacySettingsCommand` — user-ə aid (self)

---

## Ümumi Qayda

Hər handler-ı yoxlayarkən bu qaydaya əməl et:

| Data növü | Yoxlama | SuperAdmin |
|-----------|---------|------------|
| Company data (CRUD) | `Authorize(Roles = "SuperAdmin")` | Hamısını görür |
| Department/Position | `callerCompanyId == entity.CompanyId` | Hamısını görür |
| User data | `callerCompanyId == user.CompanyId` | Hamısını görür |
| Channel | `callerCompanyId == channel.CompanyId` | Hamısını görür |
| Conversation | participant check (user conversation-da olmalıdır) | Hamısını görür |
| Message | member/participant check | Hamısını görür |
| Own data (settings, favorites) | `userId == callerId` | Yalnız öz data-sı |
| File | uploader check + company check | Hamısını görür |

---

## Test Ssenarisi

1. Admin (Company A) → public channel-lar sorğula → yalnız Company A channel-ları görünsün
2. Admin (Company A) → channel axtarışı → yalnız Company A channel-ları tapılsın
3. Admin (Company A) → Company B-nin public channel-ına qoşulmağa çalışsın → rədd edilsin
4. Admin → `GET /api/companies` → 403 Forbidden (yalnız SuperAdmin görə bilər)
5. Admin → `DELETE /api/companies/{id}` → 403 Forbidden
6. SuperAdmin → bütün yuxarıdakılar işləsin (restriction yoxdur)
7. User (Company A) → fərqli company-nin conversation/channel mesajlarına çatmağa çalışsın → rədd edilsin
8. User → başqa user-in favorites/settings-inə çatmağa çalışsın → rədd edilsin
