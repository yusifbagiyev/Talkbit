using ChatApp.Modules.Identity.Application.Commands.Companies;
using ChatApp.Modules.Identity.Application.Queries.Companies;
using ChatApp.Shared.Infrastructure.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.Modules.Identity.Api.Controllers
{
    /// <summary>
    /// Şirkət idarəetməsi — yalnız SuperAdmin əməliyyatları.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/companies")]
    public class CompaniesController(IMediator mediator) : ControllerBase
    {
        /// <summary>
        /// Get all companies (paginated, SuperAdmin only)
        /// </summary>
        [HttpGet]
        [RequirePermission("Companies.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        public async Task<IActionResult> GetAllCompanies(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? searchTerm = null,
            [FromQuery] bool? isActive = null,
            CancellationToken cancellationToken = default)
        {
            var query = new GetAllCompaniesQuery(pageNumber, pageSize, searchTerm, isActive);
            var result = await mediator.Send(query, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }

        /// <summary>
        /// Get company by ID (SuperAdmin + own company Admin)
        /// </summary>
        [HttpGet("{id:guid}")]
        [RequirePermission("Companies.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetCompanyById(Guid id, CancellationToken cancellationToken)
        {
            var callerCompanyId = Guid.TryParse(User.FindFirst("companyId")?.Value, out var cid) ? cid : (Guid?)null;
            var isSuperAdmin = User.FindFirst("role")?.Value == "SuperAdmin";

            var query = new GetCompanyByIdQuery(id, callerCompanyId, isSuperAdmin);
            var result = await mediator.Send(query, cancellationToken);

            if (result.IsFailure)
                return NotFound(new { error = result.Error });

            return Ok(result.Value);
        }

        /// <summary>
        /// Create a new company (SuperAdmin only)
        /// </summary>
        [HttpPost]
        [RequirePermission("Companies.Create")]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> CreateCompany(
            [FromBody] CreateCompanyCommand command,
            CancellationToken cancellationToken)
        {
            var result = await mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return CreatedAtAction(nameof(GetCompanyById), new { id = result.Value }, new { id = result.Value });
        }

        /// <summary>
        /// Update company details (SuperAdmin only)
        /// </summary>
        [HttpPut("{id:guid}")]
        [RequirePermission("Companies.Update")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> UpdateCompany(
            Guid id,
            [FromBody] UpdateCompanyRequest request,
            CancellationToken cancellationToken)
        {
            var command = new UpdateCompanyCommand(id, request.Name, request.LogoUrl, request.Description);
            var result = await mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return NoContent();
        }

        /// <summary>
        /// Soft delete (deactivate) a company (SuperAdmin only)
        /// </summary>
        [HttpDelete("{id:guid}")]
        [RequirePermission("Companies.Delete")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeleteCompany(Guid id, CancellationToken cancellationToken)
        {
            var command = new DeleteCompanyCommand(id);
            var result = await mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return NotFound(new { error = result.Error });

            return NoContent();
        }

        /// <summary>
        /// Assign an admin to a company (SuperAdmin only)
        /// </summary>
        [HttpPost("{id:guid}/admin")]
        [RequirePermission("Companies.Update")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> AssignCompanyAdmin(
            Guid id,
            [FromBody] AssignCompanyAdminRequest request,
            CancellationToken cancellationToken)
        {
            var command = new AssignCompanyAdminCommand(id, request.UserId);
            var result = await mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return NoContent();
        }
    }

    // Request models (controller-ə gələn body-lər)
    public record UpdateCompanyRequest(string Name, string? LogoUrl, string? Description);
    public record AssignCompanyAdminRequest(Guid UserId);
}
