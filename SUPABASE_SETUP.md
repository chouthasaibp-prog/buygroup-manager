# Supabase Postgres Setup

This app now uses Prisma with Supabase Postgres through `DATABASE_URL`.

## 1. Keep a local SQLite backup

Do this before changing your `.env` away from SQLite:

```bash
npm run data:export
```

By default this reads `prisma/dev.db` and writes:

```text
backups/sqlite-export.json
```

The export does not modify or delete your SQLite database.

## 2. Create the Supabase database URL

In Supabase, open your project, then go to **Project Settings > Database > Connection string**.

For the app, use the pooled connection string as `DATABASE_URL`:

```bash
DATABASE_URL="postgresql://postgres.iwjctjgdvlubumzyeuck:[YOUR-PASSWORD]@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

For Prisma migrations, use the direct connection as `DIRECT_URL`:

```bash
DIRECT_URL="postgresql://postgres.iwjctjgdvlubumzyeuck:[YOUR-PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
```

Replace `[YOUR-PASSWORD]` with your real Supabase database password.

## 3. Create the Postgres schema

After `.env` has both Supabase URLs, run:

```bash
npm run prisma:deploy
npm run prisma:generate
```

This applies the checked-in Prisma migration. It creates the tables and indexes, but does not wipe data.

## 4. Import the SQLite export into Supabase

With `.env` still pointing at Supabase Postgres, run:

```bash
npm run data:import
```

The import:

- upserts Amazon accounts, buy groups, warehouses, and orders
- preserves existing SQLite IDs when possible
- maps existing Supabase seed rows by unique names/codes
- never truncates, drops, or deletes Supabase rows

If you exported to a custom file:

```bash
npm run data:import -- backups/my-export.json
```

## 5. Start the app

```bash
npm run dev
```

The UI and workflow are unchanged because the app still uses the same Prisma models.

## Rollback Notes

Your original SQLite database remains at `prisma/dev.db`. To temporarily use it again, you would need to switch `prisma/schema.prisma` back to the SQLite provider and set:

```bash
DATABASE_URL="file:./dev.db"
```

Do not run destructive SQL in Supabase unless you have verified a backup.
