using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Application.Features.Notifications;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Infrastructure.Persistence;
using AssignmentSystem.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace AssignmentSystem.UnitTests.Infrastructure;

/// <summary>
/// A disposable in-memory database plus the seeded graph most tests need.
///
/// These are unit tests of business rules, not of PostgreSQL — the database's
/// own constraints (unique indexes, check constraints) are verified by the
/// migration and by the service-level guards that mirror them. What matters
/// here is that the rules hold without needing a live database.
///
/// Each instance gets a uniquely named store, so tests stay isolated and can
/// run in parallel.
/// </summary>
public sealed class TestContext : IDisposable
{
    public AppDbContext Db { get; }
    public FakeCurrentUser CurrentUser { get; }
    public FakeClock Clock { get; }

    /// <summary>
    /// Records what would have been announced, so a test can assert on it
    /// without a notification service, a database of recipients or a live
    /// connection.
    /// </summary>
    public RecordingNotificationDispatcher Notifications { get; } = new();

    public TestContext()
    {
        CurrentUser = new FakeCurrentUser();
        Clock = new FakeClock();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"tests-{Guid.NewGuid():N}")
            // The in-memory provider warns that it cannot honour transactions;
            // nothing under test depends on them.
            .ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            // The same interceptor production runs, driven by the test clock.
            // Without it CreatedAt stays at its default here, so anything that
            // orders or displays by it would behave differently under test than
            // in the running application — and pass anyway.
            .AddInterceptors(new AuditingSaveChangesInterceptor(CurrentUser, Clock))
            .Options;

        Db = new AppDbContext(options);
    }

    // --- Seed helpers ------------------------------------------------------
    // Named so a test reads as a scenario rather than as object construction.

    public User AddUser(UserRole role, string name = "Test User", bool isActive = true)
    {
        var user = new User
        {
            FullName = name,
            Email = $"{Guid.NewGuid():N}@school.edu",
            PasswordHash = "hash",
            Role = role,
            IsActive = isActive,
        };

        Db.Users.Add(user);
        Db.SaveChanges();
        return user;
    }

    public ClassSubject AddOffering(string classCode = "G10-A", string subjectCode = "MATH")
    {
        var klass = new Class { Name = classCode, Code = $"{classCode}-{Guid.NewGuid():N}"[..12] };
        var subject = new Subject { Name = subjectCode, Code = $"{subjectCode}-{Guid.NewGuid():N}"[..12] };

        Db.Classes.Add(klass);
        Db.Subjects.Add(subject);

        var offering = new ClassSubject { ClassId = klass.Id, SubjectId = subject.Id };
        Db.ClassSubjects.Add(offering);
        Db.SaveChanges();

        // Loaded so tests can reach offering.Class without an explicit include.
        Db.Entry(offering).Reference(o => o.Class).Load();
        Db.Entry(offering).Reference(o => o.Subject).Load();

        return offering;
    }

    public TeacherAssignment AssignTeacher(User teacher, ClassSubject offering)
    {
        var link = new TeacherAssignment
        {
            TeacherId = teacher.Id,
            ClassSubjectId = offering.Id,
            AssignedAt = Clock.UtcNow,
        };

        Db.TeacherAssignments.Add(link);
        Db.SaveChanges();
        return link;
    }

    public Enrollment Enroll(User student, ClassSubject offering)
    {
        var enrolment = new Enrollment
        {
            StudentId = student.Id,
            ClassId = offering.ClassId,
            EnrolledAt = Clock.UtcNow,
        };

        Db.Enrollments.Add(enrolment);
        Db.SaveChanges();
        return enrolment;
    }

    public Assignment AddAssignment(
        ClassSubject offering,
        User teacher,
        AssignmentStatus status = AssignmentStatus.Published,
        DateTimeOffset? deadline = null,
        decimal maxMarks = 100m,
        bool allowResubmission = true,
        bool allowLateSubmission = false)
    {
        var assignment = new Assignment
        {
            Title = "Test Assignment",
            Description = "Description",
            ClassSubjectId = offering.Id,
            CreatedByTeacherId = teacher.Id,
            Deadline = deadline ?? Clock.UtcNow.AddDays(7),
            MaxMarks = maxMarks,
            Status = status,
            PublishedAt = status == AssignmentStatus.Published ? Clock.UtcNow : null,
            AllowResubmission = allowResubmission,
            AllowLateSubmission = allowLateSubmission,
        };

        Db.Assignments.Add(assignment);
        Db.SaveChanges();
        return assignment;
    }

    public Submission AddSubmission(
        Assignment assignment,
        User student,
        SubmissionStatus status = SubmissionStatus.Submitted,
        decimal? marks = null,
        bool isLate = false)
    {
        var submission = new Submission
        {
            AssignmentId = assignment.Id,
            StudentId = student.Id,
            Content = "An answer.",
            SubmittedAt = Clock.UtcNow,
            IsLate = isLate,
            Status = status,
            Marks = marks,
        };

        Db.Submissions.Add(submission);
        Db.SaveChanges();
        return submission;
    }

    /// <summary>Signs the given user in for the duration of the test.</summary>
    public void SignIn(User user) => CurrentUser.SignIn(user);

    public static NullLogger<T> Logger<T>() => NullLogger<T>.Instance;

    public void Dispose() => Db.Dispose();
}

