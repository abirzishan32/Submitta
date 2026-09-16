using System.Linq.Expressions;
using AssignmentSystem.Application.Common.Models;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Application.Common.Extensions;

/// <summary>
/// Paging and sorting helpers shared by every list endpoint.
/// </summary>
public static class QueryableExtensions
{
    /// <summary>
    /// Counts the full result set, then returns the requested page.
    ///
    /// The count runs before paging so the client can render "page 3 of 12";
    /// both statements go to the database, neither materialises the whole table.
    /// </summary>
    public static async Task<PagedResult<TResult>> ToPagedResultAsync<TSource, TResult>(
        this IQueryable<TSource> query,
        PaginationQuery pagination,
        Expression<Func<TSource, TResult>> selector,
        CancellationToken ct = default)
    {
        var totalCount = await query.CountAsync(ct);

        var items = await query
            .Skip(pagination.Skip)
            .Take(pagination.PageSize)
            .Select(selector)
            .ToListAsync(ct);

        return PagedResult<TResult>.Create(items, pagination.Page, pagination.PageSize, totalCount);
    }

    /// <summary>
    /// Applies a sort chosen from a whitelist.
    ///
    /// The caller supplies a map of permitted sort keys to expressions, so an
    /// arbitrary <c>?sortBy=</c> value can never reach reflection or raw SQL —
    /// an unrecognised key silently falls back to the default ordering.
    /// </summary>
    public static IQueryable<T> ApplySort<T>(
        this IQueryable<T> query,
        string? sortBy,
        bool descending,
        IReadOnlyDictionary<string, Expression<Func<T, object>>> allowed,
        Expression<Func<T, object>> defaultSort)
    {
        var selector = defaultSort;
        var useDescending = descending;

        if (!string.IsNullOrWhiteSpace(sortBy) &&
            allowed.TryGetValue(sortBy.Trim(), out var match))
        {
            selector = match;
        }
        else if (string.IsNullOrWhiteSpace(sortBy))
        {
            // No explicit sort: newest first reads better than oldest first for
            // every list in this application.
            useDescending = descending;
        }

        return useDescending
            ? query.OrderByDescending(selector)
            : query.OrderBy(selector);
    }
}
