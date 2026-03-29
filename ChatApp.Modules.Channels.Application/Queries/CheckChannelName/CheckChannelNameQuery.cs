using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Domain.ValueObjects;
using ChatApp.Shared.Kernel.Common;
using MediatR;

namespace ChatApp.Modules.Channels.Application.Queries.CheckChannelName
{
    /// <summary>
    /// Channel adının valid və unikal olub-olmadığını yoxlayır.
    /// available = true → ad istifadə oluna bilər
    /// available = false + error → niyə istifadə oluna bilmir
    /// </summary>
    public record CheckChannelNameQuery(
        string Name,
        Guid? CallerCompanyId = null
    ) : IRequest<Result<CheckChannelNameResult>>;

    public record CheckChannelNameResult(bool Available, string? Error = null);

    public class CheckChannelNameQueryHandler
        : IRequestHandler<CheckChannelNameQuery, Result<CheckChannelNameResult>>
    {
        private readonly IUnitOfWork _unitOfWork;

        public CheckChannelNameQueryHandler(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<Result<CheckChannelNameResult>> Handle(
            CheckChannelNameQuery request,
            CancellationToken cancellationToken)
        {
            var name = request.Name?.Trim();

            // Boş ad
            if (string.IsNullOrEmpty(name))
                return Result.Success(new CheckChannelNameResult(false, "Channel name cannot be empty"));

            // Minimum uzunluq
            if (name.Length < 2)
                return Result.Success(new CheckChannelNameResult(false, "Channel name must be at least 2 characters"));

            // Maksimum uzunluq
            if (name.Length > 100)
                return Result.Success(new CheckChannelNameResult(false, "Channel name cannot exceed 100 characters"));

            // Xüsusi simvol yoxlaması — ChannelName value object ilə eyni qayda
            try
            {
                ChannelName.Create(name);
            }
            catch (ArgumentException ex)
            {
                return Result.Success(new CheckChannelNameResult(false, ex.Message));
            }

            // Unikallıq yoxlaması — company daxilində
            var existing = request.CallerCompanyId.HasValue
                ? await _unitOfWork.Channels.GetByNameAndCompanyAsync(name, request.CallerCompanyId.Value, cancellationToken)
                : await _unitOfWork.Channels.GetByNameAsync(name, cancellationToken);
            if (existing != null)
                return Result.Success(new CheckChannelNameResult(false, "A channel with this name already exists"));

            return Result.Success(new CheckChannelNameResult(true));
        }
    }
}
