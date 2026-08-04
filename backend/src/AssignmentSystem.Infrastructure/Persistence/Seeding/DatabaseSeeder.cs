using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AssignmentSystem.Infrastructure.Persistence.Seeding;

/// <summary>
/// Populates the database with a working demo dataset: accounts for all three
/// roles, an academic structure, and assignments and submissions covering the
/// states the UI has to render.
///
/// Idempotent — each section inserts only what is missing, so it is safe to run
/// on every startup and a partially seeded database heals itself.
/// </summary>
public sealed class DatabaseSeeder(
    AppDbContext context,
    IPasswordHasher passwordHasher,
    IDateTimeProvider dateTime,
    ILogger<DatabaseSeeder> logger)
{
    public async Task SeedAsync(string defaultPassword, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Seeding database…");

        var passwordHash = passwordHasher.Hash(defaultPassword);

        await SeedUsersAsync(passwordHash, cancellationToken);
        await SeedAcademicStructureAsync(cancellationToken);
        await SeedTeachingAndEnrolmentAsync(cancellationToken);
        await SeedAssignmentsAsync(cancellationToken);
        await SeedSubmissionsAsync(cancellationToken);
        await SeedApplicationSettingsAsync(cancellationToken);

        logger.LogInformation("Seeding complete.");
    }

    // -----------------------------------------------------------------------
    // Users
    // -----------------------------------------------------------------------
    private async Task SeedUsersAsync(string passwordHash, CancellationToken ct)
    {
        var users = new[]
        {
            NewUser("admin", "System Administrator", "admin@school.edu", UserRole.Admin),
            NewUser("teacher.sarah", "Sarah Ahmed", "sarah.ahmed@school.edu", UserRole.Teacher),
            NewUser("teacher.rafiq", "Rafiq Hasan", "rafiq.hasan@school.edu", UserRole.Teacher),
            NewUser("student.nadia", "Nadia Islam", "nadia.islam@school.edu", UserRole.Student),
            NewUser("student.tanvir", "Tanvir Rahman", "tanvir.rahman@school.edu", UserRole.Student),
            NewUser("student.mim", "Mim Chowdhury", "mim.chowdhury@school.edu", UserRole.Student)
        };

        await InsertMissingAsync(context.Users, users, ct);

        User NewUser(string key, string name, string email, UserRole role) => new()
        {
            Id = SeedIds.For($"user:{key}"),
            FullName = name,
            Email = email.ToLowerInvariant(),
            PasswordHash = passwordHash,
            Role = role,
            IsActive = true
        };
    }

    // -----------------------------------------------------------------------
    // Classes, subjects, and the offerings that join them
    // -----------------------------------------------------------------------
    private async Task SeedAcademicStructureAsync(CancellationToken ct)
    {
        // A school-style class and a college-style course, since the brief
        // covers both.
        var classes = new[]
        {
            new Class
            {
                Id = SeedIds.For("class:g10a"),
                Name = "Grade 10 - Section A",
                Code = "G10-A",
                Description = "Secondary school, tenth grade, section A.",
                AcademicYear = "2025-2026"
            },
            new Class
            {
                Id = SeedIds.For("class:cse3101"),
                Name = "CSE 3101 - Database Systems",
                Code = "CSE-3101",
                Description = "Third-year undergraduate database systems course.",
                AcademicYear = "2025-2026"
            }
        };

        var subjects = new[]
        {
            new Subject
            {
                Id = SeedIds.For("subject:math"), Name = "Mathematics", Code = "MATH",
                Description = "Algebra, geometry and trigonometry."
            },
            new Subject
            {
                Id = SeedIds.For("subject:physics"), Name = "Physics", Code = "PHY",
                Description = "Mechanics, thermodynamics and waves."
            },
            new Subject
            {
                Id = SeedIds.For("subject:dbms"), Name = "Database Management Systems", Code = "DBMS",
                Description = "Relational modelling, normalization and SQL."
            }
        };

        await InsertMissingAsync(context.Classes, classes, ct);
        await InsertMissingAsync(context.Subjects, subjects, ct);

        var offerings = new[]
        {
            NewOffering("g10a.math", "class:g10a", "subject:math"),
            NewOffering("g10a.physics", "class:g10a", "subject:physics"),
            NewOffering("cse3101.dbms", "class:cse3101", "subject:dbms")
        };

        await InsertMissingAsync(context.ClassSubjects, offerings, ct);

        ClassSubject NewOffering(string key, string classKey, string subjectKey) => new()
        {
            Id = SeedIds.For($"classsubject:{key}"),
            ClassId = SeedIds.For(classKey),
            SubjectId = SeedIds.For(subjectKey)
        };
    }

    // -----------------------------------------------------------------------
    // Who teaches what, and who studies where
    // -----------------------------------------------------------------------
    private async Task SeedTeachingAndEnrolmentAsync(CancellationToken ct)
    {
        var now = dateTime.UtcNow;

        // Sarah teaches both Grade 10 offerings; Rafiq teaches the university
        // course. This gives a teacher who must be denied access to another
        // teacher's offering — the case worth demonstrating.
        var teaching = new[]
        {
            NewTeaching("sarah.g10a.math", "user:teacher.sarah", "classsubject:g10a.math"),
            NewTeaching("sarah.g10a.physics", "user:teacher.sarah", "classsubject:g10a.physics"),
            NewTeaching("rafiq.cse3101.dbms", "user:teacher.rafiq", "classsubject:cse3101.dbms")
        };

        var enrolments = new[]
        {
            NewEnrolment("nadia.g10a", "user:student.nadia", "class:g10a"),
            NewEnrolment("tanvir.g10a", "user:student.tanvir", "class:g10a"),
            NewEnrolment("mim.cse3101", "user:student.mim", "class:cse3101")
        };

        await InsertMissingAsync(context.TeacherAssignments, teaching, ct);
        await InsertMissingAsync(context.Enrollments, enrolments, ct);

        TeacherAssignment NewTeaching(string key, string teacherKey, string offeringKey) => new()
        {
            Id = SeedIds.For($"teaching:{key}"),
            TeacherId = SeedIds.For(teacherKey),
            ClassSubjectId = SeedIds.For(offeringKey),
            AssignedAt = now,
            AssignedByUserId = SeedIds.For("user:admin")
        };

        Enrollment NewEnrolment(string key, string studentKey, string classKey) => new()
        {
            Id = SeedIds.For($"enrolment:{key}"),
            StudentId = SeedIds.For(studentKey),
            ClassId = SeedIds.For(classKey),
            EnrolledAt = now
        };
    }

    // -----------------------------------------------------------------------
    // Assignments — one per interesting state
    // -----------------------------------------------------------------------
    private async Task SeedAssignmentsAsync(CancellationToken ct)
    {
        var now = dateTime.UtcNow;

        var assignments = new[]
        {
            // Open, comfortably before its deadline.
            new Assignment
            {
                Id = SeedIds.For("assignment:quadratics"),
                Title = "Quadratic Equations Problem Set",
                Description =
                    "Solve problems 1-15 from chapter 4. Show every step of your working; "
                    + "answers without derivations receive partial credit only.",
                ClassSubjectId = SeedIds.For("classsubject:g10a.math"),
                CreatedByTeacherId = SeedIds.For("user:teacher.sarah"),
                Deadline = now.AddDays(7),
                MaxMarks = 100m,
                Status = AssignmentStatus.Published,
                PublishedAt = now.AddDays(-3),
                AllowResubmission = true,
                AllowLateSubmission = false
            },

            // Open, deadline approaching — exercises "due soon" UI.
            new Assignment
            {
                Id = SeedIds.For("assignment:newton"),
                Title = "Newton's Laws Lab Report",
                Description =
                    "Write up the inclined-plane experiment. Include your hypothesis, method, "
                    + "measurements, error analysis and conclusion.",
                ClassSubjectId = SeedIds.For("classsubject:g10a.physics"),
                CreatedByTeacherId = SeedIds.For("user:teacher.sarah"),
                Deadline = now.AddDays(2),
                MaxMarks = 50m,
                Status = AssignmentStatus.Published,
                PublishedAt = now.AddDays(-5),
                AllowResubmission = true,
                AllowLateSubmission = false
            },

            // Past its deadline but accepting late work — exercises the late path.
            new Assignment
            {
                Id = SeedIds.For("assignment:normalization"),
                Title = "Normalization Exercise",
                Description =
                    "Normalise the supplied schema to third normal form. State every functional "
                    + "dependency you rely on and justify each decomposition.",
                ClassSubjectId = SeedIds.For("classsubject:cse3101.dbms"),
                CreatedByTeacherId = SeedIds.For("user:teacher.rafiq"),
                Deadline = now.AddDays(-2),
                MaxMarks = 40m,
                Status = AssignmentStatus.Published,
                PublishedAt = now.AddDays(-14),
                AllowResubmission = false,
                AllowLateSubmission = true
            },

            // Draft — must never appear to a student.
            new Assignment
            {
                Id = SeedIds.For("assignment:trigonometry"),
                Title = "Trigonometry Worksheet",
                Description = "Draft — identities and the unit circle. Not yet released to students.",
                ClassSubjectId = SeedIds.For("classsubject:g10a.math"),
                CreatedByTeacherId = SeedIds.For("user:teacher.sarah"),
                Deadline = now.AddDays(14),
                MaxMarks = 75m,
                Status = AssignmentStatus.Draft,
                PublishedAt = null,
                AllowResubmission = true,
                AllowLateSubmission = false
            }
        };

        await InsertMissingAsync(context.Assignments, assignments, ct);
    }

    // -----------------------------------------------------------------------
    // Submissions — one per workflow state
    // -----------------------------------------------------------------------
    private async Task SeedSubmissionsAsync(CancellationToken ct)
    {
        var now = dateTime.UtcNow;

        var submissions = new[]
        {
            // Awaiting marking.
            new Submission
            {
                Id = SeedIds.For("submission:nadia.quadratics"),
                AssignmentId = SeedIds.For("assignment:quadratics"),
                StudentId = SeedIds.For("user:student.nadia"),
                Content =
                    "Q1: x = 3 or x = -5, by factorising x^2 + 2x - 15 = (x + 5)(x - 3).\n"
                    + "Q2: Discriminant is 49, so two distinct real roots: x = 2 and x = -1.5.\n"
                    + "(Full working for the remaining questions attached.)",
                SubmittedAt = now.AddDays(-1),
                IsLate = false,
                Status = SubmissionStatus.Submitted
            },

            // Marked, with feedback.
            new Submission
            {
                Id = SeedIds.For("submission:tanvir.quadratics"),
                AssignmentId = SeedIds.For("assignment:quadratics"),
                StudentId = SeedIds.For("user:student.tanvir"),
                Content =
                    "Q1: x = 3 or x = -5.\nQ2: x = 2 and x = -1.5.\n"
                    + "Q3 onwards solved using the quadratic formula throughout.",
                SubmittedAt = now.AddDays(-2),
                IsLate = false,
                Status = SubmissionStatus.Graded,
                Marks = 85m,
                GradedByTeacherId = SeedIds.For("user:teacher.sarah"),
                GradedAt = now.AddHours(-18)
            },

            // Submitted after the deadline against an assignment that allows it.
            new Submission
            {
                Id = SeedIds.For("submission:mim.normalization"),
                AssignmentId = SeedIds.For("assignment:normalization"),
                StudentId = SeedIds.For("user:student.mim"),
                Content =
                    "The relation violates 2NF: Address depends on StudentId alone rather than on "
                    + "the full key (StudentId, CourseId). Decomposed into Student, Course and "
                    + "Enrolment; the transitive dependency Department -> DeptHead is removed in 3NF.",
                SubmittedAt = now.AddHours(-6),
                IsLate = true,
                Status = SubmissionStatus.UnderReview
            }
        };

        await InsertMissingAsync(context.Submissions, submissions, ct);

        var feedback = new[]
        {
            new SubmissionFeedback
            {
                Id = SeedIds.For("feedback:tanvir.quadratics"),
                SubmissionId = SeedIds.For("submission:tanvir.quadratics"),
                TeacherId = SeedIds.For("user:teacher.sarah"),
                Comment =
                    "Correct answers throughout and clearly presented. Marks withheld on Q7 and "
                    + "Q11 because the working jumps straight to the result — show the "
                    + "intermediate steps and this is full marks next time.",
                MarksAtTime = 85m
            }
        };

        await InsertMissingAsync(context.SubmissionFeedbacks, feedback, ct);
    }

    // -----------------------------------------------------------------------
    // Application settings
    // -----------------------------------------------------------------------
    private async Task SeedApplicationSettingsAsync(CancellationToken ct)
    {
        var settings = new[]
        {
            NewSetting("app.institution_name", "Greenwood Institute", "string",
                "Name shown in the application header.", isPublic: true),
            NewSetting("app.academic_year", "2025-2026", "string",
                "Current academic year.", isPublic: true),
            NewSetting("submission.allow_late_by_default", "false", "boolean",
                "Default value of 'allow late submission' on a new assignment.", isPublic: false),
            NewSetting("submission.allow_update_before_deadline", "true", "boolean",
                "Default value of 'allow resubmission' on a new assignment.", isPublic: false),
            NewSetting("grading.default_max_marks", "100", "integer",
                "Maximum marks prefilled when a teacher creates an assignment.", isPublic: false),

            // Public, because the sign-in page has to know whether to offer a
            // link to the sign-up form before anyone has authenticated.
            NewSetting("auth.allow_self_registration", "true", "boolean",
                "Whether students and teachers can create their own accounts.", isPublic: true),
            NewSetting("auth.allow_teacher_registration", "true", "boolean",
                "Whether the sign-up form offers the teacher role.", isPublic: true),
            NewSetting("auth.teacher_requires_approval", "true", "boolean",
                "New teacher accounts start deactivated until an admin approves them.",
                isPublic: true)
        };

        await InsertMissingAsync(context.ApplicationSettings, settings, ct);

        ApplicationSetting NewSetting(
            string key, string value, string dataType, string description, bool isPublic) => new()
        {
            Id = SeedIds.For($"setting:{key}"),
            Key = key,
            Value = value,
            DataType = dataType,
            Description = description,
            IsPublic = isPublic
        };
    }

    // -----------------------------------------------------------------------
    // Helper
    // -----------------------------------------------------------------------
    /// <summary>
    /// Inserts only the entities whose ids are not already present, which is
    /// what makes the whole seeder idempotent and partially recoverable.
    /// </summary>
    private async Task InsertMissingAsync<T>(
        DbSet<T> set,
        IReadOnlyCollection<T> candidates,
        CancellationToken ct)
        where T : Domain.Common.BaseEntity
    {
        var ids = candidates.Select(c => c.Id).ToArray();

        var existing = await set
            .IgnoreQueryFilters()          // a soft-deleted row still occupies its id
            .Where(e => ids.Contains(e.Id))
            .Select(e => e.Id)
            .ToListAsync(ct);

        var missing = candidates.Where(c => !existing.Contains(c.Id)).ToArray();

        if (missing.Length == 0)
        {
            return;
        }

        set.AddRange(missing);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Seeded {Count} {Entity} row(s).", missing.Length, typeof(T).Name);
    }
}
