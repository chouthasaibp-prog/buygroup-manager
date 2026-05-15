# Buy Group Manager

A Next.js order tracking app for managing Amazon buy group purchases, shipment progress, payouts, credit card timing, and profit status.

The app uses Prisma ORM with Supabase Postgres for persistence and is prepared for deployment on Vercel.

## Local Development

```bash
npm install
npm run prisma:generate
npm run dev
```

Create a local `.env` file with:

```text
DATABASE_URL="..."
DIRECT_URL="..."
```

Do not commit `.env` or database backup files.

## Deployment

See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for the Vercel setup guide.
