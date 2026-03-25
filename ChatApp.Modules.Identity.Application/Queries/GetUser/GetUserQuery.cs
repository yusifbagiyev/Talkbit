using ChatApp.Modules.Identity.Application.DTOs.Responses;
using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Modules.Identity.Domain.Entities;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Queries.GetUser
{
    public record GetUserQuery(Guid UserId) : IRequest<Result<UserDetailDto?>>;

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
                    .Include(u => u.Employee!.Supervisor!.User)
                    .Include(u => u.Employee!.Supervisor!.Position)
                    .Include(u => u.Employee!.Subordinates).ThenInclude(s => s.User)
                    .Include(u => u.Employee!.Subordinates).ThenInclude(s => s.Position)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == query.UserId, cancellationToken);

                if (user is null)
                {
                    logger?.LogWarning("User {UserId} not found", query.UserId);
                    return Result.Success<UserDetailDto?>(null);
                }

                var userDto = MapToDetailDto(user);

                return Result.Success<UserDetailDto?>(userDto);
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

            var subordinates = user.Employee?.Subordinates?
                .Select(s => new SubordinateDto(
                    s.UserId,
                    s.User?.FullName ?? "Unknown",
                    s.Position?.Name,
                    s.User?.AvatarUrl,
                    s.User?.IsActive ?? false))
                .ToList() ?? [];

            var isHeadOfDepartment = user.Employee?.DepartmentId.HasValue == true &&
                user.Employee.Department?.HeadOfDepartmentId == user.Id;

            return new UserDetailDto(
                user.Id,
                user.FirstName,
                user.LastName,
                user.Email,
                user.Role.ToString(),
                user.Employee?.Position?.Name,
                user.Employee?.PositionId,
                user.AvatarUrl,
                user.Employee?.AboutMe,
                user.Employee?.DateOfBirth,
                user.Employee?.WorkPhone,
                user.Employee?.HiringDate,
                user.LastVisit,
                user.IsActive,
                user.Employee?.DepartmentId,
                user.Employee?.Department?.Name,
                user.Employee?.Supervisor?.UserId,
                user.Employee?.Supervisor?.User?.FullName,
                user.Employee?.Supervisor?.User?.AvatarUrl,
                user.Employee?.Supervisor?.Position?.Name,
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