# syntax=docker/dockerfile:1

# ===========================================================================
# Submitta API — ASP.NET Core 9
#
# Two stages. The SDK stage compiles and publishes; the runtime stage carries
# only the published output on the ASP.NET runtime image, so the shipped image
# holds no compiler, no NuGet cache and no source.
#
# Build context is `backend/`. See backend/.dockerignore for what is excluded —
# `.env` in particular, which must never reach an image layer.
# ===========================================================================

# --- Build -----------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build

WORKDIR /src

# Restore from the project manifests alone, before any source is copied. The
# restore layer then survives every edit that does not change a dependency,
# which is the difference between a two-second rebuild and a two-minute one.
#
# Directory.Build.props belongs to this set: it defines TargetFramework for
# every project, and without it the .csproj files have no framework to restore
# against.
COPY AssignmentSystem.sln Directory.Build.props ./
COPY src/AssignmentSystem.Domain/AssignmentSystem.Domain.csproj                 src/AssignmentSystem.Domain/
COPY src/AssignmentSystem.Application/AssignmentSystem.Application.csproj       src/AssignmentSystem.Application/
COPY src/AssignmentSystem.Infrastructure/AssignmentSystem.Infrastructure.csproj src/AssignmentSystem.Infrastructure/
COPY src/AssignmentSystem.Api/AssignmentSystem.Api.csproj                       src/AssignmentSystem.Api/
COPY tests/AssignmentSystem.UnitTests/AssignmentSystem.UnitTests.csproj         tests/AssignmentSystem.UnitTests/

RUN dotnet restore AssignmentSystem.sln

COPY . .

# --- Test ------------------------------------------------------------------
# Not part of the runtime image's dependency chain, so a normal build never
# pays for it. Run the suite on the same SDK the image compiles with:
#
#   docker build --target test ./backend
#
FROM build AS test
RUN dotnet test AssignmentSystem.sln --configuration Release --no-restore

# --- Publish ---------------------------------------------------------------
FROM build AS publish

# UseAppHost=false skips the native launcher; the image starts the assembly
# through `dotnet`, so a platform-specific executable is dead weight.
RUN dotnet publish src/AssignmentSystem.Api/AssignmentSystem.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish \
    -p:UseAppHost=false

# --- Runtime ---------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime

# curl is here for the container health check and nothing else. The runtime
# image ships without an HTTP client, and a health check that cannot make a
# request is a health check that always reports healthy.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=publish /app/publish ./

# Serilog writes a rolling file under ./logs. Created and handed to the
# non-root user up front, because a container that cannot open its log sink
# fails at startup rather than quietly running without logs.
RUN mkdir -p /app/logs && chown -R app:app /app

# The ASP.NET images ship a non-root `app` user (uid 1654). Using it means a
# container escape lands on an unprivileged account.
USER app

# Kestrel binds 8080 on all interfaces. The port is internal to the Docker
# network; compose publishes it on the host under a different number.
ENV ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_RUNNING_IN_CONTAINER=true

EXPOSE 8080

# /health is deliberately anonymous — see Program.cs. start-period covers the
# first run, where the container applies migrations and seeds before listening.
HEALTHCHECK --interval=15s --timeout=3s --start-period=90s --retries=5 \
    CMD curl --fail --silent http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "AssignmentSystem.Api.dll"]
