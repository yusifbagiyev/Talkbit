using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Domain.Entities;
using ChatApp.Shared.Infrastructure.SignalR.Services;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Commands.ChannelMessages
{
    /// <summary>
    /// Frontend viewport-dakI gorunen channel mesajlarini batch olaraq oxunmus isareleyir.
    /// N ayri HTTP request evezine 1 request gonderilir.
    /// </summary>
    public record BatchMarkChannelMessagesAsReadCommand(
        Guid ChannelId,
        List<Guid> MessageIds,
        Guid UserId
    ) : IRequest<Result>;


    public class BatchMarkChannelMessagesAsReadCommandValidator : AbstractValidator<BatchMarkChannelMessagesAsReadCommand>
    {
        public BatchMarkChannelMessagesAsReadCommandValidator()
        {
            RuleFor(x => x.ChannelId)
                .NotEmpty().WithMessage("Channel ID is required");

            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");

            RuleFor(x => x.MessageIds)
                .NotEmpty().WithMessage("At least one message ID is required")
                .Must(ids => ids.Count <= 50).WithMessage("Maximum 50 messages per batch");
        }
    }


    public class BatchMarkChannelMessagesAsReadCommandHandler : IRequestHandler<BatchMarkChannelMessagesAsReadCommand, Result>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ISignalRNotificationService _signalRNotificationService;
        private readonly ILogger<BatchMarkChannelMessagesAsReadCommandHandler> _logger;

        public BatchMarkChannelMessagesAsReadCommandHandler(
            IUnitOfWork unitOfWork,
            ISignalRNotificationService signalRNotificationService,
            ILogger<BatchMarkChannelMessagesAsReadCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _signalRNotificationService = signalRNotificationService;
            _logger = logger;
        }

        public async Task<Result> Handle(
            BatchMarkChannelMessagesAsReadCommand request,
            CancellationToken cancellationToken)
        {
            try
            {
                // Istifadecinin channel uzvluyunu yoxla
                var member = await _unitOfWork.ChannelMembers.GetMemberAsync(
                    request.ChannelId,
                    request.UserId,
                    cancellationToken);

                if (member == null)
                    return Result.Failure("User is not a member of this channel");

                // Mesajlari batch yukle — yalniz gonderilen ID-leri
                var messages = await _unitOfWork.ChannelMessages.GetByIdsAsync(
                    request.MessageIds,
                    cancellationToken);

                // Yalniz bu channel-a aid ve oz mesaji olmayanlari filter et
                var filteredMessageIds = messages
                    .Where(m => m.ChannelId == request.ChannelId && m.SenderId != request.UserId)
                    .Select(m => m.Id)
                    .ToList();

                if (filteredMessageIds.Count == 0)
                    return Result.Success();

                // Artıq oxunmuşları çıxar — tək DB sorğusu (N+1 yox)
                var existingReadIds = await _unitOfWork.ChannelMessageReads
                    .GetExistingReadMessageIdsAsync(filteredMessageIds, request.UserId, cancellationToken);

                var newMessageIds = filteredMessageIds
                    .Where(id => !existingReadIds.Contains(id))
                    .ToList();

                if (newMessageIds.Count == 0)
                    return Result.Success();

                // ChannelMessageRead record-larini bulk insert et
                var readRecords = newMessageIds
                    .Select(messageId => new ChannelMessageRead(messageId, request.UserId))
                    .ToList();

                await _unitOfWork.ChannelMessageReads.BulkInsertAsync(readRecords, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                // Bulk read count-lari tek query ile al
                var messageReadCounts = await _unitOfWork.ChannelMessageReads
                    .GetReadByCountsAsync(newMessageIds, cancellationToken);

                // Hybrid SignalR notification gonder
                var members = await _unitOfWork.ChannelMembers.GetChannelMembersAsync(
                    request.ChannelId,
                    cancellationToken);

                var memberUserIds = members
                    .Select(m => m.UserId)
                    .ToList();

                await _signalRNotificationService.NotifyChannelMessagesReadToMembersAsync(
                    request.ChannelId,
                    memberUserIds,
                    request.UserId,
                    messageReadCounts);

                _logger?.LogInformation(
                    "Batch marked {Count} messages as read for user {UserId} in channel {ChannelId}",
                    newMessageIds.Count,
                    request.UserId,
                    request.ChannelId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                _logger?.LogError(
                    ex,
                    "Error batch marking messages as read for user {UserId} in channel {ChannelId}",
                    request.UserId,
                    request.ChannelId);
                return Result.Failure(ex.Message);
            }
        }
    }
}
