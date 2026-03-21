namespace ChatApp.Modules.Channels.Application.DTOs.Requests;

public record BatchReadRequest
{
    public List<Guid> MessageIds { get; init; } = [];
}
