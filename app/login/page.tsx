import { signIn, signUp } from "./actions";

type Props = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-xl border border-cyan/20 bg-panel/90 p-6 shadow-glow">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-[.18em] text-cyan/80">Buy Group Ops</div>
          <h1 className="mt-2 text-2xl font-semibold text-white">Sign in</h1>
          <p className="mt-2 text-sm text-muted">Use your email and password to access your private order workspace.</p>
        </div>

        {params.error && <div className="mb-4 rounded-lg border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">{params.error}</div>}
        {params.message && <div className="mb-4 rounded-lg border border-green-300/30 bg-green-500/10 px-3 py-2 text-sm text-green-100">{params.message}</div>}

        <form action={signIn} className="space-y-3">
          <input type="hidden" name="next" value={params.next ?? "/"} />
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Email</span>
            <input name="email" type="email" required className="w-full px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Password</span>
            <input name="password" type="password" required minLength={6} className="w-full px-3 py-2 text-sm" />
          </label>
          <button className="w-full rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white">Sign In</button>
        </form>

        <div className="my-5 border-t border-line" />

        <form action={signUp} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Create account</h2>
            <p className="mt-1 text-xs text-muted">Use the same email/password fields below to create a Supabase Auth user.</p>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Email</span>
            <input name="email" type="email" required className="w-full px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Password</span>
            <input name="password" type="password" required minLength={6} className="w-full px-3 py-2 text-sm" />
          </label>
          <button className="w-full rounded-lg border border-cyan/40 bg-cyan/15 px-3 py-2 text-sm font-medium text-cyan">Create Account</button>
        </form>
      </section>
    </main>
  );
}
