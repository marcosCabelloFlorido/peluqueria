"use client";
import { useActionState } from "react";
import ErrorBox from "@/components/ErrorBox";
import { adminCreateClient, type NewClientState } from "@/app/admin/clientes/actions";

// Formulario de alta: si el servidor devuelve un error, conserva lo escrito y marca el campo.
export default function NewClientForm() {
  const [state, action, pending] = useActionState<NewClientState, FormData>(adminCreateClient, {});
  const v = state.values ?? {};
  const bad = (k: NonNullable<NewClientState["field"]>) => (state.field === k ? { "aria-invalid": true, "aria-describedby": "form-error", autoFocus: true } : {});
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error && <div id="form-error"><ErrorBox>{state.error}</ErrorBox></div>}
      <label className="flex flex-col gap-1.5"><span className="text-sm text-g4">Nombre</span><input key={`n${v.full_name}`} className="field" name="full_name" required minLength={2} maxLength={100} autoComplete="off" defaultValue={v.full_name} {...bad("full_name")} /></label>
      <label className="flex flex-col gap-1.5"><span className="text-sm text-g4">Email</span><input key={`e${v.email}`} className="field" type="email" name="email" required maxLength={200} autoComplete="off" defaultValue={v.email} {...bad("email")} /></label>
      <label className="flex flex-col gap-1.5"><span className="text-sm text-g4">Teléfono (opcional)</span><input key={`p${v.phone}`} className="field" type="tel" name="phone" maxLength={30} autoComplete="off" defaultValue={v.phone} {...bad("phone")} /></label>
      <label className="flex flex-col gap-1.5"><span className="text-sm text-g4">Cumpleaños (opcional)</span><input key={`b${v.birthday}`} className="field" type="date" name="birthday" defaultValue={v.birthday} {...bad("birthday")} /></label>
      <button className="btn btn-primary mt-2" disabled={pending}>{pending ? "Creando…" : "Crear cliente"}</button>
    </form>
  );
}
