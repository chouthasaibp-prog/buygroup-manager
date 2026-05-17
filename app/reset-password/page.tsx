import { updatePassword } from "@/app/login/actions";
import PasswordInput from "@/app/login/PasswordInput";

type Props = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-xl border border-cyan/20 bg-panel/90 p-6 shadow-glow">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-[.18em] text-cyan/80">Buy Group Ops</div>
          <h1 className="mt-2 text-2xl font-semibold text-white">Choose a new password</h1>
          <p className="mt-2 text-sm text-muted">Enter and confirm your new password to finish the reset.</p>
        </div>

        {params.error && <div className="mb-4 rounded-lg border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">{params.error}</div>}
        {params.message && <div className="mb-4 rounded-lg border border-green-300/30 bg-green-500/10 px-3 py-2 text-sm text-green-100">{params.message}</div>}

        <form action={updatePassword} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">New password</span>
            <PasswordInput name="password" required minLength={6} className="px-3 py-2 text-sm" autoComplete="new-password" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Confirm password</span>
            <PasswordInput name="confirmPassword" required minLength={6} className="px-3 py-2 text-sm" autoComplete="new-password" />
          </label>
          <button className="w-full rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white">Update password</button>
        </form>
      </section>
    </main>
  );
}
