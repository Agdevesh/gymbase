# GYMBASE

Gym management SaaS for Indian gyms: check-in, inquiries, memberships, payments (cash/UPI), WhatsApp receipts, PT, classes, reports and a member portal. Stack: Next.js 16, Prisma 6, Postgres, Auth.js. Progress and decisions live in [PROGRESS.md](PROGRESS.md).

## Deploy

One click, free tier, about 3 minutes:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAgdevesh%2Fgymbase&project-name=gymbase&repository-name=gymbase&env=AUTH_SECRET%2CCRON_SECRET&envDescription=Two+long+random+strings+%28any+32%2B+characters%29.+AUTH_SECRET+signs+logins%2C+CRON_SECRET+protects+the+daily+cron.&envLink=https%3A%2F%2Fgithub.com%2FAgdevesh%2Fgymbase%23deploy&products=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D)

1. Click the button and sign in to Vercel (GitHub login works). Vercel copies this repo into your account.
2. Under **Add Products** keep **Neon** (Postgres) selected. It creates a free database and fills `DATABASE_URL` for you. If the Neon step does not appear, finish the deploy, open the project's **Storage** tab, add Neon, then redeploy.
3. Fill the two environment variables: `AUTH_SECRET` and `CRON_SECRET`. Any long random text works (run `openssl rand -base64 32`, or just type 40 random characters).
4. Click **Deploy**. The build runs the database migrations and seeds the demo gym, so the site works as soon as the build is green.

Open `https://<your-project>.vercel.app` and sign in with the demo gym:

| Role | Gym code | Email | Password |
| --- | --- | --- | --- |
| Owner | `demo` | `owner@demo.gym` | `password123` |
| Reception | `demo` | `reception@demo.gym` | `password123` |
| Trainer | `demo` | `trainer@demo.gym` | `password123` |

Members sign in at `/me` with the gym code, their phone and the PIN reception sends them. Or create your own gym from the landing page.

After the first deploy, optionally set `AUTH_URL` to your final domain if you add one (links in receipts and invites use it; otherwise the Vercel URL is used).

### Manual deploy

Any host that runs Node 22 and gives you a Postgres URL works:

```sh
cp .env.example .env     # set DATABASE_URL, DATABASE_URL_UNPOOLED, AUTH_SECRET, CRON_SECRET, AUTH_URL
npm ci
npm run db:deploy        # migrations
npm run db:seed          # demo gym (resets it; the Vercel build uses --if-missing)
npm run build && npm start
```

## Develop

```sh
cp .env.example .env
npm ci
npm run db:deploy && npm run db:seed
npm run dev              # http://localhost:3000
npm run typecheck && npm test
```

## Android app

`android-app/` is a Capacitor shell that loads the deployed site. The latest APK is at <https://github.com/Agdevesh/gymbase/releases/latest/download/gymbase.apk>; see PROGRESS.md for how to point it at your own domain.
