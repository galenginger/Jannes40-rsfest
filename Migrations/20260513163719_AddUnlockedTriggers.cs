using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DanneFest.Migrations
{
    /// <inheritdoc />
    public partial class AddUnlockedTriggers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UnlockedTriggers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Type = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    TriggerValue = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    UnlockedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnlockedTriggers", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UnlockedTriggers_Type_TriggerValue",
                table: "UnlockedTriggers",
                columns: new[] { "Type", "TriggerValue" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UnlockedTriggers");
        }
    }
}
