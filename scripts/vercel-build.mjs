// Build step for Vercel (package.json "vercel-build"): migrate the database, seed the demo gym
// if it is missing, then build Next.js. Local `npm run build` is unchanged.
import { execSync } from "node:child_process";

const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env });
};

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add the Neon (Postgres) integration to the Vercel project, or set DATABASE_URL by hand.");
  process.exit(1);
}
// Neon's integration gives a pooled DATABASE_URL and a direct DATABASE_URL_UNPOOLED; migrations want the direct one.
process.env.DATABASE_URL_UNPOOLED ||= process.env.DATABASE_URL;

run("prisma generate");
run("prisma migrate deploy");
run("tsx prisma/seed.ts --if-missing");
run("next build");
