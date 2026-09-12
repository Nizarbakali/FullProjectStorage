using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudentApi.Migrations
{
    /// <inheritdoc />
    public partial class ArchiveHistoryColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AncienEmplacement",
                table: "Donnees",
                type: "nvarchar(250)",
                maxLength: 250,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "DetacheLe",
                table: "Donnees",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "DesactiveLe",
                table: "Articles",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AncienEmplacement",
                table: "Donnees");

            migrationBuilder.DropColumn(
                name: "DetacheLe",
                table: "Donnees");

            migrationBuilder.DropColumn(
                name: "DesactiveLe",
                table: "Articles");
        }
    }
}
