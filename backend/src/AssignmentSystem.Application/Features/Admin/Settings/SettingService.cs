using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Domain.Exceptions;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AssignmentSystem.Application.Features.Admin.Settings;

public sealed record SettingDto(
    Guid Id,
    string Key,
    string Value,
    string DataType,
    string? Description,
    bool IsPublic,
    DateTimeOffset? UpdatedAt);

public sealed record UpdateSettingRequest(string Value);

public sealed class UpdateSettingRequestValidator : AbstractValidator<UpdateSettingRequest>
{
    public UpdateSettingRequestValidator() =>
        RuleFor(x => x.Value)
            .NotNull().WithMessage("Value is required.")
            .MaximumLength(2000);
}

public interface ISettingService
{
    /// <summary>All settings. Admin only.</summary>
    Task<IReadOnlyList<SettingDto>> ListAsync(CancellationToken ct = default);

    /// <summary>
    /// Settings any signed-in user may read, whatever their role — as opposed to
    /// the full list, which is administrative. Still requires authentication:
    /// nothing here is served anonymously.
    /// </summary>
    Task<IReadOnlyList<SettingDto>> ListSharedAsync(CancellationToken ct = default);

    Task<SettingDto> UpdateAsync(string key, UpdateSettingRequest request, CancellationToken ct = default);
}

/// <summary>
/// Application-level settings, backing the admin duty "manage application-level
/// settings where necessary".
///
/// Keys are seeded rather than created through the API: a setting only matters
/// if some code reads it, so inventing arbitrary keys at runtime would just
/// accumulate rows nothing consults.
/// </summary>
public sealed class SettingService(
    IAppDbContext context,
    ICurrentUser currentUser,
    ILogger<SettingService> logger) : ISettingService
{
    public async Task<IReadOnlyList<SettingDto>> ListAsync(CancellationToken ct = default) =>
        await context.ApplicationSettings
            .AsNoTracking()
            .OrderBy(s => s.Key)
            .Select(s => new SettingDto(
                s.Id, s.Key, s.Value, s.DataType, s.Description, s.IsPublic, s.UpdatedAt))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<SettingDto>> ListSharedAsync(CancellationToken ct = default) =>
        await context.ApplicationSettings
            .AsNoTracking()
            .Where(s => s.IsPublic)
            .OrderBy(s => s.Key)
            .Select(s => new SettingDto(
                s.Id, s.Key, s.Value, s.DataType, s.Description, s.IsPublic, s.UpdatedAt))
            .ToListAsync(ct);

    public async Task<SettingDto> UpdateAsync(
        string key, UpdateSettingRequest request, CancellationToken ct = default)
    {
        var setting = await context.ApplicationSettings
            .FirstOrDefaultAsync(s => s.Key == key, ct)
            ?? throw new NotFoundException("Setting", key);

        var value = request.Value.Trim();

        // The declared DataType is a contract with whatever code reads this
        // setting, so a value that does not parse would break it at read time —
        // far from the change that caused it.
        if (!IsValidForType(value, setting.DataType, out var expected))
        {
            throw new BusinessRuleException(
                $"'{value}' is not a valid {setting.DataType} for setting '{key}'. Expected {expected}.");
        }

        setting.Value = value;
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Admin {AdminId} set '{Key}' to '{Value}'.",
            currentUser.UserId, key, value);

        return new SettingDto(
            setting.Id, setting.Key, setting.Value, setting.DataType,
            setting.Description, setting.IsPublic, setting.UpdatedAt);
    }

    private static bool IsValidForType(string value, string dataType, out string expected)
    {
        switch (dataType)
        {
            case "boolean":
                expected = "'true' or 'false'";
                return bool.TryParse(value, out _);

            case "integer":
                expected = "a whole number";
                return int.TryParse(value, out _);

            case "decimal":
                expected = "a number";
                return decimal.TryParse(value, out _);

            case "string":
                expected = "any text";
                return true;

            default:
                expected = "a known data type";
                return false;
        }
    }
}
