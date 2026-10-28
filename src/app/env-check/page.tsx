import EnvCheckClient from "./env-check-client";

export const dynamic = "force-dynamic";

function present(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

export default function EnvCheckPage() {
  const serverEnv = {
    NEXT_PUBLIC_SUPABASE_URL: present(
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
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
    <main style={{ fontFamily: "monospace", padding: 24 }}>
      <h1>Koino Environment Check</h1>

      <h2>Deployment</h2>
      <p>Environment: {process.env.VERCEL_ENV ?? "local"}</p>
      <p>Branch: {process.env.VERCEL_GIT_COMMIT_REF ?? "local"}</p>
      <p>Commit: {process.env.VERCEL_GIT_COMMIT_SHA ?? "local"}</p>

      <h2>Server-side variables</h2>
      <ul>
        {Object.entries(serverEnv).map(([key, value]) => (
          <li key={key}>
            {key}: {String(value)}
          </li>
        ))}
      </ul>

      <h2>Browser build-time variables</h2>
      <EnvCheckClient />
    </main>
  );
}
