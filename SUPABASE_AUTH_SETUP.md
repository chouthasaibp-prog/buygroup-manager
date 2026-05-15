# Supabase Auth Setup

This app now uses Supabase Auth email/password sessions and Prisma-owned user data.

## Required Environment Variables

Add these locally in `.env` and in Vercel:

```text
DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Find the Auth values in **Supabase Project Settings > API**:

```text
NEXT_PUBLIC_SUPABASE_URL=https://iwjctjgdvlubumzyeuck.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```

## Supabase Dashboard Settings

1. Open Supabase.
2. Go to **Authentication > Providers**.
3. Enable **Email**.
4. Enable email/password signups if you want users to create accounts from `/login`.
5. In **Authentication > URL Configuration**, add your deployed Vercel URL after deployment.

## Apply Database Ownership and RLS

Run:

```bash
npm run prisma:deploy
```

This applies the migration that:

- adds `userId` ownership columns
- enables RLS on `AmazonAccount`, `BuyGroup`, `Warehouse`, and `Order`
- adds policies so Supabase-authenticated users can only access rows matching their user id

The migration does not delete or reset data.

## Assign Existing Imported Data

Existing imported rows are preserved but start as unowned. After creating your Supabase Auth user, copy that user's UUID from:

**Supabase > Authentication > Users**

Then run:

```bash
npm run data:assign-user -- <supabase-auth-user-id>
```

This assigns only rows where `userId` is currently empty. It does not wipe or overwrite already-owned rows.

## App Behavior

- `/` is protected.
- Unauthenticated visitors are redirected to `/login`.
- Email/password sign in and sign up are available at `/login`.
- The current UI remains the same after login.
- Logout is available in the top-right app header.
- All Prisma reads and writes are filtered by the authenticated Supabase user id.
