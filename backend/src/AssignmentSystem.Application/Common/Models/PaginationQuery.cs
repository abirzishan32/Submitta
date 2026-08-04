namespace AssignmentSystem.Application.Common.Models;

/// <summary>
/// Base query string parameters shared by every list endpoint. Page size is
/// clamped here rather than trusted, so a client cannot request 10 000 rows.
/// </summary>
public class PaginationQuery
{
    public const int MaxPageSize = 100;

    private int _page = 1;
    private int _pageSize = 20;

    /// <summary>1-based page number.</summary>
    public int Page
    {
        get => _page;
        set => _page = value < 1 ? 1 : value;
    }

    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value switch
        {
            < 1 => 1,
            > MaxPageSize => MaxPageSize,
            _ => value
        };
    }

    /// <summary>Free-text search term. Interpretation is per-endpoint.</summary>
    public string? Search { get; set; }

    /// <summary>Property to sort by. Endpoints whitelist the allowed names.</summary>
    public string? SortBy { get; set; }

    public bool SortDescending { get; set; }

    public int Skip => (Page - 1) * PageSize;
}
