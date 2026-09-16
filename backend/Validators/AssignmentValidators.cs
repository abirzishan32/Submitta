using FluentValidation;

namespace AssignmentSystem.Application.Features.Teacher.Assignments;

public sealed class CreateAssignmentRequestValidator : AbstractValidator<CreateAssignmentRequest>
{
    public CreateAssignmentRequestValidator()
    {
        RuleFor(x => x.Rubric).Rubric();
        RuleFor(x => x.DescriptionJson).RichDescription();
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title is required.")
            .MaximumLength(200);

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required.")
            .MaximumLength(10_000);

        RuleFor(x => x.ClassSubjectId)
            .NotEmpty().WithMessage("Select a class and subject.");

        RuleFor(x => x.MaxMarks)
            .GreaterThan(0).WithMessage("Maximum marks must be greater than zero.")
            .LessThanOrEqualTo(1000).WithMessage("Maximum marks cannot exceed 1000.");

        // A deadline already in the past is only rejected when publishing.
        // A draft may legitimately be prepared with a date that is fixed later,
        // so the check lives in the service where publish state is known.
        RuleFor(x => x.Deadline)
            .NotEmpty().WithMessage("Deadline is required.");
    }
}

public sealed class UpdateAssignmentRequestValidator : AbstractValidator<UpdateAssignmentRequest>
{
    public UpdateAssignmentRequestValidator()
    {
        RuleFor(x => x.Rubric).Rubric();
        RuleFor(x => x.DescriptionJson).RichDescription();
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title is required.")
            .MaximumLength(200);

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required.")
            .MaximumLength(10_000);

        RuleFor(x => x.MaxMarks)
            .GreaterThan(0).WithMessage("Maximum marks must be greater than zero.")
            .LessThanOrEqualTo(1000).WithMessage("Maximum marks cannot exceed 1000.");

        RuleFor(x => x.Deadline)
            .NotEmpty().WithMessage("Deadline is required.");
    }
}

/// <summary>
/// Rules a rubric line must satisfy whichever request it arrives on.
/// </summary>
internal static class RubricRules
{
    public static IRuleBuilderOptions<T, IReadOnlyList<RubricCriterionInput>?> Rubric<T>(
        this IRuleBuilder<T, IReadOnlyList<RubricCriterionInput>?> rule) =>
        rule.Must(r => r is null || r.Count <= 20)
                .WithMessage("A rubric of more than 20 criteria is unusable to mark against.")
            .Must(r => r is null || r.All(c => !string.IsNullOrWhiteSpace(c.Title)))
                .WithMessage("Every rubric criterion needs a name.")
            .Must(r => r is null || r.All(c => c.Title.Length <= 200))
                .WithMessage("A criterion name cannot exceed 200 characters.")
            .Must(r => r is null || r.All(c => c.Description is null || c.Description.Length <= 1000))
                .WithMessage("A criterion description cannot exceed 1000 characters.")
            .Must(r => r is null || r.All(c => c.MaxPoints > 0 && c.MaxPoints <= 1000))
                .WithMessage("Each criterion must be worth between 0 and 1000 marks.");

    /// <summary>
    /// The brief written in the editor. Bounded well above the plain-text limit
    /// because the same words carry structure and marks as JSON.
    /// </summary>
    public static IRuleBuilderOptions<T, string?> RichDescription<T>(
        this IRuleBuilder<T, string?> rule) =>
        rule.MaximumLength(2_000_000).WithMessage("The brief is too large to store.");
}
