import { redirect } from "next/navigation";
import Welcome from "@/components/Welcome";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Home() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (user) redirect("/reservar");
  return <Welcome />;
}
