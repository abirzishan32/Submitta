using AssignmentSystem.Domain.Enums;
using FluentValidation;

namespace AssignmentSystem.Application.Features.Auth;

/// <summary>
/// Password rules, in one place.
///
/// Registration and password change have to agree: a rule enforced on one and
/// not the other is a rule that can be walked around.
/// </summary>
internal static class PasswordRules
{
    public static IRuleBuilderOptions<T, string> Password<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("Password is required.")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters.")
            // Bounded because BCrypt silently ignores anything past 72 bytes;
            // a longer limit would promise strength the algorithm cannot give.
            .MaximumLength(72).WithMessage("Password cannot exceed 72 characters.")
            .Matches("[A-Z]").WithMessage("Password must contain an uppercase letter.")
            .Matches("[a-z]").WithMessage("Password must contain a lowercase letter.")
            .Matches("[0-9]").WithMessage("Password must contain a digit.");
}

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Enter a valid email address.")
            .MaximumLength(256);

        // Only presence is checked here. Applying complexity rules to a login
        // attempt would leak which passwords could possibly be valid.
        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required.");
    }
}

public sealed class RefreshRequestValidator : AbstractValidator<RefreshRequest>
{
    public RefreshRequestValidator() =>
        RuleFor(x => x.RefreshToken).NotEmpty().WithMessage("Refresh token is required.");
}

public sealed class LogoutRequestValidator : AbstractValidator<LogoutRequest>
{
    public LogoutRequestValidator() =>
        RuleFor(x => x.RefreshToken).NotEmpty().WithMessage("Refresh token is required.");
}

public sealed class ChangePasswordRequestValidator : AbstractValidator<ChangePasswordRequest>
{
    public ChangePasswordRequestValidator()
    {
        RuleFor(x => x.CurrentPassword)
            .NotEmpty().WithMessage("Current password is required.");

        RuleFor(x => x.NewPassword)
            .Password()
            .NotEqual(x => x.CurrentPassword)
                .WithMessage("New password must differ from the current one.");
    }
}

public sealed class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Your name is required.")
            .MinimumLength(2).WithMessage("Enter your full name.")
            .MaximumLength(150);

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Enter a valid email address.")
            .MaximumLength(256);

        RuleFor(x => x.Password).Password();

        RuleFor(x => x.ConfirmPassword)
            .Equal(x => x.Password).WithMessage("The two passwords do not match.");

        // Administrators are never self-registered. Checked here as well as in
        // the service so a malformed role is rejected before any work happens.
        RuleFor(x => x.Role)
            .Must(role => role is UserRole.Student or UserRole.Teacher)
            .WithMessage("You can register as a student or a teacher.");
    }
}
