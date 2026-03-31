using ChatApp.Modules.Identity.Application.DTOs.Responses;
using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Queries.GetUsers
{
    /// <summary>
    /// Səhifələnmiş istifadəçi siyahısı — company scoped.
    /// SuperAdmin bütün şirkətləri görür, Admin/User yalnız öz şirkətlərini.
    /// </summary>
    public record GetUsersQuery(
        int PageNumber,
        int PageSize,
        Guid? CompanyId = null,
        bool IsSuperAdmin = false
    ) : IRequest<Result<List<UserListItemDto>>>;

    public class GetUsersQueryHandler(
        IUnitOfWork unitOfWork,
        ILogger<GetUsersQueryHandler> logger) : IRequestHandler<GetUsersQuery, Result<List<UserListItemDto>>>
    {
        private const int MaxPageSize = 100;

        public async Task<Result<List<UserListItemDto>>> Handle(
            GetUsersQuery query,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var pageSize = Math.Min(query.PageSize, MaxPageSize);
                var skip = (query.PageNumber - 1) * pageSize;

                var usersQuery = unitOfWork.Users.AsQueryable();

                // Company scoping — SuperAdmin bütün şirkətləri görür
                if (!query.IsSuperAdmin && query.CompanyId.HasValue)
                    usersQuery = usersQuery.Where(u => u.CompanyId == query.CompanyId);

                var users = await usersQuery
                    .OrderByDescending(u => u.CreatedAtUtc)
                    .Skip(skip)
                    .Take(pageSize)
                    .Select(u => new UserListItemDto(
                        u.Id,
                        u.FirstName,
                        u.LastName,
                        u.Email,
                        u.Role.ToString(),
                        u.Employee != null && u.Employee.Position != null ? u.Employee.Position.Name : null,
                        u.AvatarUrl,
                        u.IsActive,
                        u.Employee != null && u.Employee.Department != null ? u.Employee.Department.Name : null,
                        u.CreatedAtUtc))
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                var result = users.Select(u => u with { AvatarUrl = FileUrlHelper.ToAvatarUrl(u.AvatarUrl) }).ToList();
                return Result.Success(result);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error retrieving users page {PageNumber}", query.PageNumber);
                return Result.Failure<List<UserListItemDto>>("An error occurred while retrieving users");
            }
        }
    }
}