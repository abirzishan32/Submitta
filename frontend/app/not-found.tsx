import Link from "next/link";
import { FileQuestion } from "lucide-react";

/**
 * 404.
 *
 * Deliberately a Server Component with no translation hook: this page renders
 * outside the app layout — including for signed-out visitors — where the i18n
 * provider is not guaranteed to be mounted.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="size-5 text-muted-foreground" aria-hidden />
      </div>

      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          The page you are looking for does not exist, has moved, or belongs to a
          class you do not have access to.
        </p>
      </div>

      <Link
        href="/"
        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
