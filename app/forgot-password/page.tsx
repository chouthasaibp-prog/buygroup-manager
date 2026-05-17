import Link from "next/link";
import { requestPasswordReset } from "@/app/login/actions";

type Props = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-xl border border-cyan/20 bg-panel/90 p-6 shadow-glow">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-[.18em] text-cyan/80">Buy Group Ops</div>
          <h1 className="mt-2 text-2xl font-semibold text-white">Reset password</h1>
          <p className="mt-2 text-sm text-muted">Enter your email and Supabase will send a secure password reset link.</p>
        </div>

        {params.error && <div className="mb-4 rounded-lg border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">{params.error}</div>}
        {params.message && <div className="mb-4 rounded-lg border border-green-300/30 bg-green-500/10 px-3 py-2 text-sm text-green-100">{params.message}</div>}

        <form action={requestPasswordReset} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Email</span>
            <input name="email" type="email" required className="w-full px-3 py-2 text-sm" autoComplete="email" />
          </label>
          <button className="w-full rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white">Send reset link</button>
        </form>

        <div className="mt-5 text-center text-sm text-muted">
          <Link href="/login" className="text-cyan hover:text-white">Back to sign in</Link>
        </div>
      </section>
    </main>
  );
}
