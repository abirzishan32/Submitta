using FluentValidation;

namespace AssignmentSystem.Application.Features.Student;

/// <summary>
/// Rules shared by submitting and updating an answer, so the two cannot drift.
/// </summary>
internal static class SubmissionRules
{
    public static IRuleBuilderOptions<T, string> AnswerContent<T>(
        this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("Your answer cannot be empty.")
            .MaximumLength(50_000).WithMessage("Your answer cannot exceed 50,000 characters.");

    /// <summary>
    /// The rich document behind the answer. Bounded well above the plain-text
    /// limit, since the same words carry structure and marks as JSON.
    /// </summary>
    public static IRuleBuilderOptions<T, string?> RichContent<T>(
        this IRuleBuilder<T, string?> rule) =>
        rule.MaximumLength(2_000_000)
            .WithMessage("The document is too large to store.");

    public static IRuleBuilderOptions<T, string?> AttachmentLink<T>(
        this IRuleBuilder<T, string?> rule) =>
        rule.MaximumLength(2048)
            .Must(url => string.IsNullOrWhiteSpace(url)
                         || (Uri.TryCreate(url, UriKind.Absolute, out var uri)
                             && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)))
            // Restricted to http/https so a submission cannot carry a
            // javascript: or file: URI that a teacher's browser might follow.
            .WithMessage("Attachment must be a valid http or https link.");
}

public sealed class SubmitAssignmentRequestValidator : AbstractValidator<SubmitAssignmentRequest>
{
    public SubmitAssignmentRequestValidator()
    {
        RuleFor(x => x.Content).AnswerContent();
        RuleFor(x => x.AttachmentUrl).AttachmentLink();
        RuleFor(x => x.ContentJson).RichContent();
    }
}

public sealed class UpdateSubmissionRequestValidator : AbstractValidator<UpdateSubmissionRequest>
{
    public UpdateSubmissionRequestValidator()
    {
        RuleFor(x => x.Content).AnswerContent();
        RuleFor(x => x.AttachmentUrl).AttachmentLink();
        RuleFor(x => x.ContentJson).RichContent();
    }
}

public sealed class DeleteAccountRequestValidator : AbstractValidator<DeleteAccountRequest>
{
    /// <summary>
    /// The sentence a student must type to close their own account. Compared
    /// exactly (after trimming surrounding whitespace only) rather than
    /// case-insensitively — it is meant to take a moment of deliberate typing,
    /// not to be satisfied by whatever a browser's autofill happens to offer.
    /// </summary>
    public const string RequiredPhrase = "I want to delete my account";

    public DeleteAccountRequestValidator()
    {
        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Enter your password to confirm it's you.");

        RuleFor(x => x.Confirmation)
            .Must(text => text.Trim() == RequiredPhrase)
            .WithMessage($"Type \"{RequiredPhrase}\" exactly to confirm.");
    }
}
