using ChatApp.Modules.Identity.Application.DTOs.Responses;
using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Queries.GetUser
{
    public record GetCurrentUserQuery(Guid UserId) : IRequest<Result<UserDetailDto?>>;

    public class GetCurrentUserQueryHandler(
        IUnitOfWork unitOfWork,
        ILogger<GetCurrentUserQueryHandler> logger) : IRequestHandler<GetCurrentUserQuery, Result<UserDetailDto?>>
    {
        public async Task<Result<UserDetailDto?>> Handle(
            GetCurrentUserQuery request,
            CancellationToken cancellationToken)
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
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);

                if (user is null)
                {
                    logger?.LogWarning("User {UserId} not found", request.UserId);
                    return Result.Success<UserDetailDto?>(null);
                }

                return Result.Success<UserDetailDto?>(MapToDetailDto(user));
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error retrieving current user information for user {UserId}", request.UserId);
                return Result.Failure<UserDetailDto?>("An error occurred while retrieving your profile information");
            }
        }

        private static UserDetailDto MapToDetailDto(Domain.Entities.User user)
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
                [], // Cari istifadəçi üçün tabelilər göstərilmir
                permissions,
                user.CreatedAtUtc,
                user.UpdatedAtUtc,
                user.PasswordChangedAt);
        }
    }
}
