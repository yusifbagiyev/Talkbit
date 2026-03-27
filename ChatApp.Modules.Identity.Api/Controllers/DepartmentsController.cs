using ChatApp.Modules.Identity.Application.Commands.Departments;
using ChatApp.Modules.Identity.Application.DTOs.Requests;
using ChatApp.Modules.Identity.Application.DTOs.Responses;
using ChatApp.Modules.Identity.Application.Queries.Departments;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ChatApp.Modules.Identity.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/identity/departments")]
    public class DepartmentsController(IMediator mediator) : ControllerBase
    {
        /// <summary>
        /// Get all departments
        /// </summary>
        [HttpGet]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> GetAllDepartments(
            [FromQuery] Guid? companyId = null,
            CancellationToken cancellationToken = default)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            // SuperAdmin spesifik şirkəti filter edə bilər; Admin öz şirkətini görür
            var effectiveCompanyId = isSuperAdmin && companyId.HasValue ? companyId : callerCompanyId;

            var query = new GetAllDepartmentsQuery(effectiveCompanyId, isSuperAdmin && !companyId.HasValue);
            var result = await mediator.Send(query, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }

        /// <summary>
        /// Get department by ID
        /// </summary>
        [HttpGet("{departmentId:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetDepartmentById(
            [FromRoute] Guid departmentId,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var query = new GetDepartmentByIdQuery(departmentId, callerCompanyId, isSuperAdmin);
            var result = await mediator.Send(query, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            if (result.Value == null)
                return NotFound(new { error = $"Department with ID {departmentId} not found" });

            return Ok(result.Value);
        }

        /// <summary>
        /// Create a new department
        /// </summary>
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> CreateDepartment(
            [FromBody] CreateDepartmentRequest request,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            // SuperAdmin üçün request body-dən companyId götür; Admin üçün JWT-dən
            var effectiveCompanyId = isSuperAdmin ? request.CompanyId : callerCompanyId;

            var command = new CreateDepartmentCommand(
                request.Name,
                effectiveCompanyId,
                request.ParentDepartmentId,
                request.AvatarUrl);

            var result = await mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            var response = new CreateDepartmentResponse(result.Value);

            return CreatedAtAction(
                nameof(GetDepartmentById),
                new { departmentId = result.Value },
                response);
        }

        /// <summary>
        /// Update a department
        /// </summary>
        [HttpPut("{departmentId:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> UpdateDepartment(
            [FromRoute] Guid departmentId,
            [FromBody] UpdateDepartmentRequest request,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var command = new UpdateDepartmentCommand(
                departmentId,
                request.Name,
                request.ParentDepartmentId,
                callerCompanyId,
                isSuperAdmin,
                request.AvatarUrl);

            var result = await mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Department updated successfully" });
        }

        /// <summary>
        /// Delete a department
        /// </summary>
        [HttpDelete("{departmentId:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeleteDepartment(
            [FromRoute] Guid departmentId,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var command = new DeleteDepartmentCommand(departmentId, callerCompanyId, isSuperAdmin);
            var result = await mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Department deleted successfully" });
        }

        /// <summary>
        /// Assign a user as department head
        /// </summary>
        [HttpPost("{departmentId:guid}/assign-head")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> AssignDepartmentHead(
            [FromRoute] Guid departmentId,
            [FromBody] AssignDepartmentHeadRequest request,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var command = new AssignDepartmentHeadCommand(departmentId, request.UserId, callerCompanyId, isSuperAdmin);
            var result = await mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Department head assigned successfully" });
        }

        /// <summary>
        /// Remove department head
        /// </summary>
        [HttpDelete("{departmentId:guid}/remove-head")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> RemoveDepartmentHead(
            [FromRoute] Guid departmentId,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var command = new RemoveDepartmentHeadCommand(departmentId, callerCompanyId, isSuperAdmin);
            var result = await mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Department head removed successfully" });
        }

        private (Guid? companyId, bool isSuperAdmin) GetCompanyClaims()
        {
            var companyId = Guid.TryParse(User.FindFirst("companyId")?.Value, out var cid) ? cid : (Guid?)null;
            var isSuperAdmin = User.FindFirst(ClaimTypes.Role)?.Value == "SuperAdmin";
            return (companyId, isSuperAdmin);
        }
    }
}
