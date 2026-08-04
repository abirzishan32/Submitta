using Microsoft.OpenApi.Models;

namespace AssignmentSystem.Api.Configuration;

/// <summary>
/// Swagger/OpenAPI wiring, including the bearer scheme so a reviewer can paste a
/// JWT into the "Authorize" dialog and exercise the API as Admin, Teacher or
/// Student without needing a REST client.
/// </summary>
public static class SwaggerSetup
{
    public static IServiceCollection AddSwaggerDocumentation(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();

        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "Assignment & Submission Management API",
                Version = "v1",
                Description =
                    "Role-based assignment and submission system for schools and colleges.\n\n" +
                    "**Getting started:** call `POST /api/v1/auth/login` with one of the demo " +
                    "accounts from the README, copy the `accessToken` from the response, then " +
                    "click **Authorize** above and paste it. All protected endpoints will then " +
                    "carry your role.\n\n" +
                    "Authorization is enforced server-side on every endpoint — the role is read " +
                    "from the signed token, never from the request."
            });

            var scheme = new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description = "Paste only the token itself — Swagger adds the \"Bearer \" prefix.",
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            };

            options.AddSecurityDefinition("Bearer", scheme);
            options.AddSecurityRequirement(new OpenApiSecurityRequirement { [scheme] = [] });

            // Surface the XML doc comments written on controllers and DTOs.
            var xmlPath = Path.Combine(AppContext.BaseDirectory,
                $"{typeof(SwaggerSetup).Assembly.GetName().Name}.xml");
            if (File.Exists(xmlPath))
            {
                options.IncludeXmlComments(xmlPath);
            }
        });

        return services;
    }
}
