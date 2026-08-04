using FluentValidation;

namespace AssignmentSystem.Application.Features.Teacher.Grading;

public sealed class GradeSubmissionRequestValidator : AbstractValidator<GradeSubmissionRequest>
{
    public GradeSubmissionRequestValidator()
    {
        // Only the lower bound can be checked here. The ceiling is the parent
        // assignment's MaxMarks, which the validator cannot see, so the service
        // enforces it.
        RuleFor(x => x.Marks)
            .GreaterThanOrEqualTo(0).WithMessage("Marks cannot be negative.");

        RuleFor(x => x.Feedback)
            .MaximumLength(5000).WithMessage("Feedback cannot exceed 5000 characters.");
    }
}

public sealed class AddFeedbackRequestValidator : AbstractValidator<AddFeedbackRequest>
{
    public AddFeedbackRequestValidator() =>
        RuleFor(x => x.Comment)
            .NotEmpty().WithMessage("Comment is required.")
            .MaximumLength(5000);
}

public sealed class ChangeSubmissionStatusRequestValidator
    : AbstractValidator<ChangeSubmissionStatusRequest>
{
    public ChangeSubmissionStatusRequestValidator()
    {
        RuleFor(x => x.Status)
            .IsInEnum().WithMessage("Unknown submission status.");

        RuleFor(x => x.Comment)
            .MaximumLength(5000);
    }
}
