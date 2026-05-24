import Link from "next/link";
import { loginAction } from "../actions";
import { Logo } from "@/components/Logo";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 flex flex-col items-center gap-3">
          <Logo size={36} />
          <div className="text-[13px] text-secondary">Your design system. Inside Claude.</div>
        </div>
        <form action={loginAction} className="card p-6 flex flex-col gap-5">
          {searchParams.error && (
            <div className="bg-red/10 border border-red/20 rounded-lg px-3 py-2.5 text-[13px] text-red">
              {searchParams.error}
            </div>
          )}
          <Field label="Email" name="email" type="email" required autoFocus />
          <Field label="Password" name="password" type="password" required />
          <button className="btn btn-primary justify-center">Sign in →</button>
          <div className="text-[12px] text-secondary text-center">
            No account?{" "}
            <Link href="/signup" className="text-accent hover:underline">Sign up free</Link>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-secondary">{label}</span>
      <input className="input" {...props} />
    </label>
  );
}
