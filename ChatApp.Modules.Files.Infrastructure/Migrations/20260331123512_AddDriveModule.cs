using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChatApp.Modules.Files.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDriveModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "folder_id",
                table: "file_metadata",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_drive_file",
                table: "file_metadata",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "drive_folders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    owner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: true),
                    parent_folder_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    deleted_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_drive_folders", x => x.id);
                    table.ForeignKey(
                        name: "FK_drive_folders_drive_folders_parent_folder_id",
                        column: x => x.parent_folder_id,
                        principalTable: "drive_folders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_file_metadata_folder_id",
                table: "file_metadata",
                column: "folder_id");

            migrationBuilder.CreateIndex(
                name: "ix_file_metadata_uploaded_by_drive",
                table: "file_metadata",
                columns: new[] { "uploaded_by", "is_drive_file" });

            migrationBuilder.CreateIndex(
                name: "IX_drive_folders_parent_folder_id",
                table: "drive_folders",
                column: "parent_folder_id");

            migrationBuilder.CreateIndex(
                name: "ix_drive_folders_is_deleted",
                table: "drive_folders",
                column: "is_deleted");

            migrationBuilder.CreateIndex(
                name: "ix_drive_folders_owner_id",
                table: "drive_folders",
                column: "owner_id");

            migrationBuilder.CreateIndex(
                name: "ix_drive_folders_owner_parent",
                table: "drive_folders",
                columns: new[] { "owner_id", "parent_folder_id" });

            migrationBuilder.AddForeignKey(
                name: "FK_file_metadata_drive_folders_folder_id",
                table: "file_metadata",
                column: "folder_id",
                principalTable: "drive_folders",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_file_metadata_drive_folders_folder_id",
                table: "file_metadata");

            migrationBuilder.DropTable(
                name: "drive_folders");

            migrationBuilder.DropIndex(
                name: "ix_file_metadata_folder_id",
                table: "file_metadata");

            migrationBuilder.DropIndex(
                name: "ix_file_metadata_uploaded_by_drive",
                table: "file_metadata");

            migrationBuilder.DropColumn(
                name: "folder_id",
                table: "file_metadata");

            migrationBuilder.DropColumn(
                name: "is_drive_file",
                table: "file_metadata");
        }
    }
}
