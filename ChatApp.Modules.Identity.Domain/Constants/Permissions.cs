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

        // Channels Module
        public const string ChannelsCreate = "Channels.Create";
        public const string ChannelsRead = "Channels.Read";
        public const string ChannelsDelete = "Channels.Delete";

        // Companies Module (SuperAdmin only)
        public const string CompaniesCreate = "Companies.Create";
        public const string CompaniesRead = "Companies.Read";
        public const string CompaniesUpdate = "Companies.Update";
        public const string CompaniesDelete = "Companies.Delete";

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
        /// SuperAdmin: bütün permissionlar (Companies.* daxil).
        /// Admin: Companies.* xaric bütün permissionlar (öz şirkəti daxilində idarə edir).
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
                    // Channel permissions
                    ChannelsCreate,
                    ChannelsRead,
                    ChannelsDelete
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
                    ChannelsCreate,
                    ChannelsRead
                ],
                _ => []
            };
        }
    }
}