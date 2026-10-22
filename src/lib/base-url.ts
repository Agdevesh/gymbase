// Public origin of this deployment, used in links we hand out (receipts, invites, pay links).
// AUTH_URL wins; on Vercel the project URL is derived so a one-click deploy needs no extra config.
export function baseUrl(): string {
  const explicit = process.env.AUTH_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : "";
}
