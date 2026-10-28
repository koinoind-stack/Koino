
import EnvCheckClient from "./env-check-client";

export const dynamic = "force-dynamic";

function present(v: unknown): boolean {
  return typeof v === "string" && v.length > 0;
}

export default function EnvCheckPage() {
  const serverEnv = {
    NEXT_PUBLIC_SUPABASE_URL: present(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: present(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
    NEXT_PUBLIC_SITE_URL: present(process.env.NEXT_PUBLIC_SITE_URL),
    DATABASE_URL: present(process.env.DATABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: present(
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
  };

  return (
    <main
      style={{
        fontFamily: "ui-monospace, monospace",
        padding: 24,
        maxWidth: 760,
      }}
    >
      <h1>Koino environment check</h1>
      <p>Only variable presence is shown, never variable values.</p>

      <h2>Deployment</h2>
      <ul>
        <li>Environment: {process.env.VERCEL_ENV ?? "(local)"}</li>
        <li>Branch: {process.env.VERCEL_GIT_COMMIT_REF ?? "(local)"}</li>
        <li>Commit: {process.env.VERCEL_GIT_COMMIT_SHA ?? "(local)"}</li>
      </ul>

      <h2>Server-side variables</h2>
      <ul>
        {Object.entries(serverEnv).map(([key, value]) => (
          <li key={key}>
            {key}: {String(value)}
          </li>
        ))}
      </ul>

      <h2>Browser variables (build time)</h2>
      <EnvCheckClient />
    </main>
  );
}
