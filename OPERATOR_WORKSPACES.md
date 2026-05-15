# Operator Workspaces

The app supports multiple workspace modes:

- **Personal Mode**: a user tracks their own direct buy group orders.
- **Operator/Admin Mode**: an operator manages orders submitted by members/sub-sellers.
- **Member Mode**: a member submits orders and tracking to a specific operator workspace.

Users are not automatically added to any operator workspace. They only join an operator through an invite code.

## Data Model

- `Profile`: one row per Supabase Auth user.
- `Workspace`: a personal or operator workspace.
- `WorkspaceMember`: connects profiles to workspaces with `OWNER`, `ADMIN`, or `MEMBER`.
- `Order`: belongs to a workspace and records who submitted/created it.

## Onboarding

After signup, users with no workspace membership are redirected to `/onboarding`.

They can choose:

1. **Personal Tracker**: creates a personal workspace.
2. **Join an Operator**: joins an operator workspace as `MEMBER` with an invite code.
3. **Create Operator Workspace**: creates an operator workspace and makes the user `OWNER`.

## Existing Data

Existing rows were preserved. To assign old imported rows to a workspace, use:

```bash
npm run make-workspace-owner -- <supabase-auth-user-id> "<workspace name>" PERSONAL
```

or:

```bash
npm run make-workspace-owner -- <supabase-auth-user-id> "Sai Buy Group Ops" OPERATOR
```

This creates a workspace, makes the user `OWNER`, and assigns unowned existing accounts, buy groups, warehouses, and orders to that workspace.

## Permissions

Server-side checks enforce:

- Personal workspace users only see their own workspace orders.
- Operator `OWNER` and `ADMIN` users can see all orders in that workspace.
- Operator `MEMBER` users only see orders they submitted.
- Members can create orders and add tracking to their own orders.
- Admin-only actions, such as marking tracking submitted, paid out, profit received, or member paid, are blocked server-side for members.

Supabase RLS policies are also installed as a database backstop for direct Supabase access.

## Vercel

Vercel still needs:

```text
DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Redeploy after pushing workspace changes to GitHub.
