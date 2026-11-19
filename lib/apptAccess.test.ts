import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./supabase/server", () => ({ supabaseServer: vi.fn(), supabaseService: vi.fn() }));

import { isUnsubLinkValid, unsubApiUrl, unsubToken, optOutClient, TEST_CLIENT_ID } from "./apptAccess";

const id = "11111111-1111-4111-8111-111111111111";

describe("baja de avisos", () => {
  beforeAll(() => { process.env.APPT_LINK_SECRET = "test-secret"; process.env.NEXT_PUBLIC_SITE_URL = "https://x.test"; });

  it("valida solo el token correcto y un uuid", async () => {
    const t = await unsubToken(id);
    expect(await isUnsubLinkValid(id, t)).toBe(true);
    expect(await isUnsubLinkValid(id, "mal")).toBe(false);
    expect(await isUnsubLinkValid("no-uuid", t)).toBe(false);
    expect(await isUnsubLinkValid(null, t)).toBe(false);
  });
  it("URL de API absoluta con c y t", async () => {
    expect(await unsubApiUrl(id)).toBe(`https://x.test/api/baja?c=${id}&t=${await unsubToken(id)}`);
  });
  it("uuid de prueba no toca la BD", async () => {
    expect(await optOutClient(TEST_CLIENT_ID, await unsubToken(TEST_CLIENT_ID))).toBe("test");
    expect(await optOutClient(id, "mal")).toBe("invalid");
  });
});
