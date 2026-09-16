namespace AssignmentSystem.Infrastructure.Persistence;

/// <summary>
/// Closes the door this application never uses.
///
/// A hosted PostgreSQL such as Supabase publishes the <c>public</c> schema
/// through an auto-generated REST API (PostgREST). Anyone holding the project
/// URL and the anon key — which is designed to be public — can then read and
/// write every table over HTTP, going around this API and every authorization
/// rule in it. Row-Level Security is what PostgREST consults to decide whether
/// a row may be seen; with RLS off, everything is visible.
///
/// This application never uses that path. It connects straight to PostgreSQL
/// and enforces access in the API, so the correct posture is: RLS enabled on
/// every table, and <b>no policies at all</b>. No policy means no row matches,
/// which denies PostgREST completely. The owning database role bypasses RLS, so
/// the application itself is unaffected — that is what makes this safe to apply.
///
/// Adding permissive policies instead would be worse than leaving it off: it
/// would imply PostgREST is a supported way in, and every future table would
/// need a policy written correctly or silently leak.
/// </summary>
public static class PublicSchemaHardening
{
    /// <summary>
    /// Reports whether the connected role can still read its tables once RLS is
    /// on — true if it bypasses RLS, or owns every table in <c>public</c>.
    /// </summary>
    /// <remarks>
    /// Checked before hardening rather than after, because the failure mode is
    /// silent. A role subject to RLS with no policies does not get an error; it
    /// gets zero rows. The application would come up, sign nobody in, and show
    /// empty lists everywhere.
    /// </remarks>
    public const string CanSafelyEnableSql = """
        SELECT
            COALESCE((SELECT r.rolbypassrls OR r.rolsuper
                      FROM pg_roles r WHERE r.rolname = current_user), false)
            OR COALESCE((SELECT bool_and(pg_has_role(current_user, c.relowner, 'USAGE'))
                         FROM pg_class c
                         JOIN pg_namespace n ON n.oid = c.relnamespace
                         WHERE n.nspname = 'public' AND c.relkind = 'r'), true);
        """;

    /// <summary>
    /// Enables RLS on every ordinary table in <c>public</c>, and withdraws the
    /// REST API's roles from the schema entirely.
    /// </summary>
    /// <remarks>
    /// Written to be idempotent and to run anywhere: tables that already have
    /// RLS are skipped, and the role grants are only touched when those roles
    /// exist, so the same statement is a no-op on a plain local PostgreSQL.
    ///
    /// <c>FORCE ROW LEVEL SECURITY</c> is deliberately not used — it would
    /// apply the policies to the table owner as well, which is precisely the
    /// connection this application uses.
    /// </remarks>
    public const string HardenSql = """
        DO $harden$
        DECLARE
            target text;
            grantee text;
        BEGIN
            FOR target IN
                SELECT c.relname
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relkind = 'r'
                  AND NOT c.relrowsecurity
            LOOP
                EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
            END LOOP;

            -- Belt and braces. RLS alone already denies these roles every row;
            -- removing the grants as well means a policy added by accident
            -- later cannot re-open the schema on its own.
            FOREACH grantee IN ARRAY ARRAY['anon', 'authenticated']
            LOOP
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = grantee) THEN
                    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', grantee);
                    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', grantee);
                    EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', grantee);
                    EXECUTE format('REVOKE ALL ON SCHEMA public FROM %I', grantee);

                    -- Without this, the next table this role creates would be
                    -- granted to them again by default.
                    EXECUTE format(
                        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
                        grantee);
                    EXECUTE format(
                        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
                        grantee);
                END IF;
            END LOOP;
        END
        $harden$;
        """;

    /// <summary>Tables in <c>public</c> still without RLS, for verification.</summary>
    public const string UnprotectedCountSql = """
        SELECT count(*)
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
        """;
}
