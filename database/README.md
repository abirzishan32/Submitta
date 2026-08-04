# Database

PostgreSQL 14 or newer. Nothing here is provider-specific.

## You do not have to run any of this

The application creates its own schema. Point it at an **empty database**, start
it, and it will apply every migration and seed the demo data before it serves a
request. That is the intended path, and it is what the README describes.

This folder exists for the case where you would rather inspect or apply the
schema yourself.

## `schema.sql`

Every migration, in order, as one idempotent script. Each statement is wrapped
in a check against `__ef_migrations_history`, so running it twice is safe and
running it against a partially-migrated database applies only what is missing.

```bash
createdb assignment_system
psql -d assignment_system -f database/schema.sql
```

That creates 15 tables, three native enum types (`user_role`,
`assignment_status`, `submission_status`) and one more for the editor's event
log (`submission_event_type`), plus the indexes, check constraints and foreign
keys.

It does **not** insert any data. Start the API afterwards and the seeder fills
in the demo accounts, classes, subjects, assignments and submissions.

## Regenerating it

After adding a migration:

```bash
cd backend
dotnet ef migrations script --idempotent \
  --project src/AssignmentSystem.Infrastructure \
  --startup-project src/AssignmentSystem.Api \
  --output ../database/schema.sql
```

## Why there is no data dump

The seed data is written in C# (`DatabaseSeeder`) rather than as a SQL insert
script, because it has to hash passwords with BCrypt — a fixed hash in a
committed `.sql` file would either pin the work factor forever or ship a
password hash that cannot be changed without editing SQL by hand. The seeder is
idempotent: it inserts what is missing and leaves everything else alone, so it
is safe on every start.
