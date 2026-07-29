using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExpensePlanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseScheduling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "DayOfMonth",
                table: "Expenses",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<int>(
                name: "Frequency",
                table: "Expenses",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ScheduleAnchorDate",
                table: "Expenses",
                type: "date",
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE "Expenses"
                SET "Frequency" = 0
                WHERE "Frequency" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Frequency",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "ScheduleAnchorDate",
                table: "Expenses");

            migrationBuilder.Sql(
                """
                UPDATE "Expenses"
                SET "DayOfMonth" = 1
                WHERE "DayOfMonth" IS NULL;
                """);

            migrationBuilder.AlterColumn<int>(
                name: "DayOfMonth",
                table: "Expenses",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
