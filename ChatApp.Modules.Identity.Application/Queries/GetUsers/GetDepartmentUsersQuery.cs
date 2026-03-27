using ChatApp.Modules.Identity.Application.DTOs.Responses;
using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Modules.Identity.Domain.Enums;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Queries.GetUsers;

/// <summary>
/// Returns paginated list of department colleagues for conversation sidebar.
///
/// VISIBILITY RULES:
/// 1. User has no department (e.g., CEO) → sees ALL users
/// 2. User has department → sees entire department tree from root ancestor down:
///    - Find the ROOT ancestor of user's department
///    - Get ALL descendants of that root (entire branch)
/// 3. Admin/SuperAdmin → sees ALL users
///
/// Example structure:
///   Engineering (root)
///     ├── Backend
///     ├── Frontend
///     └── DevOps
///   Finance (root)
///     └── Accounting
///
/// - DevOps employee sees: Engineering + Backend + Frontend + DevOps (entire Engineering tree)
/// - Accounting employee sees: Finance + Accounting (entire Finance tree)
/// - Finance head (Leyla) sees: Finance + Accounting (NOT Engineering - different tree)
/// - CEO (no department) sees: ALL users
/// </summary>
public record GetDepartmentUsersQuery(
    Guid CurrentUserId,
    int PageNumber,
    int PageSize,
    string? SearchTerm,
    List<Guid>? ExcludeUserIds = null,
    int? SkipOverride = null  // Optional: override calculated skip for unified pagination
) : IRequest<Result<PagedResult<DepartmentUserDto>>>;

public class GetDepartmentUsersQueryHandler(
    IUnitOfWork unitOfWork,
    ILogger<GetDepartmentUsersQueryHandler> logger)
    : IRequestHandler<GetDepartmentUsersQuery, Result<PagedResult<DepartmentUserDto>>>
{
    private const int MaxPageSize = 50;

    public async Task<Result<PagedResult<DepartmentUserDto>>> Handle(
        GetDepartmentUsersQuery query,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var pageSize = Math.Min(query.PageSize, MaxPageSize);
            var skip = query.SkipOverride ?? (query.PageNumber - 1) * pageSize;

            // Get current user with employee info
            var currentUser = await unitOfWork.Users
                .Include(u => u.Employee)
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == query.CurrentUserId, cancellationToken);

            if (currentUser == null)
                return Result.Failure<PagedResult<DepartmentUserDto>>("User not found");

            // Build base query: active users, exclude self
            var usersQuery = unitOfWork.Users
                .Where(u => u.IsActive && u.Id != query.CurrentUserId);

            // COMPANY SCOPING — SuperAdmin bütün şirkətləri görür, digərləri yalnız öz şirkətlərini
            if (currentUser.Role != Role.SuperAdmin && currentUser.CompanyId.HasValue)
            {
                usersQuery = usersQuery.Where(u => u.CompanyId == currentUser.CompanyId);
            }

            // Exclude users who already have conversations
            if (query.ExcludeUserIds is { Count: > 0 })
            {
                usersQuery = usersQuery.Where(u => !query.ExcludeUserIds.Contains(u.Id));
            }

            // DEPARTMENT AUTHORIZATION LOGIC
            var departmentId = currentUser.Employee?.DepartmentId;

            // If user has no department (like CEO) OR is Admin/SuperAdmin → see all users in company
            if (departmentId == null || currentUser.Role >= Role.Admin)
            {
                // No department filter - see everyone (within company scope)
            }
            else
            {
                // Şirkətin bütün departamentlərini tək sorğu ilə yüklə, in-memory traverse et
                var allDepts = await unitOfWork.Departments
                    .Where(d => d.CompanyId == currentUser.CompanyId!.Value)
                    .Select(d => new { d.Id, d.ParentDepartmentId })
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                // Root ancestor — in-memory, N sorğu yox
                var deptLookup = allDepts.ToDictionary(d => d.Id, d => d.ParentDepartmentId);
                var rootId = departmentId.Value;
                while (deptLookup.TryGetValue(rootId, out var parentId) && parentId.HasValue)
                    rootId = parentId.Value;

                // BFS ilə bütün nəsil departamentlər — in-memory
                var childrenByParent = allDepts
                    .Where(d => d.ParentDepartmentId.HasValue)
                    .GroupBy(d => d.ParentDepartmentId!.Value)
                    .ToDictionary(g => g.Key, g => g.Select(d => d.Id).ToList());

                var visibleDepartmentIds = new HashSet<Guid> { rootId };
                var bfsQueue = new Queue<Guid>();
                bfsQueue.Enqueue(rootId);
                while (bfsQueue.Count > 0)
                {
                    var current = bfsQueue.Dequeue();
                    if (!childrenByParent.TryGetValue(current, out var children)) continue;
                    foreach (var child in children)
                    {
                        visibleDepartmentIds.Add(child);
                        bfsQueue.Enqueue(child);
                    }
                }

                usersQuery = usersQuery.Where(u =>
                    u.Employee != null && u.Employee.DepartmentId != null &&
                    visibleDepartmentIds.Contains(u.Employee.DepartmentId.Value));
            }

            // Search filter
            if (!string.IsNullOrWhiteSpace(query.SearchTerm) && query.SearchTerm.Length >= 2)
            {
                var term = query.SearchTerm.ToLower();
                usersQuery = usersQuery.Where(u =>
                    u.FirstName.ToLower().Contains(term) ||
                    u.LastName.ToLower().Contains(term) ||
                    u.Email.ToLower().Contains(term));
            }

            // Get total count
            var totalCount = await usersQuery.CountAsync(cancellationToken);

            // Get paginated results
            var users = await usersQuery
                .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
                .Skip(skip)
                .Take(pageSize)
                .Select(u => new DepartmentUserDto(
                    u.Id,
                    u.FirstName + " " + u.LastName,
                    u.Email,
                    u.AvatarUrl,
                    u.Employee != null && u.Employee.Position != null ? u.Employee.Position.Name : null,
                    u.Employee != null ? u.Employee.DepartmentId : null,
                    u.Employee != null && u.Employee.Department != null ? u.Employee.Department.Name : null
                ))
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            return Result.Success(PagedResult<DepartmentUserDto>.Create(users, query.PageNumber, pageSize, totalCount));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error retrieving department users for user {UserId}", query.CurrentUserId);
            return Result.Failure<PagedResult<DepartmentUserDto>>("An error occurred while retrieving department users");
        }
    }

}
