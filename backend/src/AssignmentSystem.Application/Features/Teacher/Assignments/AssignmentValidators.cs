using FluentValidation;

namespace AssignmentSystem.Application.Features.Teacher.Assignments;

public sealed class CreateAssignmentRequestValidator : AbstractValidator<CreateAssignmentRequest>
{
    public CreateAssignmentRequestValidator()
    {
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
