import { redirect } from "next/navigation";
import { createOperatorWorkspace, createPersonalWorkspace, joinOperatorWorkspace } from "./actions";
import { ensureProfile, getWorkspaceMemberships } from "@/lib/workspace";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function OnboardingPage({ searchParams }: Props) {
  const params = await searchParams;
  const profile = await ensureProfile();
  const memberships = await getWorkspaceMemberships(profile.id);

  if (memberships.length > 0) {
    redirect(`/?workspace=${memberships[0].workspaceId}`);
  }

  return (
    <main className="min-h-screen px-4 py-10 text-slate-100">
      <section className="mx-auto max-w-5xl">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[.18em] text-cyan/80">Workspace Setup</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">How do you want to use the app?</h1>
        </div>

        {params.error && <div className="mb-5 rounded-lg border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">{params.error}</div>}

        <div className="grid gap-4 lg:grid-cols-3">
          <form action={createPersonalWorkspace} className="rounded-lg border border-cyan/20 bg-panel/80 p-5 shadow-glow">
            <h2 className="text-lg font-semibold">Personal Tracker</h2>
            <p className="mt-2 min-h-20 text-sm text-muted">I am tracking only my own direct buy group orders.</p>
            <button className="mt-5 w-full rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white">Use Personal Mode</button>
          </form>

          <form action={joinOperatorWorkspace} className="rounded-lg border border-blue-400/20 bg-panel/80 p-5 shadow-glow">
            <h2 className="text-lg font-semibold">Join an Operator</h2>
            <p className="mt-2 min-h-20 text-sm text-muted">I submit orders and tracking to someone who manages buy group submissions.</p>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Invite code or link</span>
              <input name="inviteCode" required className="w-full px-3 py-2 text-sm" />
            </label>
            <button className="mt-5 w-full rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white">Join Workspace</button>
          </form>

          <form action={createOperatorWorkspace} className="rounded-lg border border-green-400/20 bg-panel/80 p-5 shadow-glow">
            <h2 className="text-lg font-semibold">Create Operator Workspace</h2>
            <p className="mt-2 min-h-20 text-sm text-muted">I sell to buy groups directly and manage orders from friends or sub-sellers.</p>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Workspace name</span>
              <input name="workspaceName" required placeholder="Sai Buy Group Ops" className="w-full px-3 py-2 text-sm" />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs text-muted">Operator access code</span>
              <input name="operatorCreationCode" required type="password" className="w-full px-3 py-2 text-sm" />
            </label>
            <button className="mt-5 w-full rounded-lg bg-green-500 px-3 py-2 text-sm font-medium text-white">Create Workspace</button>
          </form>
        </div>
      </section>
    </main>
  );
}
