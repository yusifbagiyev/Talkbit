using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Domain.Enums;
using ChatApp.Shared.Kernel.Common;
using ChatApp.Shared.Kernel.Exceptions;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Commands.ChannelMembers
{
    public record UpdateMemberRoleCommand(
        Guid ChannelId,
        Guid UserId,
        MemberRole NewRole,
        Guid RequestedBy
    ) : IRequest<Result>;



    public class UpdateMemberRoleCommandValidator : AbstractValidator<UpdateMemberRoleCommand>
    {
        public UpdateMemberRoleCommandValidator()
        {
            RuleFor(x => x.ChannelId)
                .NotEmpty().WithMessage("Channel ID is required");

            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");

            RuleFor(x => x.NewRole)
                .IsInEnum().WithMessage("Invalid role");

            RuleFor(x => x.RequestedBy)
                .NotEmpty().WithMessage("Requester ID is required");
        }
    }



    public class UpdateMemberRoleCommandHandler : IRequestHandler<UpdateMemberRoleCommand, Result>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ILogger<UpdateMemberRoleCommandHandler> _logger;

        public UpdateMemberRoleCommandHandler(
            IUnitOfWork unitOfWork,
            ILogger<UpdateMemberRoleCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _logger = logger;
        }

        public async Task<Result> Handle(
            UpdateMemberRoleCommand request,
            CancellationToken cancellationToken)
        {
            try
            {
                _logger?.LogInformation(
                    "Updating role for user {UserId} in channel {ChannelId} to {NewRole}",
                    request.UserId,
                    request.ChannelId,
                    request.NewRole);

                var channel = await _unitOfWork.Channels.GetByIdAsync(
                    request.ChannelId,
                    cancellationToken);

                if (channel == null)
                    throw new NotFoundException($"Channel with ID {request.ChannelId} not found");

                // Get member
                var member = await _unitOfWork.ChannelMembers.GetMemberAsync(
                    request.ChannelId,
                    request.UserId,
                    cancellationToken);

                if (member == null)
                {
                    return Result.Failure("User is not a member of this channel");
                }

                // Cannot change owner role
                if (member.Role == MemberRole.Owner && request.NewRole != MemberRole.Owner)
                {
                    return Result.Failure("Cannot demote owner. Transfer ownership first.");
                }

                // Only owner can promote to admin or change roles
                var requesterRole = await _unitOfWork.ChannelMembers.GetUserRoleAsync(
                    request.ChannelId,
                    request.RequestedBy,
                    cancellationToken);

                if (requesterRole != MemberRole.Owner)
                {
                    return Result.Failure("Only channel owner can change member roles");
                }

                member.UpdateRole(request.NewRole);
                await _unitOfWork.ChannelMembers.UpdateAsync(member, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                _logger?.LogInformation(
                    "Role updated successfully for user {UserId} in channel {ChannelId}",
                    request.UserId,
                    request.ChannelId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                _logger?.LogError(
                    ex,
                    "Error updating role for user {UserId} in channel {ChannelId}",
                    request.UserId,
                    request.ChannelId);
                return Result.Failure(ex.Message);
            }
        }
    }
}