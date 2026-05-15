# Vercel Deployment Guide

This app deploys to Vercel as a Next.js app and uses Supabase Postgres through Prisma.

## What Vercel Needs

Add these environment variables in Vercel under:

**Project Settings > Environment Variables**

Use the same values that are working locally, but do not commit them to the repo.

```text
DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
OPERATOR_CREATION_CODE
```

`DATABASE_URL` is the pooled Supabase connection used by the running app.

Example shape:

```text
postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require
```

`DIRECT_URL` is the direct Supabase connection used by Prisma for migrations and schema operations.

Example shape:

```text
postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
```

If your password contains special characters like `$`, `@`, `/`, `?`, `#`, or `&`, URL-encode them in both URLs. For example, `$` becomes `%24`.

Add the two Supabase Auth variables from **Supabase Project Settings > API**:

```text
NEXT_PUBLIC_SUPABASE_URL=https://iwjctjgdvlubumzyeuck.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon public key>
```

Add all four variables to every Vercel environment you plan to use:

Add the server-only operator workspace creation gate:

```text
OPERATOR_CREATION_CODE=<choose-a-secret-code>
```

Do not prefix it with `NEXT_PUBLIC_`.

- Production
- Preview
- Development, if you use Vercel's development environment

## Build Settings

Use Vercel's default Next.js framework preset.

Build command:

```bash
npm run build
```

Install command:

```bash
npm install
```

Output directory:

Leave blank. Vercel detects Next.js automatically.

The app is configured so Prisma Client is generated during deployment in two places:

- `postinstall`: runs `prisma generate` after dependencies install
- `build`: runs `prisma generate && next build`

## Database Safety

Do not run `prisma migrate reset` against Supabase.

The checked-in migration has already been applied locally to Supabase. For future schema changes, create a new Prisma migration locally and apply it to Supabase with:

```bash
npm run prisma:deploy
```

The Vercel build does not wipe, reset, seed, or import data.

## Step-By-Step Deployment

1. Push the project to GitHub, GitLab, or Bitbucket. Do not commit `.env`; it is already ignored.

2. In Vercel, choose **Add New > Project** and import the repository.

3. Confirm the framework preset is **Next.js**.

4. Set the build command to:

```bash
npm run build
```

5. Add environment variables:

```text
DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

6. Click **Deploy**.

7. After deploy finishes, open the Vercel URL, create/sign into your Supabase Auth user, and verify your orders appear.

If existing imported orders do not appear yet, assign the preserved unowned rows to your Supabase Auth user id:

```bash
npm run data:assign-user -- <supabase-auth-user-id>
```

## Local Preflight Before Deploy

Run these before pushing:

```bash
npm run prisma:generate
npm run typecheck
npm run build
```

If all three pass locally, the Vercel build should have the same Prisma and Next.js setup.
