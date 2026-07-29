using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExpensePlanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddContributorOwner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsOwner",
                table: "Contributors",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql(
                """
                WITH ranked_contributors AS (
                    SELECT
                        "Id",
                        ROW_NUMBER() OVER (
                            PARTITION BY "PlannerId"
                            ORDER BY
                                CASE
                                    WHEN "IsArchived" = FALSE AND LOWER("Name") = 'me' THEN 0
                                    ELSE 1
                                END,
                                "CreatedAtUtc",
                                "Id"
                        ) AS owner_rank
                    FROM "Contributors"
                )
                UPDATE "Contributors" AS contributor
                SET "IsOwner" = TRUE
                FROM ranked_contributors AS ranked
                WHERE contributor."Id" = ranked."Id"
                  AND ranked.owner_rank = 1;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Contributors_PlannerId_IsOwner",
                table: "Contributors",
                columns: new[] { "PlannerId", "IsOwner" },
                unique: true,
                filter: "\"IsOwner\" = TRUE");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Contributors_PlannerId_IsOwner",
                table: "Contributors");

            migrationBuilder.DropColumn(
                name: "IsOwner",
                table: "Contributors");
        }
    }
}
