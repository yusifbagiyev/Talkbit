using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChatApp.Modules.Channels.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameChannelMessageColumnsToSnakeCase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // channel_messages cədvəlindəki PascalCase sütunları snake_case-ə çevir
            migrationBuilder.RenameColumn(
                name: "ReplyToMessageId",
                table: "channel_messages",
                newName: "reply_to_message_id");

            migrationBuilder.RenameColumn(
                name: "IsForwarded",
                table: "channel_messages",
                newName: "is_forwarded");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "reply_to_message_id",
                table: "channel_messages",
                newName: "ReplyToMessageId");

            migrationBuilder.RenameColumn(
                name: "is_forwarded",
                table: "channel_messages",
                newName: "IsForwarded");
        }
    }
}
