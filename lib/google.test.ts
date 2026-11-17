import { beforeAll, expect, it } from "vitest";
import { authUrl, decrypt, encrypt } from "./google";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "test-key";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.GOOGLE_CLIENT_ID = "cid";
});

it("cifra y descifra el refresh token", async () => {
  const e = await encrypt("1//refresh");
  expect(e).not.toContain("refresh");
  expect(await decrypt(e)).toBe("1//refresh");
});

it("URL OAuth pide scope calendar.events, offline y consent", () => {
  const u = new URL(authUrl("st"));
  expect(u.searchParams.get("scope")).toContain("calendar.events");
  expect(u.searchParams.get("access_type")).toBe("offline");
  expect(u.searchParams.get("prompt")).toBe("consent");
  expect(u.searchParams.get("state")).toBe("st");
});
