import { redirect } from "next/navigation";

// Los ajustes viven ahora en las secciones del panel.
export default function Ajustes() {
  redirect("/admin");
}
