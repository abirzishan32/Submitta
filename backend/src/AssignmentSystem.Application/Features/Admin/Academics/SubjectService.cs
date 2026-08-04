using System.Linq.Expressions;
using AssignmentSystem.Application.Common.Extensions;
using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Application.Features.Admin.Academics;

public interface ISubjectService
{
    Task<PagedResult<SubjectDto>> ListAsync(SubjectListQuery query, CancellationToken ct = default);
    Task<SubjectDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<SubjectDto> CreateAsync(CreateSubjectRequest request, CancellationToken ct = default);
    Task<SubjectDto> UpdateAsync(Guid id, UpdateSubjectRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public sealed class SubjectService(IAppDbContext context) : ISubjectService
{
    private static readonly Dictionary<string, Expression<Func<Subject, object>>> Sortable = new()
    {
        ["name"] = s => s.Name,
        ["code"] = s => s.Code,
        ["createdAt"] = s => s.CreatedAt
    };

    public async Task<PagedResult<SubjectDto>> ListAsync(
        SubjectListQuery query, CancellationToken ct = default)
    {
        var subjects = context.Subjects.AsNoTracking();

        if (query.IsActive is { } isActive)
        {
            subjects = subjects.Where(s => s.IsActive == isActive);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            subjects = subjects.Where(s =>
                s.Name.ToLower().Contains(term) || s.Code.ToLower().Contains(term));
        }

        return await subjects
            .ApplySort(query.SortBy, query.SortDescending, Sortable, s => s.Name)
            .ToPagedResultAsync(query, Projection, ct);
    }

    public async Task<SubjectDto> GetAsync(Guid id, CancellationToken ct = default) =>
        await context.Subjects
            .AsNoTracking()
            .Where(s => s.Id == id)
            .Select(Projection)
            .FirstOrDefaultAsync(ct)
        ?? throw new NotFoundException("Subject", id);

    public async Task<SubjectDto> CreateAsync(
        CreateSubjectRequest request, CancellationToken ct = default)
    {
        var code = request.Code.Trim();

        if (await context.Subjects.AnyAsync(s => s.Code == code, ct))
        {
            throw new ConflictException($"A subject with code '{code}' already exists.");
        }

        var entity = new Subject
        {
            Name = request.Name.Trim(),
            Code = code,
            Description = request.Description?.Trim(),
            IsActive = true
        };

        context.Subjects.Add(entity);
        await context.SaveChangesAsync(ct);

        return await GetAsync(entity.Id, ct);
    }

    public async Task<SubjectDto> UpdateAsync(
        Guid id, UpdateSubjectRequest request, CancellationToken ct = default)
    {
        var entity = await context.Subjects.FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new NotFoundException("Subject", id);

        var code = request.Code.Trim();

        if (code != entity.Code && await context.Subjects.AnyAsync(s => s.Code == code, ct))
        {
            throw new ConflictException($"A subject with code '{code}' already exists.");
        }

        entity.Name = request.Name.Trim();
        entity.Code = code;
        entity.Description = request.Description?.Trim();
        entity.IsActive = request.IsActive;

        await context.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await context.Subjects.FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new NotFoundException("Subject", id);

        if (await context.ClassSubjects.AnyAsync(cs => cs.SubjectId == id, ct))
        {
            throw new ConflictException(
                "This subject is offered to one or more classes. Remove those offerings first, "
                + "or deactivate the subject instead.");
        }

        context.Subjects.Remove(entity);
        await context.SaveChangesAsync(ct);
    }

    private static readonly Expression<Func<Subject, SubjectDto>> Projection = s => new SubjectDto(
        s.Id, s.Name, s.Code, s.Description, s.IsActive, s.ClassSubjects.Count, s.CreatedAt);
}
