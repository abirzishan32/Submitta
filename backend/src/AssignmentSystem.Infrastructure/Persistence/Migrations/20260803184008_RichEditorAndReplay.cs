using System;
using AssignmentSystem.Domain.Enums;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AssignmentSystem.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RichEditorAndReplay : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:assignment_status", "draft,published,archived")
                .Annotation("Npgsql:Enum:submission_event_type", "document_open,insert,delete,paste,cut,format,block_change,node_insert,node_delete,block_move,undo,redo,selection_change,idle,focus_lost,focus_regained,auto_save,manual_save,submit,document_close")
                .Annotation("Npgsql:Enum:submission_status", "submitted,under_review,graded,returned_for_revision")
                .Annotation("Npgsql:Enum:user_role", "admin,teacher,student")
                .OldAnnotation("Npgsql:Enum:assignment_status", "draft,published,archived")
                .OldAnnotation("Npgsql:Enum:submission_status", "submitted,under_review,graded,returned_for_revision")
                .OldAnnotation("Npgsql:Enum:user_role", "admin,teacher,student");

            migrationBuilder.AddColumn<string>(
                name: "content_json",
                table: "submissions",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "submission_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    submission_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sequence = table.Column<long>(type: "bigint", nullable: false),
                    type = table.Column<SubmissionEventType>(type: "submission_event_type", nullable: false),
                    offset_ms = table.Column<long>(type: "bigint", nullable: false),
                    received_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    cursor_from = table.Column<int>(type: "integer", nullable: true),
                    cursor_to = table.Column<int>(type: "integer", nullable: true),
                    block_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    payload = table.Column<string>(type: "jsonb", nullable: true),
                    characters_added = table.Column<int>(type: "integer", nullable: false),
                    characters_removed = table.Column<int>(type: "integer", nullable: false),
                    pasted_words = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    modified_by = table.Column<Guid>(type: "uuid", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    deleted_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_submission_events", x => x.id);
                    table.CheckConstraint("ck_submission_events_offset_non_negative", "offset_ms >= 0");
                    table.ForeignKey(
                        name: "fk_submission_events_submissions_submission_id",
                        column: x => x.submission_id,
                        principalTable: "submissions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "submission_versions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    submission_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version_number = table.Column<int>(type: "integer", nullable: false),
                    content_json = table.Column<string>(type: "jsonb", nullable: false),
                    plain_text = table.Column<string>(type: "text", nullable: false),
                    word_count = table.Column<int>(type: "integer", nullable: false),
                    at_sequence = table.Column<long>(type: "bigint", nullable: false),
                    reason = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    modified_by = table.Column<Guid>(type: "uuid", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    deleted_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_submission_versions", x => x.id);
                    table.CheckConstraint("ck_submission_versions_number_positive", "version_number > 0");
                    table.ForeignKey(
                        name: "fk_submission_versions_submissions_submission_id",
                        column: x => x.submission_id,
                        principalTable: "submissions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_submission_events_submission_sequence",
                table: "submission_events",
                columns: new[] { "submission_id", "sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_submission_events_submission_type",
                table: "submission_events",
                columns: new[] { "submission_id", "type" });

            migrationBuilder.CreateIndex(
                name: "ix_submission_versions_submission_number_unique",
                table: "submission_versions",
                columns: new[] { "submission_id", "version_number" },
                unique: true,
                filter: "is_deleted = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "submission_events");

            migrationBuilder.DropTable(
                name: "submission_versions");

            migrationBuilder.DropColumn(
                name: "content_json",
                table: "submissions");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:assignment_status", "draft,published,archived")
                .Annotation("Npgsql:Enum:submission_status", "submitted,under_review,graded,returned_for_revision")
                .Annotation("Npgsql:Enum:user_role", "admin,teacher,student")
                .OldAnnotation("Npgsql:Enum:assignment_status", "draft,published,archived")
                .OldAnnotation("Npgsql:Enum:submission_event_type", "document_open,insert,delete,paste,cut,format,block_change,node_insert,node_delete,block_move,undo,redo,selection_change,idle,focus_lost,focus_regained,auto_save,manual_save,submit,document_close")
                .OldAnnotation("Npgsql:Enum:submission_status", "submitted,under_review,graded,returned_for_revision")
                .OldAnnotation("Npgsql:Enum:user_role", "admin,teacher,student");
        }
    }
}
