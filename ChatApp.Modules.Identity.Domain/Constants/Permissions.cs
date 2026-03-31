using System.Reflection;
using ChatApp.Modules.Identity.Domain.Enums;

namespace ChatApp.Modules.Identity.Domain.Constants
{
    /// <summary>
    /// Statik permission konstantları. 3 səviyyəli rol sistemi üzrə paylanır.
    /// </summary>
    public static class Permissions
    {
        // Identity Module - User Management
        public const string UsersCreate = "Users.Create";
        public const string UsersRead = "Users.Read";
        public const string UsersUpdate = "Users.Update";
        public const string UsersDelete = "Users.Delete";

        // Identity Module - Permission Management (Admin only)
        public const string PermissionsRead = "Permissions.Read";
        public const string PermissionsAssign = "Permissions.Assign";
        public const string PermissionsRevoke = "Permissions.Revoke";

        // Messaging Module - Messages
        public const string MessagesSend = "Messages.Send";
        public const string MessagesRead = "Messages.Read";
        public const string MessagesEdit = "Messages.Edit";
        public const string MessagesDelete = "Messages.Delete";

        // Files Module
        public const string FilesUpload = "Files.Upload";
        public const string FilesDownload = "Files.Download";
        public const string FilesDelete = "Files.Delete";

        // Avatar Module
        public const string AvatarUpload = "Avatar.Upload";

        // Drive Module
        public const string DriveAccess = "Drive.Access";

        // Channels Module
        public const string ChannelsCreate = "Channels.Create";
        public const string ChannelsRead = "Channels.Read";
        public const string ChannelsDelete = "Channels.Delete";

        /// <summary>
        /// Gets all available permissions in the system
        /// </summary>
        public static IEnumerable<string> GetAll()
        {
            return typeof(Permissions)
                .GetFields(BindingFlags.Public | BindingFlags.Static | BindingFlags.FlattenHierarchy)
                .Where(f => f.IsLiteral && !f.IsInitOnly && f.FieldType == typeof(string))
                .Select(f => (string)f.GetValue(null)!)
                .ToList();
        }

        /// <summary>
        /// 3 səviyyəli rol sisteminə uyğun default permissionlar.
        /// SuperAdmin: rol əsasında idarə olunur, permission sistemindən kənardır.
        /// Admin: öz şirkəti daxilində bütün permissionlar.
        /// User: əsas mesajlaşma/fayl/kanal permissionları.
        /// </summary>
        public static IEnumerable<string> GetDefaultForRole(Role role)
        {
            return role switch
            {
                Role.SuperAdmin => GetAll(),
                Role.Admin =>
                [
                    // User management
                    UsersCreate,
                    UsersRead,
                    UsersUpdate,
                    UsersDelete,
                    // Permission management
                    PermissionsRead,
                    PermissionsAssign,
                    PermissionsRevoke,
                    // Messaging permissions
                    MessagesSend,
                    MessagesRead,
                    MessagesEdit,
                    MessagesDelete,
                    // File permissions
                    FilesUpload,
                    FilesDownload,
                    FilesDelete,
                    // Avatar permission
                    AvatarUpload,
                    // Channel permissions
                    ChannelsCreate,
                    ChannelsRead,
                    ChannelsDelete,
                    // Drive permission
                    DriveAccess
                ],
                Role.User =>
                [
                    UsersRead,
                    MessagesSend,
                    MessagesRead,
                    MessagesEdit,
                    MessagesDelete,
                    FilesUpload,
                    FilesDelete,
                    FilesDownload,
                    AvatarUpload,
                    ChannelsCreate,
                    ChannelsRead,
                    DriveAccess
                ],
                _ => []
            };
        }
    }
}