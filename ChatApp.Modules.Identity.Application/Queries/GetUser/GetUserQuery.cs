using ChatApp.Modules.Identity.Application.DTOs.Responses;
using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Modules.Identity.Domain.Entities;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Queries.GetUser
{
    public record GetUserQuery(
        Guid UserId,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false) : IRequest<Result<UserDetailDto?>>;

    public class GetUserQueryHandler(
        IUnitOfWork unitOfWork,
        ILogger<GetUserQueryHandler> logger) : IRequestHandler<GetUserQuery, Result<UserDetailDto?>>
    {
        public async Task<Result<UserDetailDto?>> Handle(
            GetUserQuery query,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var user = await unitOfWork.Users
                    .Include(u => u.UserPermissions)
                    .Include(u => u.Employee!.Position)
                    .Include(u => u.Employee!.Department).ThenInclude(d => d!.HeadOfDepartment)
                    // Supervisors — many-to-many
                    .Include(u => u.Employee!.SupervisorLinks)
                        .ThenInclude(sl => sl.SupervisorEmployee)
                            .ThenInclude(se => se.User)
                    .Include(u => u.Employee!.SupervisorLinks)
                        .ThenInclude(sl => sl.SupervisorEmployee)
                            .ThenInclude(se => se.Position)
                    // Subordinates — many-to-many
                    .Include(u => u.Employee!.SubordinateLinks)
                        .ThenInclude(sl => sl.Employee)
                            .ThenInclude(e => e.User)
                    .Include(u => u.Employee!.SubordinateLinks)
                        .ThenInclude(sl => sl.Employee)
                            .ThenInclude(e => e.Position)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == query.UserId, cancellationToken);

                if (user is null)
                {
                    logger?.LogWarning("User {UserId} not found", query.UserId);
                    return Result.Success<UserDetailDto?>(null);
                }

                if (!query.IsSuperAdmin && query.CallerCompanyId.HasValue && user.CompanyId != query.CallerCompanyId)
                    return Result.Success<UserDetailDto?>(null); // Başqa şirkətin istifadəçisi görünmür

                return Result.Success<UserDetailDto?>(MapToDetailDto(user));
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error retrieving user {UserId}", query.UserId);
                return Result.Failure<UserDetailDto?>("An error occurred while retrieving the user");
            }
        }

        private static UserDetailDto MapToDetailDto(User user)
        {
            var permissions = user.UserPermissions
                .Select(up => up.PermissionName)
                .ToList();

            var supervisors = user.Employee?.SupervisorLinks
                .Select(sl => new SupervisorDto(
                    sl.SupervisorEmployee.UserId,
                    sl.SupervisorEmployee.User?.FullName ?? "Unknown",
                    FileUrlHelper.ToAvatarUrl(sl.SupervisorEmployee.User?.AvatarUrl),
                    sl.SupervisorEmployee.Position?.Name,
                    sl.AssignedAtUtc))
                .ToList() ?? [];

            var subordinates = user.Employee?.SubordinateLinks
                .Select(sl => new SubordinateDto(
                    sl.Employee.UserId,
                    sl.Employee.User?.FullName ?? "Unknown",
                    sl.Employee.Position?.Name,
                    FileUrlHelper.ToAvatarUrl(sl.Employee.User?.AvatarUrl),
                    sl.Employee.User?.IsActive ?? false))
                .ToList() ?? [];

            var isHeadOfDepartment = user.Employee?.DepartmentId.HasValue == true &&
                user.Employee.Department?.HeadOfDepartmentId == user.Id;

            return new UserDetailDto(
                user.Id,
                user.FirstName,
                user.LastName,
                user.Email,
                user.Role.ToString(),
                user.CompanyId,
                user.Employee?.Position?.Name,
                user.Employee?.PositionId,
                FileUrlHelper.ToAvatarUrl(user.AvatarUrl),
                user.Employee?.AboutMe,
                user.Employee?.DateOfBirth,
                user.Employee?.WorkPhone,
                user.Employee?.HiringDate,
                user.LastVisit,
                user.IsActive,
                user.Employee?.DepartmentId,
                user.Employee?.Department?.Name,
                supervisors,
                isHeadOfDepartment,
                user.Employee?.Department?.HeadOfDepartment?.FullName,
                subordinates,
                permissions,
                user.CreatedAtUtc,
                user.UpdatedAtUtc,
                user.PasswordChangedAt);
        }
    }
}
