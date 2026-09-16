using FluentValidation;

namespace AssignmentSystem.Application.Features.Admin.Academics;

public sealed class CreateClassRequestValidator : AbstractValidator<CreateClassRequest>
{
    public CreateClassRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Class name is required.").MaximumLength(150);
        RuleFor(x => x.Code).ClassOrSubjectCode();
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.AcademicYear).MaximumLength(20);
    }
}

public sealed class UpdateClassRequestValidator : AbstractValidator<UpdateClassRequest>
{
    public UpdateClassRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Class name is required.").MaximumLength(150);
        RuleFor(x => x.Code).ClassOrSubjectCode();
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.AcademicYear).MaximumLength(20);
    }
}

public sealed class CreateSubjectRequestValidator : AbstractValidator<CreateSubjectRequest>
{
    public CreateSubjectRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Subject name is required.").MaximumLength(150);
        RuleFor(x => x.Code).ClassOrSubjectCode();
        RuleFor(x => x.Description).MaximumLength(1000);
    }
}

public sealed class UpdateSubjectRequestValidator : AbstractValidator<UpdateSubjectRequest>
{
    public UpdateSubjectRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Subject name is required.").MaximumLength(150);
        RuleFor(x => x.Code).ClassOrSubjectCode();
        RuleFor(x => x.Description).MaximumLength(1000);
    }
}

public sealed class CreateOfferingRequestValidator : AbstractValidator<CreateOfferingRequest>
{
    public CreateOfferingRequestValidator()
    {
        RuleFor(x => x.ClassId).NotEmpty().WithMessage("Class is required.");
        RuleFor(x => x.SubjectId).NotEmpty().WithMessage("Subject is required.");
    }
}

public sealed class AssignTeacherRequestValidator : AbstractValidator<AssignTeacherRequest>
{
    public AssignTeacherRequestValidator()
    {
        RuleFor(x => x.TeacherId).NotEmpty().WithMessage("Teacher is required.");
        RuleFor(x => x.ClassSubjectId).NotEmpty().WithMessage("Class and subject are required.");
    }
}

public sealed class CreateEnrollmentRequestValidator : AbstractValidator<CreateEnrollmentRequest>
{
    public CreateEnrollmentRequestValidator()
    {
        RuleFor(x => x.StudentId).NotEmpty().WithMessage("Student is required.");
        RuleFor(x => x.ClassId).NotEmpty().WithMessage("Class is required.");
    }
}

public sealed class BulkEnrollRequestValidator : AbstractValidator<BulkEnrollRequest>
{
    public BulkEnrollRequestValidator()
    {
        RuleFor(x => x.ClassId).NotEmpty().WithMessage("Class is required.");

        RuleFor(x => x.StudentIds)
            .NotEmpty().WithMessage("Select at least one student.")
            .Must(ids => ids.Count <= 200)
                .WithMessage("Enrol at most 200 students at a time.")
            .Must(ids => ids.Distinct().Count() == ids.Count)
                .WithMessage("The same student appears more than once.");
    }
}

internal static class AcademicRules
{
    /// <summary>
    /// Codes appear in URLs and search, so they are restricted to characters
    /// that survive both without escaping.
    /// </summary>
    public static IRuleBuilderOptions<T, string> ClassOrSubjectCode<T>(
        this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("Code is required.")
            .MaximumLength(50)
            .Matches("^[A-Za-z0-9][A-Za-z0-9._-]*$")
                .WithMessage("Code may contain only letters, digits, dots, hyphens and underscores.");
}
