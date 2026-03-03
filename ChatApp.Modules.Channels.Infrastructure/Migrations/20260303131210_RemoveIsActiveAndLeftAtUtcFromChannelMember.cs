using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChatApp.Modules.Channels.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveIsActiveAndLeftAtUtcFromChannelMember : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_channel_members_is_active",
                table: "channel_members");

            migrationBuilder.DropColumn(
                name: "is_active",
                table: "channel_members");

            migrationBuilder.DropColumn(
                name: "left_at_utc",
                table: "channel_members");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_active",
                table: "channel_members",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "left_at_utc",
                table: "channel_members",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_channel_members_is_active",
                table: "channel_members",
                column: "is_active");
        }
    }
}
