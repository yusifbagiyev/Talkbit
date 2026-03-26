using ChatApp.Modules.Identity.Application.Commands.Positions;
using ChatApp.Modules.Identity.Application.DTOs.Requests;
using ChatApp.Modules.Identity.Application.Queries.GetPositions;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.Modules.Identity.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/identity/positions")]
    public class PositionsController(IMediator mediator) : ControllerBase
    {
        /// <summary>
        /// Get all positions
        /// </summary>
        [HttpGet]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> GetAllPositions(CancellationToken cancellationToken)
        {
            var (companyId, isSuperAdmin) = GetCompanyClaims();

            var query = new GetAllPositionsQuery(companyId, isSuperAdmin);
            var result = await mediator.Send(query, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }

        /// <summary>
        /// Get positions by department ID
        /// </summary>
        [HttpGet("department/{departmentId:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetPositionsByDepartment(
            [FromRoute] Guid departmentId,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var query = new GetPositionsByDepartmentQuery(departmentId, callerCompanyId, isSuperAdmin);
            var result = await mediator.Send(query, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }

        /// <summary>
        /// Create a new position
        /// </summary>
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> CreatePosition(
            [FromBody] CreatePositionRequest request,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var command = new CreatePositionCommand(
                request.Name,
                request.DepartmentId,
                request.Description,
                callerCompanyId,
                isSuperAdmin);

            var result = await mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return CreatedAtAction(
                nameof(GetAllPositions),
                new { id = result.Value },
                new { id = result.Value });
        }

        /// <summary>
        /// Update a position
        /// </summary>
        [HttpPut("{positionId:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> UpdatePosition(
            [FromRoute] Guid positionId,
            [FromBody] UpdatePositionRequest request,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var command = new UpdatePositionCommand(
                positionId,
                request.Name,
                request.DepartmentId,
                request.Description,
                callerCompanyId,
                isSuperAdmin);

            var result = await mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Position updated successfully" });
        }

        /// <summary>
        /// Delete a position
        /// </summary>
        [HttpDelete("{positionId:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeletePosition(
            [FromRoute] Guid positionId,
            CancellationToken cancellationToken)
        {
            var (callerCompanyId, isSuperAdmin) = GetCompanyClaims();

            var command = new DeletePositionCommand(positionId, callerCompanyId, isSuperAdmin);
            var result = await mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Position deleted successfully" });
        }

        private (Guid? companyId, bool isSuperAdmin) GetCompanyClaims()
        {
            var companyId = Guid.TryParse(User.FindFirst("companyId")?.Value, out var cid) ? cid : (Guid?)null;
            var isSuperAdmin = User.FindFirst("role")?.Value == "SuperAdmin";
            return (companyId, isSuperAdmin);
        }
    }
}
