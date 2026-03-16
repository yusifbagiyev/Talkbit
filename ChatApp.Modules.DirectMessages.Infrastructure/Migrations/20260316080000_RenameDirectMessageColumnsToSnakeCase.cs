using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChatApp.Modules.DirectMessages.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameDirectMessageColumnsToSnakeCase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // direct_messages cədvəlindəki PascalCase sütunları snake_case-ə çevir
            migrationBuilder.RenameColumn(
                name: "ReplyToMessageId",
                table: "direct_messages",
                newName: "reply_to_message_id");

            migrationBuilder.RenameColumn(
                name: "IsForwarded",
                table: "direct_messages",
                newName: "is_forwarded");

            migrationBuilder.RenameColumn(
                name: "IsPinned",
                table: "direct_messages",
                newName: "is_pinned");

            migrationBuilder.RenameColumn(
                name: "PinnedAtUtc",
                table: "direct_messages",
                newName: "pinned_at_utc");

            migrationBuilder.RenameColumn(
                name: "PinnedBy",
                table: "direct_messages",
                newName: "pinned_by");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "reply_to_message_id",
                table: "direct_messages",
                newName: "ReplyToMessageId");

            migrationBuilder.RenameColumn(
                name: "is_forwarded",
                table: "direct_messages",
                newName: "IsForwarded");

            migrationBuilder.RenameColumn(
                name: "is_pinned",
                table: "direct_messages",
                newName: "IsPinned");

            migrationBuilder.RenameColumn(
                name: "pinned_at_utc",
                table: "direct_messages",
                newName: "PinnedAtUtc");

            migrationBuilder.RenameColumn(
                name: "pinned_by",
                table: "direct_messages",
                newName: "PinnedBy");
        }
    }
}
