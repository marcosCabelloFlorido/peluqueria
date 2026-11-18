"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Alert, Arrow, Back, Eye, EyeOff } from "@/components/Icons";
import ThemeToggle from "@/components/ThemeToggle";

// otp: pide email · code: introduce el código recibido · in/up: con contraseña · reset: recuperar
type Mode = "otp" | "code" | "in" | "up" | "reset";

const REASONS: Record<string, string> = {
  user_already_exists: "Ya existe una cuenta con este email. Entra o recupera la contraseña.",
  email_exists: "Ya existe una cuenta con este email. Entra o recupera la contraseña.",
  over_email_send_rate_limit: "Demasiados intentos. Espera unos minutos y vuelve a probar.",
  over_request_rate_limit: "Demasiados intentos. Espera unos minutos y vuelve a probar.",
  weak_password: "La contraseña es demasiado débil. Usa una más larga o más difícil.",
  email_address_invalid: "El email no es válido.",
  signup_disabled: "Los registros están desactivados ahora mismo.",
  email_not_confirmed: "Confirma tu email antes de entrar. Revisa tu bandeja de entrada.",
  otp_expired: "El código ha caducado o no es correcto. Pide uno nuevo.",
};

function Form() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/reservar";
  const [mode, setMode] = useState<Mode>("otp");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const sb = supabaseBrowser();
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const pwMode = mode === "in" || mode === "up";
  const to = (m: Mode) => { setMode(m); setErr(""); setInfo(""); setShow(false); };
  // Atrás: sube un nivel dentro del login; en el primer nivel, vuelve a la página anterior.
  const back = () => {
    if (mode === "code" || pwMode) return to("otp");
    if (mode === "reset") return to("in");
    if (window.history.length > 1) router.back(); else router.push("/reservar");
  };

  async function sendCode() {
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    if (error) {
      setErr(REASONS[error.code ?? ""] ?? "No se pudo enviar el código. Inténtalo de nuevo en unos minutos.");
      return false;
    }
    return true;
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    setInfo("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const mail = String(f.get("email") ?? email).trim();
    const password = String(f.get("password") ?? "");

    if (mode === "otp") {
      if (await sendCode()) { setMode("code"); setInfo(`Te hemos enviado un código a ${mail}.`); }
      return setBusy(false);
    }
    if (mode === "code") {
      const { error } = await sb.auth.verifyOtp({ email: mail, token: String(f.get("code") ?? "").replace(/\s/g, ""), type: "email" });
      if (error) {
        setErr(REASONS[error.code ?? ""] ?? "Código incorrecto o caducado. Revísalo o pide uno nuevo.");
        return setBusy(false);
      }
      window.location.href = next;
      return;
    }
    if (mode === "reset") {
      await sb.auth.resetPasswordForEmail(mail, { redirectTo: `${origin}/auth/callback?next=/perfil` });
      setInfo("Si el email existe, recibirás un enlace para restablecer la contraseña.");
      return setBusy(false);
    }
    const res =
      mode === "in"
        ? await sb.auth.signInWithPassword({ email: mail, password })
        : await sb.auth.signUp({
            email: mail,
            password,
            options: { data: { full_name: String(f.get("full_name")), phone: String(f.get("phone") || "") } },
          });
    if (res.error) {
      setErr(REASONS[res.error.code ?? ""] ?? (mode === "in" ? "Email o contraseña incorrectos." : "No se pudo crear la cuenta. Inténtalo de nuevo en unos minutos."));
      return setBusy(false);
    }
    if (!res.data.session) {
      setInfo("Revisa tu email para confirmar la cuenta.");
      return setBusy(false);
    }
    window.location.href = next;
  }

  const errProps = { "aria-invalid": !!err, "aria-describedby": err ? "auth-err" : undefined };
  const title = { otp: "Entrar", code: "Introduce el código", in: "Entrar con contraseña", up: "Crear cuenta", reset: "Recuperar acceso" }[mode];
  const lead = {
    otp: "Te enviamos un código por email. Sin contraseñas.",
    code: "Mira tu bandeja de entrada (y el spam).",
    in: "Con tu cuenta ves y gestionas tus citas, y reservar es más rápido.",
    up: "Con tu cuenta ves y gestionas tus citas, y reservar es más rápido.",
    reset: "Te enviaremos un enlace por email.",
  }[mode];
  const cta = { otp: "Enviarme el código", code: "Entrar", in: "Entrar", up: "Crear cuenta", reset: "Enviar enlace" }[mode];

  return (
    <main className="mx-auto max-w-md min-h-dvh px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button type="button" onClick={back} aria-label="Volver" className="size-11 -ml-3 grid place-items-center cursor-pointer"><Back /></button>
          <Link href="/" className="display text-xl font-semibold">
            DouceCreative
          </Link>
        </div>
        <ThemeToggle />
      </div>
      <h1 className="display text-4xl mt-8 mb-2">{title}</h1>
      <p className="text-g4 mb-6">{lead}</p>

      {pwMode && (
        <div role="tablist" className="seg mb-5">
          {(["in", "up"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => to(m)} className="cursor-pointer">
              {m === "in" ? "Entrar" : "Crear cuenta"}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-1.5">
        {mode === "up" && (
          <>
            <label htmlFor="l-name" className="text-sm text-g4">Nombre</label>
            <input id="l-name" className="field" name="full_name" placeholder="Tu nombre" autoComplete="name" required />
          </>
        )}
        <label htmlFor="l-email" className={`text-sm text-g4 ${mode === "up" ? "mt-2" : ""}`}>Email</label>
        <input id="l-email" className="field" name="email" type="email" inputMode="email" {...errProps} placeholder="nombre@gmail.com" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} readOnly={mode === "code"} required />
        {mode === "up" && (
          <>
            <label htmlFor="l-phone" className="text-sm text-g4 mt-2">Teléfono (opcional)</label>
            <input id="l-phone" className="field" name="phone" type="tel" inputMode="tel" placeholder="612 345 678" autoComplete="tel" />
          </>
        )}
        {mode === "code" && (
          <>
            <label htmlFor="l-code" className="text-sm text-g4 mt-2">Código</label>
            <input id="l-code" className="field text-center text-2xl tracking-[.4em] tabular-nums" name="code" inputMode="numeric" {...errProps} placeholder="······"
              autoComplete="one-time-code" pattern="\d{6,8}" maxLength={8} autoFocus required />
          </>
        )}
        {pwMode && (
          <>
            <label htmlFor="l-pw" className="text-sm text-g4 mt-2">Contraseña</label>
            <div className="relative">
              <input id="l-pw" className="field !pr-12" name="password" {...errProps} type={show ? "text" : "password"} minLength={6}
                autoComplete={mode === "in" ? "current-password" : "new-password"} required />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={show}
                className="absolute right-0 top-0 size-[52px] grid place-items-center cursor-pointer text-g4 hover:text-ink">
                {show ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </>
        )}
        {err && (
          <p role="alert" id="auth-err" className="mt-2 text-sm border border-ink rounded-xl px-3 py-2 flex gap-2 items-start">
            <Alert />
            {err}
          </p>
        )}
        {info && (
          <p role="status" className="mt-2 text-sm text-g4">
            {info}
          </p>
        )}
        <button className="btn btn-primary mt-3" disabled={busy}>
          {cta} <Arrow />
        </button>
      </form>

      <div className="mt-4 flex flex-col items-center">
        {mode === "otp" && <button className="link" onClick={() => to("in")}>Entrar con contraseña</button>}
        {mode === "code" && (
          <button className="link" disabled={busy} onClick={async () => {
            setErr(""); setBusy(true);
            if (await sendCode()) setInfo("Código reenviado. El anterior ya no vale.");
            setBusy(false);
          }}>Reenviar código</button>
        )}
        {mode === "in" && (
          <>
            <button className="link" onClick={() => to("reset")}>¿Olvidaste tu contraseña?</button>
            <button className="link" onClick={() => to("otp")}>Mejor entrar con un código por email</button>
          </>
        )}
        {mode === "up" && <button className="link" onClick={() => to("otp")}>Mejor entrar con un código por email</button>}
        {mode === "reset" && <button className="link" onClick={() => to("in")}>Volver</button>}
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
