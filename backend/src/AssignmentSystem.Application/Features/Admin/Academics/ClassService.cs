using System.Linq.Expressions;
using AssignmentSystem.Application.Common.Extensions;
using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Application.Features.Admin.Academics;

public interface IClassService
{
    Task<PagedResult<ClassDto>> ListAsync(ClassListQuery query, CancellationToken ct = default);
    Task<ClassDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<ClassDto> CreateAsync(CreateClassRequest request, CancellationToken ct = default);
    Task<ClassDto> UpdateAsync(Guid id, UpdateClassRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public sealed class ClassService(IAppDbContext context) : IClassService
{
    private static readonly Dictionary<string, Expression<Func<Class, object>>> Sortable = new()
    {
        ["name"] = c => c.Name,
        ["code"] = c => c.Code,
        ["academicYear"] = c => c.AcademicYear!,
        ["createdAt"] = c => c.CreatedAt
    };

    public async Task<PagedResult<ClassDto>> ListAsync(
        ClassListQuery query, CancellationToken ct = default)
    {
        var classes = context.Classes.AsNoTracking();

        if (query.IsActive is { } isActive)
        {
            classes = classes.Where(c => c.IsActive == isActive);
        }

        if (!string.IsNullOrWhiteSpace(query.AcademicYear))
        {
            classes = classes.Where(c => c.AcademicYear == query.AcademicYear);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            classes = classes.Where(c =>
                c.Name.ToLower().Contains(term) || c.Code.ToLower().Contains(term));
        }

        return await classes
            .ApplySort(query.SortBy, query.SortDescending, Sortable, c => c.Name)
            .ToPagedResultAsync(query, Projection, ct);
    }

    public async Task<ClassDto> GetAsync(Guid id, CancellationToken ct = default) =>
        await context.Classes
            .AsNoTracking()
            .Where(c => c.Id == id)
            .Select(Projection)
            .FirstOrDefaultAsync(ct)
        ?? throw new NotFoundException("Class", id);

    public async Task<ClassDto> CreateAsync(
        CreateClassRequest request, CancellationToken ct = default)
    {
        var code = request.Code.Trim();

        if (await context.Classes.AnyAsync(c => c.Code == code, ct))
        {
            throw new ConflictException($"A class with code '{code}' already exists.");
        }

        var entity = new Class
        {
            Name = request.Name.Trim(),
            Code = code,
            Description = request.Description?.Trim(),
            AcademicYear = request.AcademicYear?.Trim(),
            IsActive = true
        };

        context.Classes.Add(entity);
        await context.SaveChangesAsync(ct);

        return await GetAsync(entity.Id, ct);
    }

    public async Task<ClassDto> UpdateAsync(
        Guid id, UpdateClassRequest request, CancellationToken ct = default)
    {
        var entity = await context.Classes.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundException("Class", id);

        var code = request.Code.Trim();

        if (code != entity.Code && await context.Classes.AnyAsync(c => c.Code == code, ct))
        {
            throw new ConflictException($"A class with code '{code}' already exists.");
        }

        entity.Name = request.Name.Trim();
        entity.Code = code;
        entity.Description = request.Description?.Trim();
        entity.AcademicYear = request.AcademicYear?.Trim();
        entity.IsActive = request.IsActive;

        await context.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await context.Classes.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundException("Class", id);

        // Deleting a class with offerings would strand their assignments and
        // grades. Deactivating is the reversible way to retire a class.
        if (await context.ClassSubjects.AnyAsync(cs => cs.ClassId == id, ct))
        {
            throw new ConflictException(
                "This class still has subjects assigned. Remove them first, or deactivate the class instead.");
        }

        if (await context.Enrollments.AnyAsync(e => e.ClassId == id, ct))
        {
            throw new ConflictException(
                "This class still has enrolled students. Remove the enrolments first, or deactivate the class instead.");
        }

        context.Classes.Remove(entity);
        await context.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Counts are computed in SQL rather than by loading collections, so the
    /// list endpoint stays a single query regardless of page size.
    /// </summary>
    private static readonly Expression<Func<Class, ClassDto>> Projection = c => new ClassDto(
        c.Id,
        c.Name,
        c.Code,
        c.Description,
        c.AcademicYear,
        c.IsActive,
        c.Enrollments.Count,
        c.ClassSubjects.Count,
        c.CreatedAt);
}
