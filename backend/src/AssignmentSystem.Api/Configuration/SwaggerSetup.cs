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
                Title = "Submitta API",
                Version = "v1",
                Description =
                    "Role based assignment and submission system for schools and colleges.\n"
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
