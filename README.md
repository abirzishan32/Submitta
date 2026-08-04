# Submitta — Assignment & Submission Management

A role-based system for schools and colleges: teachers set coursework for a
class and subject, students submit and revise it, and teachers return marks and
feedback. Built for the OnnoRokom Projukti Assistant Software Engineer
assignment.

**ASP.NET Core 9 Web API · PostgreSQL · Next.js 16 · TypeScript · xUnit**

---

## Contents

- [Quick start](#quick-start)
- [Demo credentials](#demo-credentials)
- [Accounts and authentication](#accounts-and-authentication)
- [Main features](#main-features)
- [The writing editor and replay](#the-writing-editor-and-replay)
- [Notifications](#notifications)
- [Database security](#database-security)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Project structure](#project-structure)
- [Setup on macOS](#setup-on-macos)
- [Database setup](#database-setup)
- [Running the backend](#running-the-backend)
- [Running the frontend](#running-the-frontend)
- [Running the tests](#running-the-tests)
- [API](#api)
- [Troubleshooting](#troubleshooting)
- [Assumptions](#assumptions)
- [Known limitations](#known-limitations)
- [Future improvements](#future-improvements)

---

## Quick start

You need [.NET 9 SDK](https://dotnet.microsoft.com/download),
[Node.js 20+](https://nodejs.org) and a running **PostgreSQL 14+**.

**1. Create an empty database.** That is the only database work required — the
application creates every table itself on first run.

```bash
createdb assignment_system
```

**2. Point the API at it.**

```bash
cp backend/.env.example backend/.env
```

Then edit one line in `backend/.env` — `ConnectionStrings__DefaultConnection` —
so the username, password and database name match your PostgreSQL.

**3. Start the API.** It applies every migration and seeds the demo data before
serving a request.

```bash
dotnet run --project backend/src/AssignmentSystem.Api
```

**4. Start the frontend**, in a second terminal.

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

| | |
|---|---|
| **Application** | <http://localhost:3000> |
| **API (Swagger)** | <http://localhost:5062/swagger> |

Sign in with any account below — the sign-in page lists them, and one click
fills the form. Or create your own account from **Create an account**.

---

## Demo credentials

All accounts share the password **`Demo@1234`**.

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@school.edu` | `Demo@1234` |
| **Teacher** | `sarah.ahmed@school.edu` | `Demo@1234` |
| **Student** | `nadia.islam@school.edu` | `Demo@1234` |

Three more accounts exist, and they are worth using — the seed data is built to
demonstrate the access rules rather than just to fill tables:

| Email | Why it is there |
|---|---|
| `rafiq.hasan@school.edu` | A **second teacher**, with a class Sarah does not teach. Sign in as Sarah and you cannot see or touch Rafiq's assignment — that is the authorization boundary, demonstrable in the UI. |
| `tanvir.rahman@school.edu` | A student whose work is **already graded** (85/100 with feedback), so the marked state is visible without grading anything first. |
| `mim.chowdhury@school.edu` | A student in the college course, whose assignment is **past its deadline but accepts late work**. |

The seeded assignments likewise cover each state: a draft (invisible to
students), an open assignment, one due shortly, and one past its deadline.

> These are throwaway demo credentials, published deliberately. Real secrets live
> in `backend/.env`, which is git-ignored; only `.env.example` is committed.

---

## Accounts and authentication

### Creating an account

**Create an account** on the sign-in page opens a real sign-up form. It is not a
demo shortcut — it writes a user, hashes the password with BCrypt, and starts a
session.

Who may register, and on what terms, follows from what each role can reach:

| Role | Self-registration |
|---|---|
| **Student** | Open. Signed in immediately. May pick a class during sign-up, and then sees its coursework at once; an administrator can change the enrolment later. |
| **Teacher** | Open, but the account is created **deactivated**. Being a teacher grants access to other people's work and the power to award marks, so the claim is approved by an administrator before it grants anything. |
| **Admin** | Never. An administrator account is only ever created by another administrator. |

A pending teacher who tries to sign in is told their account is awaiting
approval — not "invalid email or password". The generic message guards the
enumeration boundary, and that boundary is the password: someone who has already
supplied the right password has proved the account is theirs, so withholding the
reason only sends them hunting for a typo that is not there.

An administrator approves a teacher from **Users** → the account → activate.

### Turning registration off

Three seeded application settings control it, editable under **Settings**:

| Key | Default | Effect |
|---|---|---|
| `auth.allow_self_registration` | `true` | Master switch. When off, the sign-up form refuses and the sign-in page stops linking to it. |
| `auth.allow_teacher_registration` | `true` | Whether the form offers the teacher role at all. |
| `auth.teacher_requires_approval` | `true` | Whether new teacher accounts start deactivated. |

If any of these rows is missing, the code treats it as **off**. A missing setting
must never be the reason someone gets an account they should not have.

### How sessions work

- Passwords are hashed with **BCrypt** at work factor 12, never stored or logged
- Sign-in returns a short-lived **access token** and a longer-lived **refresh
  token**; the refresh token is stored only as a SHA-256 hash
- Refresh **rotates** the token. Presenting an already-rotated one is treated as
  a replay and revokes every session for that user
- The browser never holds a token: they live in **httpOnly cookies** set by a
  Next.js route handler, and client components reach the API through a
  server-side proxy that attaches the token for them
- Changing a password revokes every existing session
- Sign-in, registration and refresh are rate limited to ten attempts per minute
  per IP

---

## Main features

### Admin
- Create, edit, activate/deactivate and delete user accounts; reset a password
  (which also signs that account out everywhere)
- Manage classes/courses and subjects
- Decide which subjects a class is taught, and assign teachers to them
- Enrol students individually or several at once
- Approve teacher accounts created through sign-up
- Manage application-level settings, including whether registration is open
- Read every assignment and submission in the system, from **Assignments** and
  **Submissions**

### Teacher
- Create, update and delete assignments for their own classes
- Set title, description, deadline and maximum marks
- Keep work as a draft, or publish it
- Archive work instead of deleting it once students have submitted
- Review submissions, and see which enrolled students have *not* submitted
- Award marks with feedback, and change a submission's status

### Student
- See published assignments for the classes they are enrolled in
- View assignment details and deadline
- Write the answer in a rich document editor (see [The writing editor](#the-writing-editor-and-replay))
- Attach an optional link alongside the answer
- Revise a submission before the deadline, where the assignment allows it
- View submission status, marks and teacher feedback

### Throughout
- **Live notifications** — a bell that updates without a refresh, covering new
  assignments, approaching deadlines, submissions and marks
- **Self-registration** for students and teachers, with administrator approval
  for teachers — see [Accounts and authentication](#accounts-and-authentication)
- **JWT authentication** with refresh-token rotation and reuse detection
- **Role-based authorization** enforced server-side on every request
- **English / Bangla** interface, including Bengali numerals and dates
- **Light / dark theme** following the system setting by default
- Paging, search, sorting and filtering on every list
- Responsive layout, keyboard-navigable, with loading and empty states

### The rules that matter

Role membership is only half the story — most of the real rules depend on data,
not on a role name:

- A teacher can only reach offerings they are assigned to. Reading another
  teacher's assignment returns **404, not 403** — confirming that it exists is
  itself a disclosure.
- Students never see drafts, and never see another student's submission.
- One submission per student per assignment, enforced by a unique index as well
  as a service check, so two concurrent requests cannot both slip through.
- After the deadline, a first submission is accepted only if the assignment
  allows late work — and is then flagged. Lateness is stamped at submission
  time, so moving the deadline afterwards cannot make anyone retroactively late.
- Editing an answer requires being before the deadline, ungraded, and either
  permitted by the assignment or explicitly returned for revision. The deadline
  always wins.
- Marks must fall between zero and the assignment's maximum, and that maximum
  cannot later drop below marks already awarded.
- Work that has submissions can be archived but not deleted or unpublished, so
  no student's marks are ever hidden or destroyed.
- The last active administrator cannot be deactivated or deleted.

All of the above are covered by tests — see [Running the tests](#running-the-tests).

---

## The writing editor and replay

Students write in a block editor built on **Tiptap** rather than a textarea:
headings, lists, tables, quotes, callouts, task lists, syntax-highlighted code,
a `/` command palette, an outline sidebar, focus and fullscreen modes.

While they write, the editor keeps an **operation log**. A teacher can then
replay how the submission was written.

### Why an event log rather than a screen recording

The log is read from **ProseMirror transactions** — the editor's own description
of what changed. That has three consequences a video does not:

- **It seeks instantly.** Rebuilding the document to any point is a fold over
  the events up to that point, so scrubbing backwards costs the same as
  forwards, and playback runs at 0.5× to 16×.
- **It knows what typing *is*.** A paste is a different operation from a run of
  keystrokes, so pasted passages are marked in the replay rather than inferred.
- **It is small.** Consecutive typing in one place is coalesced into a single
  event carrying the run, and events are batched to the server rather than sent
  per keystroke. An essay lands in the low thousands of events.

### What the teacher sees

The grading screen carries a **How this was written** card — time spent, words
typed, words pasted — and one action that opens a full-screen workspace. It
takes the whole viewport deliberately: reading how something was written is a
different task from filling in a form, and it does not fit beside one.

The workspace has two views.

**Replay** rebuilds the document as it was written, with pasted passages
highlighted where they landed. Below it is an activity strip — writing,
revising, pasting, paused, away from the tab — that doubles as the scrubber, so
"what happened here?" and "take me there" are the same click. Playback runs
from 1× to 32×, and space, arrows and Escape work as expected.

**Analytics** is a dashboard of charts:

| Chart | What it answers |
|---|---|
| **How the document grew** | The one that matters. Typing is a slope, a paste is a cliff. The silhouette says more than any percentage. |
| **Pace over the session** | Where the writing sped up, slowed, or stopped, with pasted buckets shaded. |
| **Session shape** | The same activity strip, enlarged, beside pause and session figures. |
| **Where the words came from** | Typed against pasted, as one bar. |
| **What the time went on** | Recorded actions grouped by kind. |
| **Large pastes** | Every block of 40+ words, with a preview. Selecting one seeks the replay to it. |

Every chart is clickable and seeks the replay, so a teacher moves from "that
looks odd" to watching it happen without hunting for the moment.

Marking is a drawer, hidden until asked for, so the default state is reading
rather than form-filling — and a mark can be awarded without leaving what was
just watched.

The charts are drawn as plain SVG against the theme tokens: no charting
dependency, and both light and dark work without a second palette. Statistics
come from the log on read, so they can never drift from the operations that
produced them.

**On how this is framed.** A high paste percentage has innocent explanations —
notes drafted elsewhere, a quotation, an assistive tool. The panel reports the
numbers and shows which passages arrived how; it does not accuse, and it does
not score anyone's integrity. The judgement belongs to the teacher, who has
context the system does not.

### Saving

- Autosaves two seconds after typing stops; ⌘S saves and marks a **version**
- Versions can be listed and restored; restoring adds a new version rather than
  erasing the ones after it, so the trail shows that a restore happened
- Before a submission exists there is nothing on the server to record against,
  so the document is kept in the browser and handed over — log and all — when
  the student submits. The replay therefore starts at the first keystroke
- Reopening a submission resumes the existing log rather than starting a second
  one, so the timeline stays continuous across sittings

### Authorization

Recording is scoped to the author. Writing the document through the editor is
subject to the **same rules** as the ordinary update endpoint — deadline,
graded state, and whether the assignment permits changes — because two
endpoints that write the same field must agree, or the more permissive one
quietly becomes the real policy. The log itself is still accepted while the work
is live: it records work already done, and refusing it would leave a hole in the
replay.

---

## Notifications

A bell in the header, with a live badge. Nothing needs refreshing.

### Who gets told what

| Event | Who hears |
|---|---|
| A teacher publishes an assignment | Every enrolled student in that class, and every administrator |
| A deadline is approaching | Students in that class who have **not** submitted yet |
| A student submits | The teachers of that offering, and every administrator |
| A teacher marks work | The student who wrote it |
| A teacher returns work for revision | The student who wrote it |

Deadline reminders go out twice — once with about a day left, once with about
two hours left. A third would be nagging, and nagging is how notifications get
ignored. Anyone who has already submitted is skipped: reminding someone about
work they have handed in is the fastest way to teach them not to look.

### How "live" works

The browser holds an open **server-sent events** connection and the badge
updates from it.

SSE rather than WebSockets or SignalR: nothing is ever sent upstream on this
connection, and `EventSource` reconnects by itself — behaviour that would
otherwise have to be written and then got right. The browser cannot open it
directly, because the access token lives in an httpOnly cookie and `EventSource`
cannot set an `Authorization` header, so the connection terminates in a Next.js
route handler that attaches the token and pipes the body through. That is the
same arrangement as every other API call here, just held open.

The stream is an **accelerator, not the source of truth**. Every notification is
written to the database first; publishing to open connections comes after and
its failures are logged, not raised. If nobody is connected, the row is still
there on the next page load. The client also re-fetches whenever the tab regains
focus, which closes the gap left by a sleeping laptop.

### Not being told twice

A notification can carry a dedupe key, unique per recipient and enforced by a
database index. The deadline sweep runs every ten minutes and would otherwise
remind the same student on every pass; the key means "already sent" is a
constraint rather than a race the scheduler has to win. Marking is deliberately
left un-keyed — a re-mark is news, and the student should hear about it again.

### Scope

Delivery is **in-process**, which is the honest scope for a single instance: a
concurrent dictionary of open channels, each bounded and dropping its oldest
item rather than letting a wedged client stall the request that is publishing.
Running several instances behind a load balancer would need this backed by Redis
or a bus, and only `INotificationStream` would change.

There is no email or push delivery — see
[Known limitations](#known-limitations).

---

## Database security

If you host the database on a managed PostgreSQL such as Supabase, the `public`
schema is also published as an **auto-generated REST API** (PostgREST). Anyone
holding the project URL and the anon key — which is meant to be public — can
then read and write every table over HTTP, going straight past this API and
every authorization rule in it.

This application never uses that path. It connects directly to PostgreSQL and
enforces access in the API. So the schema is hardened on every start:

- **Row-Level Security enabled on every table**, with **no policies at all**.
  No policy means no row matches, which denies the REST roles completely. The
  role that owns the tables bypasses RLS, so the application is unaffected —
  that is what makes this safe to apply automatically.
- **The `anon` and `authenticated` roles are revoked** from the schema, its
  tables, sequences and functions, including default privileges for future
  objects. RLS alone is enough; removing the grants means a policy added by
  accident later cannot re-open the schema on its own.

Adding permissive policies instead would be worse than leaving RLS off: it would
imply the REST API is a supported way in, and every table added afterwards would
need a policy written correctly or it would silently leak.

Verified against a live Supabase project — reads, inserts and deletes with the
anon key and with the publishable key all return **401 permission denied**,
while the application continues to read and write normally.

### If your database user does not own the tables

Enabling RLS for a role that neither owns the tables nor bypasses RLS would make
every query return **zero rows rather than an error** — the application would
start, sign nobody in, and show empty lists. So it checks first, and if that is
the situation it skips the change and logs a warning explaining what to do
rather than breaking the application quietly.

Because the application creates the schema itself, it owns it, and the check
passes.

### A note on keys

Nothing here uses the Supabase client libraries, so the four `SUPABASE_*` keys
are not needed to run the project. The **service role key bypasses RLS
entirely** — keep it server-side, never in frontend code or a `NEXT_PUBLIC_*`
variable. If it has ever been pasted somewhere shared, rotate it from the
Supabase dashboard.

---

## Technology stack

### Backend

| | |
|---|---|
| **Runtime** | .NET 9 |
| **Framework** | ASP.NET Core 9 Web API (controllers) |
| **Language** | C# 13 |
| **Database** | PostgreSQL 14+ (developed against 17) |
| **ORM** | EF Core 9 with Npgsql |
| **Authentication** | JWT bearer tokens, BCrypt password hashing |
| **Validation** | FluentValidation |
| **Logging** | Serilog — console plus a rolling file |
| **API docs** | Swashbuckle (Swagger UI) with a bearer scheme |
| **Versioning** | Asp.Versioning, URL segment (`/api/v1/...`) |
| **Testing** | xUnit, FluentAssertions, EF Core in-memory provider |

### Frontend

| | |
|---|---|
| **Framework** | Next.js 16 (App Router, React 19) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Components** | shadcn/ui on Base UI |
| **Forms** | React Hook Form with Zod validation |
| **Animation** | Motion (Framer Motion) |
| **Notifications** | Sonner |
| **Icons** | Lucide |
| **Fonts** | Inter, Noto Sans Bengali, JetBrains Mono |

### Tooling

| | |
|---|---|
| **Migrations** | EF Core, applied automatically at startup |

---

## Architecture

### Backend — Clean Architecture

```
Api  ──▶  Infrastructure  ──▶  Application  ──▶  Domain
```

References point inward only, so business rules never depend on ASP.NET or EF
Core and can be tested without a host or a database.

| Layer | Holds |
|---|---|
| **Domain** | Entities, enums, domain exceptions. No dependencies. |
| **Application** | DTOs, services, validators, `IAccessControl`. Depends on `IAppDbContext`, not on EF directly. |
| **Infrastructure** | EF Core, migrations, seeding, BCrypt, JWT. |
| **Api** | Controllers, middleware, composition. Controllers stay thin — they call a service and wrap the result. |

Two decisions carry most of the weight:

**Errors are exceptions, translated once.** Services throw
`NotFoundException`, `ForbiddenException`, `ConflictException`,
`BusinessRuleException`; one middleware maps them to 404/403/409/422 and the
shared response envelope. No controller contains a `try`/`catch`, and no service
knows an HTTP status code.

**Authorization has two layers.** Role policies (`AdminOnly`, `TeacherOnly`,
`StudentOnly`, `AdminOrTeacher`) handle the coarse question; `IAccessControl`
handles the one a role attribute cannot answer — *is this caller the teacher of
**this** offering?* Its `Ensure*` methods throw rather than return `bool`, so a
caller who ignores the result still fails closed. A fallback policy requires
authentication everywhere, so an endpoint missing `[Authorize]` denies access
rather than silently exposing data.

### Frontend — Next.js App Router

**Tokens never touch JavaScript.** They live in `httpOnly` cookies. Server
Components read them directly; client components call an internal proxy route
that attaches the bearer token and handles refresh in exactly one place.

**`proxy.ts`** — Next.js 16 renamed `middleware` to `proxy` — gates routes and,
importantly, refreshes an expired access token *before* the request reaches a
page. A Server Component cannot set cookies during render, so without this an
expired token would fail every server-side data call.

It is a convenience gate, not the security boundary. **The API is the only place
a role is trusted**, and it re-derives the role from the signed token on every
request.

**Server decides, UI displays.** The student assignment endpoint returns
`canSubmit`, `canEdit` and `blockedReason`, so the interface never re-derives
deadline rules in TypeScript — and a client that ignores them is still refused
by the write path.

---

## Data model

```
Users ──┬─▶ Enrollments ──▶ Classes ◀── ClassSubjects ──▶ Subjects
        ├─▶ TeacherAssignments ──▶ ClassSubjects
        ├─▶ Assignments ──▶ ClassSubjects
        └─▶ Submissions ──▶ Assignments
                └─▶ SubmissionFeedbacks
```

**`ClassSubject` is the pivot.** The brief says a teacher assigns work "to a
specific class/course **and** subject", so an assignment belongs to an
*offering* — one subject taught to one class — rather than to either alone.
Teacher permissions attach to the same row, which collapses "may this teacher
grade this submission?" into a single lookup.

**Enrolment is a join table**, not a column on `Users`. The brief covers schools
*and* colleges, and a college student takes several courses at once.

**Feedback is a table**, not a column, so a grade → return → regrade cycle keeps
every round, each snapshotting the marks standing at the time.

Rules the database enforces itself, not only the service layer:

| Constraint | Prevents |
|---|---|
| `unique(assignment_id, student_id)` | Duplicate submissions, including concurrent ones |
| `ck_assignments_max_marks_positive` | Assignments worth zero or less |
| `ck_submissions_marks_non_negative` | Negative marks |
| `ck_submissions_graded_has_grader` | Graded work with no mark, grader or timestamp |
| `ck_assignments_published_has_timestamp` | Published work with no publication date |

Every table carries `created_at`, `updated_at`, `created_by`, `modified_by` and
soft-delete columns, applied by a `SaveChanges` interceptor and a global query
filter. **No `Remove()` call anywhere destroys a row** — deletes are rewritten
as soft deletes, so a graded submission cannot be lost.

Keys are UUID v7 (time-ordered), so inserts stay at the right edge of the index
instead of fragmenting it the way random v4 GUIDs do.

---

## Project structure

```
.
├── database/                     Schema script and database notes
├── backend/
│   ├── .env.example              Every variable, placeholders only
│   ├── src/
│   │   ├── AssignmentSystem.Domain/           entities, enums, exceptions
│   │   ├── AssignmentSystem.Application/      DTOs, services, validators
│   │   │   ├── Common/            envelope, paging, IAccessControl
│   │   │   └── Features/          Auth · Admin · Teacher · Student
│   │   ├── AssignmentSystem.Infrastructure/   EF Core, security, seeding
│   │   │   ├── Persistence/       DbContext, configurations, Migrations/
│   │   │   └── Security/          BCrypt, JWT
│   │   └── AssignmentSystem.Api/              controllers, middleware
│   └── tests/
│       └── AssignmentSystem.UnitTests/        86 xUnit tests
└── frontend/
    ├── proxy.ts                  route protection + token refresh
    ├── app/
    │   ├── (app)/                signed-in pages
    │   ├── api/                  login, logout, authenticated proxy
    │   └── login/
    ├── components/               ui · layout · common · motion · providers
    └── lib/                      api client, i18n, formatting
```

---

## Setup on macOS

Written for macOS (Apple Silicon and Intel both work). Linux and Windows differ
only in how the prerequisites are installed.

### 1. Prerequisites

| Tool | Version | Check with |
|---|---|---|
| .NET SDK | 9.0+ | `dotnet --version` |
| Node.js | 20+ | `node --version` |
| PostgreSQL | 14+ | `psql --version` |

With [Homebrew](https://brew.sh):

```bash
brew install --cask dotnet-sdk
```

```bash
brew install node
```

```bash
brew install postgresql@16
```

Start PostgreSQL and have it come back after a reboot:

```bash
brew services start postgresql@16
```

Homebrew's PostgreSQL creates a superuser named after your macOS account with no
password, so a local connection string usually needs no credentials at all.

### 2. Clone and enter the project

```bash
git clone <your-repository-url> submitta && cd submitta
```

### 3. Create an empty database

```bash
createdb assignment_system
```

That is all the database preparation there is. Every table is created by the
application on first run — see [Database setup](#database-setup).

### 4. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and set `ConnectionStrings__DefaultConnection` to match your
PostgreSQL. With Homebrew's default setup that is:

```
ConnectionStrings__DefaultConnection=Host=localhost;Port=5432;Database=assignment_system;Username=YOUR_MAC_USERNAME
```

Run `whoami` if you are not sure of the username.

| Variable | Required | Notes |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | **Yes** | Both the `postgresql://` URI and the ADO.NET keyword form work. |
| `Jwt__Key` | Outside Development | A development key ships in `appsettings.Development.json`, so local sign-in works immediately. Startup **fails** outside Development without this. Generate with `openssl rand -base64 48`. |
| `Cors__AllowedOrigins__0` | No | Defaults to `http://localhost:3000`. |
| `Seed__Enabled` | No | Defaults to `true`. Set `false` for a real deployment. |

TLS is chosen from the host — disabled for localhost, required for anything
remote — so the same format works locally and against a hosted database.

### 5. Configure the frontend

```bash
cp frontend/.env.example frontend/.env.local
```

The defaults point at `http://localhost:5062`, which is where the API runs.

---

## Database setup

**There are no tables to create.** The API applies its migrations and seeds the
demo data on startup, so the schema and the demo accounts exist the first time
you run it.

What happens on that first run:

1. Connects using `ConnectionStrings__DefaultConnection`
2. Applies any pending EF Core migration — creating 15 tables, 4 PostgreSQL
   enum types, the check constraints and the indexes
3. Seeds 6 users, 2 classes, 3 subjects, 3 offerings, 3 enrolments,
   4 assignments, 3 submissions and 8 application settings

The seeder is **idempotent**: it inserts only what is missing, so restarting
never duplicates anything, and a partially seeded database repairs itself.

### Applying the schema yourself instead

If you would rather create the schema with `psql` than let the application do
it, [`database/schema.sql`](database/schema.sql) is every migration in order as
one idempotent script:

```bash
psql -d assignment_system -f database/schema.sql
```

It creates the tables but inserts no data — start the API afterwards and the
seeder fills in the demo content. See [`database/README.md`](database/README.md).

### Managing migrations by hand

Only needed if you are changing the schema. Requires the EF tools:

```bash
dotnet tool install --global dotnet-ef
```

Apply migrations without starting the API:

```bash
dotnet ef database update --project backend/src/AssignmentSystem.Infrastructure --startup-project backend/src/AssignmentSystem.Api
```

Create a new migration after changing an entity:

```bash
dotnet ef migrations add <Name> --project backend/src/AssignmentSystem.Infrastructure --startup-project backend/src/AssignmentSystem.Api --output-dir Persistence/Migrations
```

### Inspecting the database

```bash
psql -d assignment_system -c "\dt"
```

### Starting over

Deletes the volume and everything in it:

```bash
dropdb assignment_system && createdb assignment_system
```

---

## Running the backend

From the repository root:

```bash
dotnet run --project backend/src/AssignmentSystem.Api
```

| | |
|---|---|
| **API** | <http://localhost:5062> |
| **Swagger UI** | <http://localhost:5062/swagger> |
| **Health check** | <http://localhost:5062/health> |

Leave this terminal running. The first start takes a few seconds longer while
migrations and seeding complete — you will see `Seeded 6 User row(s).` and
similar lines in the log.

To restore packages explicitly first:

```bash
dotnet restore backend
```

---

## Running the frontend

In a **second terminal**, from the repository root:

```bash
npm --prefix frontend install
```

```bash
npm --prefix frontend run dev
```

| | |
|---|---|
| **Application** | <http://localhost:3000> |

The frontend defaults to `http://localhost:5062` for the API. To change it,
copy `frontend/.env.example` to `frontend/.env.local` and edit `API_BASE_URL`.

Sign in with any account from [Demo credentials](#demo-credentials) — the login
page lists all three and one click fills the form.

### Production build

```bash
npm --prefix frontend run build && npm --prefix frontend run start
```

---

## Running the tests

```bash
dotnet test backend
```

86 tests, roughly 11 seconds, no database required.

| Suite | Tests | Covers |
|---|---|---|
| `AccessControlTests` | 12 | Resource-level authorization |
| `AssignmentLifecycleTests` | 15 | Draft/publish, deadlines, maximum marks |
| `SubmissionWorkflowTests` | 19 | Visibility, submitting, editing |
| `GradingTests` | 11 | Marks bounds, grading record, status changes |
| `AuthenticationTests` | 16 | Sign-in, token rotation, hashing |
| `AdminGuardTests` | 13 | Self-protection, referential guards |

These are unit tests of the service layer, using EF Core's in-memory provider
and an injectable clock. Deadline rules are tested by *moving time* rather than
by sleeping or seeding dates relative to now — which is the reason
`IDateTimeProvider` exists at all.

Sample assertions, to show the level they work at:

- A wrong password and an unknown email produce an **identical** message —
  asserted by comparing the two, not by reading the code.
- Replaying a rotated refresh token revokes the **entire** session chain.
- Moving an assignment's deadline after a submission does **not** make that
  submission late.

---

## API

Swagger UI at <http://localhost:5062/swagger>, with an **Authorize** button:
sign in via `POST /api/v1/auth/login`, paste the `accessToken`, and every
endpoint runs as that role.

67 routes across seven groups.

| Group | Base | Access |
|---|---|---|
| Auth | `/api/v1/auth` | Anonymous / any signed-in user |
| Admin | `/api/v1/admin/*` | Admin |
| Assignments | `/api/v1/assignments` | Teacher, Admin |
| Grading | `/api/v1/grading` | Teacher, Admin |
| Student | `/api/v1/student` | Student |
| Editor | `/api/v1/submissions/{id}` | Author writes; author and their teacher read |
| Settings | `/api/v1/settings` | Public subset for all; full for Admin |

Every response uses one envelope, so a client parses one shape:

```jsonc
{ "success": true, "data": { }, "message": "Assignment published." }
```

```jsonc
{
  "success": false,
  "message": "Marks cannot exceed the maximum of 100 for this assignment.",
  "errorCode": "business_rule_violation",
  "traceId": "0HN7…"
}
```

Status codes are used precisely: **422** is a business-rule violation (a missed
deadline), **400** a malformed request, **409** a conflict with existing state,
**403** a resource the caller may not touch, **404** one they may not know
exists.

List endpoints support `page`, `pageSize`, `search`, `sortBy` and
`sortDescending`, plus per-endpoint filters. Sort fields come from a whitelist,
so an arbitrary `?sortBy=` can never reach reflection or raw SQL, and page size
is clamped server-side rather than trusted.

Login and refresh are rate limited to ten attempts per minute per IP.

---

## Troubleshooting

**`Failed to connect to 127.0.0.1:5433`**
PostgreSQL is not running. Start it with `brew services start postgresql@16`,
and confirm with `psql -l`.

**`Address already in use` on 5062 or 3000**
Something else holds the port — often an earlier run of this project. Find and
stop it:

```bash
lsof -ti:5062 | xargs kill
```

Or run the API elsewhere with `dotnet run --project backend/src/AssignmentSystem.Api --urls http://localhost:5099`, remembering to point `API_BASE_URL` at the new port.

**`dotnet: command not found` after `brew install --cask dotnet-sdk`**
The installer places `dotnet` in `/usr/local/share/dotnet`. Open a new terminal,
or add it to your `PATH`.

**Sign-in fails with "Invalid email or password"**
Seeding may not have run — check the backend log for `Seeded 6 User row(s).`. If
`Seed:Enabled` was set to `false`, or the database was created before seeding
was enabled, reset it with `dropdb assignment_system && createdb assignment_system` and
restart the API.

**`No database connection string found`**
`backend/.env` is missing. Run `cp backend/.env.example backend/.env`.

**The frontend loads but every page errors**
The backend is not running, or is on a different port. Confirm
<http://localhost:5062/health> returns `{"status":"healthy"}`.

**Port 5433 conflicts with an existing PostgreSQL**
Change the port PostgreSQL listens on, or point the connection string at the
existing server, and
update the port in `backend/.env` to match.

---

## Assumptions

The brief leaves these open; each was decided deliberately.

**"Class" and "course" are the same entity.** The brief writes them together
throughout — "class/course and subject" — so modelling them separately would
invent a hierarchy it never describes. `Class` covers a school section
(`G10-A`) and a college course (`CSE-3101`) alike.

**A student may be enrolled in several classes.** The brief covers schools and
colleges, and a college student takes multiple courses at once — hence a join
table rather than a column.

**"Update a submission before the deadline, *if allowed*"** became two explicit
flags per assignment: `AllowResubmission` (edit before the deadline) and
`AllowLateSubmission` (submit after it, flagged late). The conditional in the
brief needed somewhere concrete to live.

**Several teachers may share one offering.** Team teaching is common and the
brief does not forbid it, so the teacher-to-offering link is many-to-many.

**Roles are fixed.** Three roles, stored as a native PostgreSQL enum rather than
a lookup table. There is no runtime role management in the brief, so a join for
three unchanging values would buy nothing.

**Submissions are text plus an optional link.** File upload needs storage,
virus scanning and a retention policy — well outside the brief. Attachment URLs
are restricted to `http`/`https`, since a teacher is the one who would click
them.

**Supabase is used only as a PostgreSQL host.** Supabase Auth is deliberately
unused: the brief requires JWT authentication implemented in the API, and using
two auth systems would leave the question of which one is authoritative.

**The locale lives in a cookie, not the URL.** This is an authenticated
dashboard, not indexable content, so per-locale URLs would buy nothing and cost
a `[locale]` segment on every route.

---

## Known limitations

Stated plainly rather than discovered later.

**No refresh-token reuse window.** Rotation is strict, so two tabs refreshing
simultaneously can revoke each other's session. A short grace period on the
previous token would fix it.

**TLS certificates are not verified** against hosted databases
(`SslMode=Require` without chain validation), so setup works on machines without
the provider's CA installed. A real deployment should pin it and use
`VerifyFull`.

**No integration test layer.** The tests cover the service layer thoroughly;
controllers, middleware and the EF mapping are verified by hand and by the
running application rather than by an automated `WebApplicationFactory` suite.

**Rate limiting is in-process**, so it resets on restart and does not coordinate
across instances. Distributed limiting would need Redis.

**Audit logging is modelled but not written to.** The `AuditLogs` table and
entity exist; the interceptor populates the per-row audit columns instead. Full
change-history capture is not wired up.

**Bangla covers the interface, not the content.** All UI text, numerals, dates
and relative times localise; assignment titles and student answers appear as
written, which is correct — but there is no per-field translation.

**The replay reconstructs text, not the formatted document.** Applying the log
rebuilds what was written and which passages were pasted, which is what a replay
is for; reproducing headings, tables and styling as they appeared at each moment
would mean re-implementing ProseMirror's transform pipeline in the player. The
finished document is shown in full alongside the replay.

**The editor has no file, image or video uploads.** There is no object storage
in this project, so the editor covers text, structure and code but not media.
Images can be embedded by URL. Adding uploads means adding a storage service and
a signed-URL endpoint, not changing the editor.

**No real-time collaboration.** One author per submission, which is what the
assignment requires. Tiptap supports collaborative editing through Yjs, but that
needs a websocket server the project does not have.

**The editor UI is English only.** The rest of the interface localises to
Bangla; the toolbar, slash palette, replay controls and chart labels were added
late and their strings are not yet in the dictionaries.

**Submissions recorded before the duplicate-transaction fix replay wrongly.**
An early build of the editor interpreted each change twice, so logs written then
contain every character doubled — the replay shows `NNeettwwoorrkk`, and the
derived word counts are inflated to match. The bug is fixed, but the affected
logs cannot be repaired: the duplication is inside each recorded run, and
un-doubling it by guessing would corrupt any word that genuinely repeats a
letter. Rewriting a submission produces a correct log. Nothing silently
rewrites stored events — the log is evidence, and this system is only worth
anything if it stays untouched.

**Notifications are in-app only.** No email and no browser push, so a student
who never signs in is never told. Both would be additive — the audience and the
wording are already worked out — but neither is here.

**Live delivery assumes one instance.** Open connections are held in process, so
a second instance behind a load balancer would only reach the clients attached
to it. Everything would still be stored and still appear on refresh; only the
"without refreshing" part would break.

**Analytics approximate a word as five characters** for typing speed, the usual
convention. It is a reasonable estimate across a document, not an exact count,
and it will read differently for languages with other word lengths.

---

## Future improvements

- File attachments with real storage
- Email or in-app notification when work is published, submitted or graded
- Integration tests via `WebApplicationFactory` against a containerised database
- CSV export of marks per class
- A grade-history view for students across a term
- Distributed rate limiting and structured log shipping

---

<p align="center">
Built with ASP.NET Core 9, PostgreSQL, Next.js 16 and TypeScript.
</p>
