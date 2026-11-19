/** Recorre una consulta paginada (PostgREST devuelve como mucho 1000 filas por petición). */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>): Promise<T[]> {
  const out: unknown[] = [];
  for (let i = 0; ; i += 1000) {
    const { data } = await page(i, i + 999);
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  return out as T[];
}
