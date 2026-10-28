
"use client";

export default function EnvCheckClient() {
  const items: Array<[string, boolean]> = [
    [
      "NEXT_PUBLIC_SUPABASE_URL",
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    ],
    [
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    ],
    ["NEXT_PUBLIC_SITE_URL", Boolean(process.env.NEXT_PUBLIC_SITE_URL)],
  ];

  return (
    <ul>
      {items.map(([key, value]) => (
        <li key={key}>
          {key}: {String(value)}
        </li>
      ))}
    </ul>
  );
}
