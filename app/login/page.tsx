"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Alert, Arrow } from "@/components/Icons";

function Form() {
  const next = useSearchParams().get("next") || "/reservar";
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const sb = supabaseBrowser();
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    setInfo("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password") ?? "");
    if (mode === "reset") {
      await sb.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/perfil` });
      setInfo("Si el email existe, recibirás un enlace para restablecer la contraseña.");
      return setBusy(false);
    }
    const res =
      mode === "in"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({
            email,
            password,
            options: { data: { full_name: String(f.get("full_name")), phone: String(f.get("phone") || "") } },
          });
    if (res.error) {
      const code = res.error.code ?? "";
      const reason: Record<string, string> = {
        user_already_exists: "Ya existe una cuenta con este email. Entra o recupera la contraseña.",
        email_exists: "Ya existe una cuenta con este email. Entra o recupera la contraseña.",
        over_email_send_rate_limit: "Demasiados intentos. Espera unos minutos y vuelve a probar.",
        over_request_rate_limit: "Demasiados intentos. Espera unos minutos y vuelve a probar.",
        weak_password: "La contraseña es demasiado débil. Usa una más larga o más difícil.",
        email_address_invalid: "El email no es válido.",
        signup_disabled: "Los registros están desactivados ahora mismo.",
        email_not_confirmed: "Confirma tu email antes de entrar. Revisa tu bandeja de entrada.",
      };
      setErr(reason[code] ?? (mode === "in" ? "Email o contraseña incorrectos." : "No se pudo crear la cuenta. Inténtalo de nuevo en unos minutos."));
      return setBusy(false);
    }
    if (!res.data.session) {
      setInfo("Revisa tu email para confirmar la cuenta.");
      return setBusy(false);
    }
    window.location.href = next;
  }

  return (
    <main className="mx-auto max-w-md min-h-dvh px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-10">
      <Link href="/" className="display text-xl font-semibold">
        DouceCreative
      </Link>
      <h1 className="display text-4xl mt-10 mb-2">
        {mode === "up" ? "Crear cuenta" : mode === "reset" ? "Recuperar acceso" : "Entrar"}
      </h1>
      <p className="text-g4 mb-6">
        {mode === "reset" ? "Te enviaremos un enlace por email." : "Con tu cuenta ves y gestionas tus citas, y reservar es más rápido."}
      </p>

      {mode !== "reset" && (
        <>
          <div role="tablist" className="seg mb-5">
            {(["in", "up"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className="cursor-pointer"
              >
                {m === "in" ? "Entrar" : "Crear cuenta"}
              </button>
            ))}
          </div>
        </>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3">
        {mode === "up" && <input className="field" name="full_name" placeholder="Nombre" autoComplete="name" required />}
        <input className="field" name="email" type="email" aria-invalid={!!err} aria-describedby={err ? "auth-err" : undefined} placeholder="Email" autoComplete="email" required />
        {mode === "up" && <input className="field" name="phone" type="tel" placeholder="Teléfono (opcional)" autoComplete="tel" />}
        {mode !== "reset" && (
          <input
            className="field"
            name="password"
            aria-invalid={!!err}
            aria-describedby={err ? "auth-err" : undefined}
            type="password"
            placeholder="Contraseña"
            minLength={6}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            required
          />
        )}
        {err && (
          <p role="alert" id="auth-err" className="text-sm border border-ink rounded-xl px-3 py-2 flex gap-2 items-start">
            <Alert />
            {err}
          </p>
        )}
        {info && (
          <p role="status" className="text-sm text-g4">
            {info}
          </p>
        )}
        <button className="btn btn-primary mt-2" disabled={busy}>
          {mode === "in" ? "Entrar" : mode === "up" ? "Crear cuenta" : "Enviar enlace"} <Arrow />
        </button>
      </form>
      <div className="mt-4 text-center">
        {mode === "reset" ? (
          <button className="link" onClick={() => setMode("in")}>
            Volver
          </button>
        ) : (
          <button className="link" onClick={() => setMode("reset")}>
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </div>
    </main>
  );
}

export default function Login() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
