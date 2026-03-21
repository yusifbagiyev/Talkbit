namespace ChatApp.Modules.DirectMessages.Application.DTOs.Request;

public record BatchReadRequest
{
    public List<Guid> MessageIds { get; init; } = [];
}
