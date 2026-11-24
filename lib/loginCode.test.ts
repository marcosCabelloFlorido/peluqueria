import { beforeAll, describe, expect, it } from "vitest";
import { hashCode, newCode, normEmail, sameHash } from "./loginCode";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "clave-ficticia-solo-para-tests";
});

describe("normEmail", () => {
  it("recorta espacios y pasa a minúsculas", () => {
    expect(normEmail("  Ana.Lopez@Example.COM \n")).toBe("ana.lopez@example.com");
  });
});

describe("newCode", () => {
  it("devuelve siempre 6 dígitos numéricos", () => {
    for (let i = 0; i < 200; i++) {
      expect(newCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashCode", () => {
  it("es determinista", async () => {
    expect(await hashCode("a@b.com", "123456")).toBe(await hashCode("a@b.com", "123456"));
  });

  it("devuelve HMAC-SHA256 en hexadecimal", async () => {
    expect(await hashCode("a@b.com", "123456")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("cambia con otro email", async () => {
    expect(await hashCode("a@b.com", "123456")).not.toBe(await hashCode("c@b.com", "123456"));
  });

  it("cambia con otro código", async () => {
    expect(await hashCode("a@b.com", "123456")).not.toBe(await hashCode("a@b.com", "654321"));
  });

  it("normaliza el email", async () => {
    expect(await hashCode("  A@B.com ", "123456")).toBe(await hashCode("a@b.com", "123456"));
  });

  it("no contiene el código en claro", async () => {
    const code = "123456";
    expect(await hashCode("a@b.com", code)).not.toContain(code);
  });
});

describe("sameHash", () => {
  it("true con cadenas iguales", () => {
    expect(sameHash("abc123", "abc123")).toBe(true);
  });

  it("false con mismo largo y distinto contenido", () => {
    expect(sameHash("abc123", "abc124")).toBe(false);
  });

  it("false con distinto largo", () => {
    expect(sameHash("abc123", "abc1234")).toBe(false);
  });
});
