import Link from "next/link";
import { signupAction } from "../actions";

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-10">
      <form action={signupAction} className="shell w-full max-w-sm">
        <div className="h-12 border-b-2 border-ink flex items-center px-5 bg-panel">
          <span className="text-[11px] font-bold tracking-[2px] uppercase">Sign up</span>
        </div>
        <div className="p-5 flex flex-col gap-4">
          {searchParams.error && (
            <div className="border-2 border-[#D97706] bg-[#FFF8EC] p-2 text-[10px] text-[#92400E]">
              {searchParams.error}
            </div>
          )}
          <Field label="Email" name="email" type="email" required />
          <Field label="Password" name="password" type="password" required minLength={6} />
          <button className="btn btn-primary justify-center">Create account →</button>
          <div className="text-[10px] text-soft text-center">
            Have an account?{" "}
            <Link href="/login" className="underline">Log in</Link>
          </div>
        </div>
      </form>
    </main>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[8px] tracking-[1.5px] uppercase text-ink-mute">{label}</span>
      <input className="input" {...props} />
    </label>
  );
}