/// <summary>
/// An <see cref="INotificationDispatcher"/> that records instead of sending.
///
/// The services under test should announce things; whether anyone is listening
/// is a different question, tested separately.
/// </summary>
public sealed class RecordingNotificationDispatcher : INotificationDispatcher
{
    public List<Guid> AssignmentsPublished { get; } = [];
    public List<Guid> SubmissionsReceived { get; } = [];
    public List<Guid> SubmissionsGraded { get; } = [];
    public List<Guid> SubmissionsReturned { get; } = [];

    public Task AssignmentPublishedAsync(Guid assignmentId, CancellationToken ct = default)
    {
        AssignmentsPublished.Add(assignmentId);
        return Task.CompletedTask;
    }

    public Task SubmissionReceivedAsync(Guid submissionId, CancellationToken ct = default)
    {
        SubmissionsReceived.Add(submissionId);
        return Task.CompletedTask;
    }

    public Task SubmissionGradedAsync(Guid submissionId, CancellationToken ct = default)
    {
        SubmissionsGraded.Add(submissionId);
        return Task.CompletedTask;
    }

    public Task SubmissionReturnedAsync(Guid submissionId, CancellationToken ct = default)
    {
        SubmissionsReturned.Add(submissionId);
        return Task.CompletedTask;
    }
}

/// <summary>An <see cref="ICurrentUser"/> the test controls directly.</summary>
public sealed class FakeCurrentUser : ICurrentUser
{
    public Guid? UserId { get; private set; }
    public string? Email { get; private set; }
    public UserRole? Role { get; private set; }

    public bool IsAuthenticated => UserId is not null;

    public bool IsInRole(UserRole role) => Role == role;

    public Guid RequireUserId() =>
        UserId ?? throw new Domain.Exceptions.UnauthorizedException("Not signed in.");

    public void SignIn(User user)
    {
        UserId = user.Id;
        Email = user.Email;
        Role = user.Role;
    }

    public void SignOut()
    {
        UserId = null;
        Email = null;
        Role = null;
    }
}

/// <summary>
/// A clock the test moves by hand.
///
/// This is why <see cref="IDateTimeProvider"/> exists: deadline rules are the
/// heart of the system, and testing them against the real clock would mean
/// sleeping or seeding dates relative to "now" and hoping.
/// </summary>
public sealed class FakeClock : IDateTimeProvider
{
    public DateTimeOffset UtcNow { get; private set; } =
        new(2026, 1, 15, 12, 0, 0, TimeSpan.Zero);

    public void Advance(TimeSpan by) => UtcNow = UtcNow.Add(by);

    public void SetTo(DateTimeOffset moment) => UtcNow = moment;
}
