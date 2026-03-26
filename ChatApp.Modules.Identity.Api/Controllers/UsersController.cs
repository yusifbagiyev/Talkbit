using ChatApp.Modules.Identity.Application.Commands.Employees;
using ChatApp.Modules.Identity.Application.Commands.Users;
using ChatApp.Modules.Identity.Application.DTOs.Requests;
using ChatApp.Modules.Identity.Application.DTOs.Responses;
using ChatApp.Modules.Identity.Application.Queries.GetUser;
using ChatApp.Modules.Identity.Application.Queries.GetUsers;
using ChatApp.Modules.Identity.Application.Queries.SearchUsers;
using ChatApp.Shared.Infrastructure.Authorization;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Security.Claims;

namespace ChatApp.Modules.Identity.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly IMediator _mediator;
        private readonly ILogger<UsersController> _logger;

        public UsersController(
            IMediator mediator,
            ILogger<UsersController> logger)
        {
            _mediator = mediator;
            _logger = logger;
        }


        /// <summary>
        /// Creates a new user in the system
        /// </summary>
        [HttpPost]
        [RequirePermission("Users.Create")]
        [ProducesResponseType(typeof(Guid), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> CreateUser(
            [FromBody] CreateUserRequest request,
            CancellationToken cancellationToken)
        {
            var creatorId = GetCurrentUserId();
            if (creatorId == Guid.Empty)
                return Unauthorized();

            var (callerCompanyId, _) = GetCompanyClaims();

            var command = new CreateUserCommand(
                request.FirstName,
                request.LastName,
                request.Email,
                request.Password,
                request.Role,
                request.DepartmentId,
                request.PositionId,
                request.AvatarUrl,
                request.AboutMe,
                request.DateOfBirth,
                request.WorkPhone,
                request.HiringDate,
                CallerCompanyId: callerCompanyId);

            var result = await _mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return CreatedAtAction(
                nameof(GetUserById),
                new { userId = result.Value },
                new { userId = result.Value, message = "User created successfully" });
        }


        /// <summary>
        /// Searches users by full name
        /// </summary>
        [HttpGet("search")]
        [ProducesResponseType(typeof(List<UserSearchResultDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> SearchUsers(
            [FromQuery(Name = "q")] string searchTerm,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(searchTerm) || searchTerm.Length < 2)
                return Ok(new List<UserSearchResultDto>());

            var (companyId, isSuperAdmin) = GetCompanyClaims();

            var result = await _mediator.Send(
                new SearchUsersQuery(searchTerm, companyId, isSuperAdmin), cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            var currentUserId = GetCurrentUserId();
            var filteredUsers = result.Value?.Where(u => u.Id != currentUserId).ToList() ?? new List<UserSearchResultDto>();

            return Ok(filteredUsers);
        }


        /// <summary>
        /// Returns paginated list of department colleagues for conversation sidebar.
        /// Normal users see only their department. Admin/SuperAdmin see all users.
        /// </summary>
        [HttpGet("department-users")]
        [ProducesResponseType(typeof(PagedResult<DepartmentUserDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> GetDepartmentUsers(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? search = null,
            CancellationToken cancellationToken = default)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new GetDepartmentUsersQuery(userId, pageNumber, pageSize, search),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }

        /// <summary>
        /// Gets the current authenticated user's profile information
        /// </summary>
        [HttpGet("me")]
        [ProducesResponseType(typeof(UserDetailDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> GetCurrentUser(CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            _logger?.LogInformation("User {UserId} retrieving their own profile", userId);

            var result = await _mediator.Send(new GetCurrentUserQuery(userId), cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            if (result.Value == null)
                return NotFound(new { error = "Your profile was not found" });

            return Ok(result.Value);
        }


        /// <summary>
        /// Updates the current authenticated user's own profile
        /// </summary>
        [HttpPut("me")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> UpdateCurrentUser(
            [FromBody] UpdateUserRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var command = new UpdateUserCommand(
                userId,
                request.FirstName,
                request.LastName,
                request.Email,
                request.Role,
                request.PositionId,
                request.AvatarUrl,
                request.AboutMe,
                request.DateOfBirth,
                request.WorkPhone,
                request.HiringDate);

            var result = await _mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Profile updated successfully" });
        }


        /// <summary>
        /// Changes the current user's own password
        /// </summary>
        [HttpPut("me/change-password")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> ChangePassword(
            [FromBody] ChangePasswordRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var command = new ChangePasswordCommand(
                userId,
                request.CurrentPassword,
                request.NewPassword,
                request.ConfirmNewPassword);

            var result = await _mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Password changed successfully" });
        }


        /// <summary>
        /// Admin changes another user's password
        /// </summary>
        [HttpPut("change-user-password")]
        [RequirePermission("Users.Update")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> ChangeUserPassword(
            [FromBody] AdminChangePasswordRequest request,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var command = new AdminChangePasswordCommand(
                request.Id,
                request.NewPassword,
                request.ConfirmNewPassword,
                callerCompanyId,
                isSuperAdmin);

            var result = await _mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Password changed successfully" });
        }


        /// <summary>
        /// Retrieves a specific user by their unique identifier
        /// </summary>
        [HttpGet("{userId:guid}")]
        [RequirePermission("Users.Read")]
        [ProducesResponseType(typeof(UserDetailDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetUserById(
            [FromRoute] Guid userId,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var result = await _mediator.Send(
                new GetUserQuery(userId, callerCompanyId, isSuperAdmin), cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            if (result.Value == null)
                return NotFound(new { error = $"User with ID {userId} not found" });

            return Ok(result.Value);
        }


        /// <summary>
        /// Retrieves a paginated list of all users
        /// </summary>
        [HttpGet]
        [RequirePermission("Users.Read")]
        [ProducesResponseType(typeof(List<UserListItemDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetUsers(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            CancellationToken cancellationToken = default)
        {
            if (pageNumber < 1 || pageSize < 1 || pageSize > 100)
                return BadRequest(new { error = "Invalid pagination parameters. PageNumber must be >= 1 and PageSize must be between 1 and 100" });

            var (companyId, isSuperAdmin) = GetCompanyClaims();

            var result = await _mediator.Send(
                new GetUsersQuery(pageNumber, pageSize, companyId, isSuperAdmin),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }


        /// <summary>
        /// Updates an existing user's information
        /// </summary>
        [HttpPut("{userId:guid}")]
        [RequirePermission("Users.Update")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> UpdateUser(
            [FromRoute] Guid userId,
            [FromBody] UpdateUserRequest request,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var command = new UpdateUserCommand(
                userId,
                request.FirstName,
                request.LastName,
                request.Email,
                request.Role,
                request.PositionId,
                request.AvatarUrl,
                request.AboutMe,
                request.DateOfBirth,
                request.WorkPhone,
                request.HiringDate,
                callerCompanyId,
                isSuperAdmin);

            var result = await _mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "User updated successfully" });
        }


        [HttpPut("{userId:guid}/activate")]
        [RequirePermission("Users.Update")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> ActivateUser(
            [FromRoute] Guid userId,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var command = new ActivateUserCommand(userId, callerCompanyId, isSuperAdmin);
            var result = await _mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "User activated successfully" });
        }


        [HttpPut("{userId:guid}/deactivate")]
        [RequirePermission("Users.Update")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> DeactivateUser(
            [FromRoute] Guid userId,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var command = new DeactivateUserCommand(userId, callerCompanyId, isSuperAdmin);
            var result = await _mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "User deactivated successfully" });
        }


        /// <summary>
        /// Soft deletes a user by deactivating their account
        /// </summary>
        [HttpDelete("{userId:guid}")]
        [RequirePermission("Users.Delete")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> DeleteUser(
            [FromRoute] Guid userId,
            CancellationToken cancellationToken)
        {
            _logger?.LogInformation("Deleting user: {UserId}", userId);

            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var result = await _mediator.Send(
                new DeleteUserCommand(userId, callerCompanyId, isSuperAdmin), cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "User deleted successfully" });
        }


        /// <summary>
        /// Assigns a permission to a user
        /// </summary>
        [HttpPost("{userId:guid}/permissions")]
        [RequirePermission("Permissions.Assign")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> AssignPermissionToUser(
            [FromRoute] Guid userId,
            [FromBody] AssignPermissionToUserRequest request,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var command = new AssignPermissionToUserCommand(userId, request.PermissionName, callerCompanyId, isSuperAdmin);
            var result = await _mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Permission assigned successfully" });
        }


        /// <summary>
        /// Removes a permission from a user
        /// </summary>
        [HttpDelete("{userId:guid}/permissions/{permissionName}")]
        [RequirePermission("Permissions.Revoke")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> RemovePermissionFromUser(
            [FromRoute] Guid userId,
            [FromRoute] string permissionName,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var command = new RemovePermissionFromUserCommand(userId, permissionName, callerCompanyId, isSuperAdmin);
            var result = await _mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Permission removed successfully" });
        }


        /// <summary>
        /// Assigns an employee to a department
        /// </summary>
        [HttpPost("{userId:guid}/department")]
        [RequirePermission("Users.Update")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> AssignEmployeeToDepartment(
            [FromRoute] Guid userId,
            [FromBody] AssignEmployeeToDepartmentRequest request,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var command = new AssignEmployeeToDepartmentCommand(
                userId,
                request.DepartmentId,
                request.SupervisorId,
                request.HeadOfDepartmentId,
                callerCompanyId,
                isSuperAdmin);

            var result = await _mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Employee assigned to department successfully" });
        }


        /// <summary>
        /// Removes an employee from their department
        /// </summary>
        [HttpDelete("{userId:guid}/department")]
        [RequirePermission("Users.Update")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> RemoveEmployeeFromDepartment(
            [FromRoute] Guid userId,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var command = new RemoveEmployeeFromDepartmentCommand(userId, callerCompanyId, isSuperAdmin);
            var result = await _mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Employee removed from department successfully" });
        }


        /// <summary>
        /// Assigns a supervisor to an employee
        /// </summary>
        [HttpPost("{userId:guid}/supervisor")]
        [RequirePermission("Users.Update")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> AssignSupervisorToEmployee(
            [FromRoute] Guid userId,
            [FromBody] AssignSupervisorToEmployeeRequest request,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var command = new AssignSupervisorToEmployeeCommand(userId, request.SupervisorId, callerCompanyId, isSuperAdmin);
            var result = await _mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Supervisor assigned successfully" });
        }


        /// <summary>
        /// Removes a supervisor from an employee
        /// </summary>
        [HttpDelete("{userId:guid}/supervisors/{supervisorId:guid}")]
        [RequirePermission("Users.Update")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> RemoveSupervisorFromEmployee(
            [FromRoute] Guid userId,
            [FromRoute] Guid supervisorId,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var command = new RemoveSupervisorFromEmployeeCommand(userId, supervisorId, callerCompanyId, isSuperAdmin);
            var result = await _mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Supervisor removed successfully" });
        }


        private (Guid? companyId, bool isSuperAdmin) GetCompanyClaims()
        {
            var companyId = Guid.TryParse(GetClaimValue("companyId"), out var cid) ? cid : (Guid?)null;
            var isSuperAdmin = GetClaimValue("role") == "SuperAdmin";
            return (companyId, isSuperAdmin);
        }

        private Guid GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
                return Guid.Empty;
            return userId;
        }

        private string? GetClaimValue(string claimType) =>
            User.FindFirst(claimType)?.Value;
    }
}
