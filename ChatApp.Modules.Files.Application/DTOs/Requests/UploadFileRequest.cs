using Microsoft.AspNetCore.Http;

namespace ChatApp.Modules.Files.Application.DTOs.Requests
{
    public record UploadFileRequest(
        IFormFile File,
        Guid? ConversationId = null,
        Guid? ChannelId = null,
        bool IsCompanyAvatar = false,
        Guid? TargetCompanyId = null);
}