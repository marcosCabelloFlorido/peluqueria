"use client";
/* eslint-disable @next/next/no-img-element -- URLs firmadas temporales del almacén privado: next/image no aporta */
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { adminAddPhoto, adminDeletePhoto, adminUpdatePhotoCaption } from "@/app/admin/clientes/actions";
import { Alert } from "./Icons";

export type Photo = { id: string; url: string; caption: string | null; date: string };

const MAX_SIDE = 1600;

/** Reduce a ~1600 px y JPEG 0.8 antes de subir (las fotos del móvil pesan varios MB). */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", 0.8));
}

const ErrBox = ({ children }: { children: React.ReactNode }) => (
  <p role="alert" className="flex items-start gap-2 rounded-2xl border border-ink px-3 py-2 text-sm"><Alert />{children}</p>
);

function Detail({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const r = useRouter();
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: true } | { error: string }>, done?: () => void) => start(async () => {
    const x = await fn();
    if ("error" in x) return setErr(x.error);
    setErr("");
    done?.();
    r.refresh();
  });
  return (
    <div className="p-4">
      <img src={photo.url} alt={photo.caption ?? `Foto del ${photo.date}`} className="w-full max-h-[60dvh] object-contain rounded-xl bg-tint" />
      <p className="text-sm text-g3 mt-2">{photo.date}</p>
      <form className="flex gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); run(() => adminUpdatePhotoCaption(photo.id, caption)); }}>
        <input className="field !min-h-11" value={caption} maxLength={120} onChange={(e) => setCaption(e.target.value)} placeholder="Pie de foto (lateral izquierdo, nuca…)" aria-label="Pie de foto" />
        <button className="btn btn-secondary !min-h-11 text-sm" disabled={pending || caption === (photo.caption ?? "")}>Guardar</button>
      </form>
      {err && <div className="mt-3"><ErrBox>{err}</ErrBox></div>}
      <div className="flex gap-2 mt-3">
        {confirm ? (
          <>
            <button type="button" className="btn btn-primary !min-h-11 text-sm" disabled={pending} onClick={() => run(() => adminDeletePhoto(photo.id), onClose)}>Sí, eliminar foto</button>
            <button type="button" className="btn btn-secondary !min-h-11 text-sm" onClick={() => setConfirm(false)}>No</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-secondary !min-h-11 text-sm" onClick={() => setConfirm(true)}>Eliminar</button>
            <button type="button" className="btn btn-primary !min-h-11 text-sm" onClick={onClose} autoFocus>Cerrar</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ClientPhotos({ clientId, photos }: { clientId: string; photos: Photo[] }) {
  const r = useRouter();
  const dlg = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const current = photos.find((p) => p.id === open) ?? null;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const sb = supabaseBrowser();
    const list = [...files];
    const failed: string[] = [];
    for (let i = 0; i < list.length; i++) {
      setBusy(`Subiendo ${i + 1} de ${list.length}…`);
      try {
        const blob = await shrink(list[i]);
        const path = `${clientId}/${crypto.randomUUID()}.jpg`;
        const up = await sb.storage.from("client-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        const saved = await adminAddPhoto({ clientId, path, caption: caption.trim() || undefined });
        if ("error" in saved) throw new Error(saved.error);
      } catch {
        failed.push(list[i].name);
      }
    }
    setBusy("");
    setErr(failed.length ? `No se pudo subir: ${failed.join(", ")}.` : "");
    if (input.current) input.current.value = "";
    if (failed.length < list.length) setCaption("");
    r.refresh();
  }

  return (
    <div>
      {photos.length === 0
        ? <p className="text-g4 card py-8 text-center">Sin fotos todavía.</p>
        : (
          <ul className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <li key={p.id}>
                <button type="button" className="block w-full aspect-square rounded-xl overflow-hidden bg-tint relative" aria-label={`Ver foto${p.caption ? `: ${p.caption}` : ` del ${p.date}`}`}
                  onClick={() => { setOpen(p.id); dlg.current?.showModal(); }}>
                  <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
                  {p.caption && <span className="absolute inset-x-0 bottom-0 bg-paper/85 text-[11px] leading-tight px-1.5 py-1 truncate text-left">{p.caption}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}

      <div className="card p-4 mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-g4">Pie de foto (opcional, para las fotos que subas ahora)</span>
          <input className="field !min-h-11" value={caption} maxLength={120} onChange={(e) => setCaption(e.target.value)} placeholder="Lateral izquierdo, nuca…" />
        </label>
        <label className={`btn btn-primary !min-h-12 cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}>
          {busy || "Hacer o subir fotos"}
          <input ref={input} type="file" accept="image/*" capture="environment" multiple className="sr-only" disabled={!!busy} onChange={(e) => upload(e.target.files)} />
        </label>
        {err && <ErrBox>{err}</ErrBox>}
      </div>

      <dialog ref={dlg} aria-label="Foto del cliente" className="m-auto w-[min(95vw,36rem)] rounded-2xl border border-g2 bg-paper text-ink p-0 backdrop:bg-ink/40"
        onClose={() => setOpen(null)} onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        {current && <Detail key={current.id} photo={current} onClose={() => dlg.current?.close()} />}
      </dialog>
    </div>
  );
}
