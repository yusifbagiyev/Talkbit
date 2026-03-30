using ChatApp.Modules.Files.Domain.Enums;

namespace ChatApp.Modules.Files.Application.Services
{
    public static class FileTypeHelper
    {
        public static readonly Dictionary<string, FileType> ContentTypeMapping = new()
        {
            // Images
            {"image/jpg",FileType.Image },
            {"image/jpeg",FileType.Image },
            {"image/png",FileType.Image },
            {"image/webp",FileType.Image },
            {"image/svg+xml",FileType.Image },
            {"image/bmp",FileType.Image },


            // Documents
            { "application/pdf",FileType.Document },
            { "application/msword",FileType.Document },
            { "application/vnd.openxmlformats-officedocument.wordprocessingml.document", FileType.Document },
            { "application/vnd.ms-excel", FileType.Document },
            { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", FileType.Document },
            { "application/vnd.ms-powerpoint", FileType.Document },
            { "application/vnd.openxmlformats-officedocument.presentationml.presentation", FileType.Document },
            { "text/plain", FileType.Document },
            { "text/csv", FileType.Document },

            // Videos
            { "video/mp4", FileType.Video },
            { "video/mpeg", FileType.Video },
            { "video/quicktime", FileType.Video },
            { "video/x-msvideo", FileType.Video },
            { "video/webm", FileType.Video },

            // Audio
            { "audio/mpeg", FileType.Audio },
            { "audio/wav", FileType.Audio },
            { "audio/ogg", FileType.Audio },
            { "audio/webm", FileType.Audio },

            // Archives
            { "application/zip", FileType.Archive },
            { "application/x-zip-compressed", FileType.Archive },
            { "application/x-zip", FileType.Archive },
            { "application/x-rar-compressed", FileType.Archive },
            { "application/vnd.rar", FileType.Archive },
            { "application/x-7z-compressed", FileType.Archive },
            { "application/x-tar", FileType.Archive },
            { "application/gzip", FileType.Archive },

            // GIF
            { "image/gif", FileType.Image }
        };

        public static FileType GetFileType(string contentType)
        {
            return ContentTypeMapping.TryGetValue(contentType.ToLowerInvariant(), out var fileType)
                ? fileType
                : FileType.Other;
        }

        public static bool IsAllowedFileType(string contentType)
        {
            return ContentTypeMapping.ContainsKey(contentType.ToLowerInvariant());
        }

        // Extension-a görə icazə verilən fayl tipini müəyyən et (MIME type tanınmadıqda fallback)
        private static readonly Dictionary<string, string> ExtensionToContentType = new(StringComparer.OrdinalIgnoreCase)
        {
            { ".jpg", "image/jpeg" }, { ".jpeg", "image/jpeg" }, { ".png", "image/png" },
            { ".webp", "image/webp" }, { ".svg", "image/svg+xml" }, { ".bmp", "image/bmp" },
            { ".gif", "image/gif" },
            { ".pdf", "application/pdf" }, { ".doc", "application/msword" },
            { ".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
            { ".xls", "application/vnd.ms-excel" },
            { ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
            { ".ppt", "application/vnd.ms-powerpoint" },
            { ".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
            { ".txt", "text/plain" }, { ".csv", "text/csv" },
            { ".mp4", "video/mp4" }, { ".mpeg", "video/mpeg" }, { ".mov", "video/quicktime" },
            { ".avi", "video/x-msvideo" }, { ".webm", "video/webm" },
            { ".mp3", "audio/mpeg" }, { ".wav", "audio/wav" }, { ".ogg", "audio/ogg" },
            { ".weba", "audio/webm" },
            { ".zip", "application/zip" }, { ".rar", "application/x-rar-compressed" },
            { ".7z", "application/x-7z-compressed" }, { ".tar", "application/x-tar" },
            { ".gz", "application/gzip" }
        };

        /// <summary>
        /// MIME type tanınmırsa (application/octet-stream), fayl extension-ına görə düzgün content type qaytarır
        /// </summary>
        public static string ResolveContentType(string contentType, string fileName)
        {
            if (IsAllowedFileType(contentType))
                return contentType;

            var ext = Path.GetExtension(fileName);
            if (!string.IsNullOrEmpty(ext) && ExtensionToContentType.TryGetValue(ext, out var resolved))
                return resolved;

            return contentType;
        }


        public static string GetFileExtension(string fileName)
        {
            return Path.GetExtension(fileName).ToLowerInvariant();
        }

        public static string GetExtensionFromContentType(string contentType)
        {
            return contentType.ToLowerInvariant() switch
            {
                // Images
                "image/jpeg" => ".jpg",
                "image/jpg" => ".jpg",
                "image/png" => ".png",
                "image/webp" => ".webp",
                "image/svg+xml" => ".svg",
                "image/bmp" => ".bmp",

                // Documents
                "application/pdf" => ".pdf",
                "application/msword" => ".doc",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => ".docx",
                "application/vnd.ms-excel" => ".xls",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" => ".xlsx",
                "application/vnd.ms-powerpoint" => ".ppt",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation" => ".pptx",
                "text/plain" => ".txt",
                "text/csv" => ".csv",

                // Videos
                "video/mp4" => ".mp4",
                "video/mpeg" => ".mpeg",
                "video/quicktime" => ".mov",
                "video/x-msvideo" => ".avi",
                "video/webm" => ".webm",

                // Audio
                "audio/mpeg" => ".mp3",
                "audio/wav" => ".wav",
                "audio/ogg" => ".ogg",
                "audio/webm" => ".weba",

                // Archives
                "application/zip" => ".zip",
                "application/x-zip-compressed" => ".zip",
                "application/x-zip" => ".zip",
                "application/x-rar-compressed" => ".rar",
                "application/vnd.rar" => ".rar",
                "application/x-7z-compressed" => ".7z",
                "application/x-tar" => ".tar",
                "application/gzip" => ".gz",

                // GIF
                "image/gif" => ".gif",

                _ => ""
            };
        }
    }
}