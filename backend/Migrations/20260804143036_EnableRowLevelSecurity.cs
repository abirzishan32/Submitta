using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AssignmentSystem.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Enables Row-Level Security across the public schema, and withdraws the
    /// REST roles a hosted PostgreSQL publishes that schema through.
    /// </summary>
    /// <remarks>
    /// The application repeats this on every start, which is what covers tables
    /// added by later migrations. It is here as well so that anyone applying
    /// <c>database/schema.sql</c> by hand — rather than letting the application
    /// build the schema — ends up with a protected database too. Both paths run
    /// the same idempotent statement.
    ///
    /// See <c>PublicSchemaHardening</c> for why there are deliberately no
    /// policies.
    /// </remarks>
    public partial class EnableRowLevelSecurity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(PublicSchemaHardening.HardenSql);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Deliberately not reversed. Undoing this would republish every
            // table to the internet, which is never what someone rolling back a
            // schema change is asking for. Disable RLS by hand if that is
            // genuinely wanted.
        }
    }
}
