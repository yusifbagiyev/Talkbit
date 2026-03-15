using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChatApp.Modules.Channels.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTrgmAndMemberIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // pg_trgm extension — ILIKE '%term%' axtarışını sürətləndirir
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

            // channel_messages content üzrə gin trgm index — SearchRepository ILike sürətlənir
            migrationBuilder.Sql(
                @"CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_channel_messages_content_trgm
                  ON channel_messages USING gin (content gin_trgm_ops);");

            // channel_members (user_id, is_hidden) — conversation list filter
            migrationBuilder.CreateIndex(
                name: "ix_channel_members_userId_isHidden",
                table: "channel_members",
                columns: new[] { "user_id", "is_hidden" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_channel_messages_content_trgm;");

            migrationBuilder.DropIndex(
                name: "ix_channel_members_userId_isHidden",
                table: "channel_members");
        }
    }
}
