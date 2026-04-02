using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChatApp.Modules.Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class GrantDriveAccessPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Bütün aktiv Admin və User rollu istifadəçilərə Drive.Access permission-ı ver
            // SuperAdmin artıq bütün permission-ları alır (role-based)
            // İdempotent — artıq mövcud olanları skip edir
            migrationBuilder.Sql(@"
                INSERT INTO user_permissions (id, user_id, permission_name, created_at_utc, updated_at_utc)
                SELECT gen_random_uuid(), u.id, 'Drive.Access', NOW(), NOW()
                FROM users u
                WHERE u.is_active = true
                  AND u.role != 2
                  AND NOT EXISTS (
                      SELECT 1 FROM user_permissions up
                      WHERE up.user_id = u.id AND up.permission_name = 'Drive.Access'
                  );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE FROM user_permissions
                WHERE permission_name = 'Drive.Access';
            ");
        }
    }
}
