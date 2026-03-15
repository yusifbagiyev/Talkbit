using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChatApp.Modules.Notifications.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Unread notifications by user — filtered index (status != Read(4))
            migrationBuilder.Sql(
                @"CREATE INDEX IF NOT EXISTS ix_notifications_userId_createdAt_unread
                  ON notifications (user_id, created_at_utc DESC)
                  WHERE status != 4;");

            // Cleanup job üçün — köhnə bildirişləri tapmaq
            migrationBuilder.CreateIndex(
                name: "ix_notifications_created_status",
                table: "notifications",
                columns: new[] { "created_at_utc", "status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_notifications_userId_createdAt_unread;");

            migrationBuilder.DropIndex(
                name: "ix_notifications_created_status",
                table: "notifications");
        }
    }
}
