import Link from "next/link";
import { GraduationCap } from "lucide-react";

/**
 * Footer.
 *
 * A Server Component — it is static, so shipping it as client JavaScript would
 * be waste. Every link goes somewhere real: nothing here points at a page that
 * does not exist, which is the usual failing of a template footer.
 */

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Security", href: "#security" },
      { label: "Sign in", href: "/login" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "API reference", href: "http://localhost:5062/swagger", external: true },
      { label: "Health check", href: "http://localhost:5062/health", external: true },
      { label: "Built with", href: "#stack" },
    ],
  },
] as const;

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border px-5 py-12 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <GraduationCap className="size-4" aria-hidden />
              </span>
              <span className="text-[0.9375rem] font-semibold tracking-tight">
                Submitta
              </span>
            </Link>

            <p className="max-w-xs pt-3.5 text-sm leading-relaxed text-muted-foreground text-pretty">
              Assignment and submission management for schools and colleges —
              deadlines, marks and feedback in one place.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {column.heading}
              </h2>

              <ul className="space-y-2.5 pt-4">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {year} Submitta. Built as a recruitment project for OnnoRokom
            Projukti Limited.
          </p>

          <p className="text-xs text-muted-foreground">
            The API links above assume the backend is running locally.
          </p>
        </div>
      </div>
    </footer>
  );
}
