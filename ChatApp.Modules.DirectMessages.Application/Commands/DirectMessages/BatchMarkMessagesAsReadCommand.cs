using ChatApp.Modules.DirectMessages.Application.Interfaces;
using ChatApp.Modules.DirectMessages.Domain.Events;
using ChatApp.Shared.Infrastructure.SignalR.Services;
using ChatApp.Shared.Kernel.Common;
using ChatApp.Shared.Kernel.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.DirectMessages.Application.Commands.DirectMessages
{
    /// <summary>
    /// Frontend viewport-dakI gorunen mesajlarI batch olaraq oxunmus isareleyir.
    /// N ayri HTTP request evezine 1 request gonderilir.
    /// </summary>
    public record BatchMarkMessagesAsReadCommand(
        Guid ConversationId,
        List<Guid> MessageIds,
        Guid UserId
    ) : IRequest<Result>;


    public class BatchMarkMessagesAsReadCommandValidator : AbstractValidator<BatchMarkMessagesAsReadCommand>
    {
        public BatchMarkMessagesAsReadCommandValidator()
        {
            RuleFor(x => x.ConversationId)
                .NotEmpty().WithMessage("Conversation ID is required");

            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");

            RuleFor(x => x.MessageIds)
                .NotEmpty().WithMessage("At least one message ID is required")
                .Must(ids => ids.Count <= 50).WithMessage("Maximum 50 messages per batch");
        }
    }


    public class BatchMarkMessagesAsReadCommandHandler : IRequestHandler<BatchMarkMessagesAsReadCommand, Result>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IEventBus _eventBus;
        private readonly ISignalRNotificationService _signalRNotificationService;
        private readonly ILogger<BatchMarkMessagesAsReadCommandHandler> _logger;

        public BatchMarkMessagesAsReadCommandHandler(
            IUnitOfWork unitOfWork,
            IEventBus eventBus,
            ISignalRNotificationService signalRNotificationService,
            ILogger<BatchMarkMessagesAsReadCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _eventBus = eventBus;
            _signalRNotificationService = signalRNotificationService;
            _logger = logger;
        }


        public async Task<Result> Handle(
            BatchMarkMessagesAsReadCommand request,
            CancellationToken cancellationToken = default)
        {
            try
            {
                // Conversation movcudlugunu ve istifadecinin istirakini yoxla
                var conversation = await _unitOfWork.Conversations.GetByIdAsync(
                    request.ConversationId,
                    cancellationToken);

                if (conversation == null)
                    return Result.Failure($"Conversation with ID {request.ConversationId} was not found");

                if (conversation.User1Id != request.UserId && conversation.User2Id != request.UserId)
                    return Result.Failure("You are not a participant in this conversation");

                // Mesajlari batch yukle
                var messages = await _unitOfWork.Messages.GetByIdsAsync(
                    request.MessageIds,
                    cancellationToken);

                // Yalniz bu conversation-a aid, oxunmamis, bize gonderilmis mesajlari filter et
                var messagesToMark = messages
                    .Where(m => m.ConversationId == request.ConversationId
                             && m.ReceiverId == request.UserId
                             && !m.IsRead)
                    .ToList();

                if (messagesToMark.Count == 0)
                    return Result.Success();

                // Hamısını oxunmus isarele
                foreach (var message in messagesToMark)
                {
                    message.MarkAsRead();
                }

                // Tek transaction-da saxla
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                // Real-time bildirisleri gonder
                foreach (var message in messagesToMark)
                {
                    await _signalRNotificationService.NotifyMessageReadAsync(
                        message.ConversationId,
                        message.Id,
                        request.UserId,
                        message.SenderId,
                        message.ReadAtUtc!.Value);

                    await _eventBus.PublishAsync(
                        new MessageReadEvent(
                            message.Id,
                            message.ConversationId,
                            request.UserId),
                        cancellationToken);
                }

                _logger.LogInformation(
                    "Batch marked {Count} messages as read in conversation {ConversationId} for user {UserId}",
                    messagesToMark.Count,
                    request.ConversationId,
                    request.UserId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error batch marking messages as read in conversation {ConversationId} for user {UserId}",
                    request.ConversationId,
                    request.UserId);
                return Result.Failure(ex.Message);
            }
        }
    }
}
