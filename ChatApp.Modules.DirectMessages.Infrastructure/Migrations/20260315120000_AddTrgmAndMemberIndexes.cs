using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChatApp.Modules.DirectMessages.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTrgmAndMemberIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // pg_trgm extension (idempotent — artıq yaradılıbsa skip edir)
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

            // direct_messages content üzrə gin trgm index — SearchRepository ILike sürətlənir
            migrationBuilder.Sql(
                @"CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_direct_messages_content_trgm
                  ON direct_messages USING gin (content gin_trgm_ops);");

            // direct_conversation_members (user_id, is_active, is_hidden) — conversation list filter
            migrationBuilder.CreateIndex(
                name: "ix_dm_members_userId_isActive_isHidden",
                table: "direct_conversation_members",
                columns: new[] { "user_id", "is_active", "is_hidden" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_direct_messages_content_trgm;");

            migrationBuilder.DropIndex(
                name: "ix_dm_members_userId_isActive_isHidden",
                table: "direct_conversation_members");
        }
    }
}
