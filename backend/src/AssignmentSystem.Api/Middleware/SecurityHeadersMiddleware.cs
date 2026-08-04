namespace AssignmentSystem.Api.Middleware;

/// <summary>
/// Adds standard security response headers.
///
/// This is a JSON API rather than a site, so the headers that matter are the
/// ones stopping a response from being reinterpreted — sniffed as HTML, framed,
/// or leaked through a referrer.
/// </summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;

        // Never let a browser second-guess our declared content type; a JSON
        // response sniffed as HTML is how reflected XSS gets a foothold.
        headers["X-Content-Type-Options"] = "nosniff";

        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "no-referrer";

        // No browser feature is needed by an API.
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), interest-cohort=()";

        // Nothing here should ever be cached by a shared proxy: responses are
        // per-user and frequently contain grades.
        headers["Cache-Control"] = "no-store, no-cache, must-revalidate";

        await next(context);
    }
}
