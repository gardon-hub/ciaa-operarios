import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: {} }));

import { calcularUniformidad, encolar, enviarCola, hoyHN, leerCola } from "./datos";

describe("calcularUniformidad", () => {
  it("calcula promedio y % dentro de ±10 % igual que la base de datos", () => {
    // Mismo ejemplo que la prueba de la migración: promedio 1572 g, 80 %
    const r = calcularUniformidad([1500, 1550, 1600, 1620, 1580, 1490, 1610, 1570, 1300, 1900])!;
    expect(r).toEqual({ n: 10, media: 1572, uniformidad: 80, min: 1300, max: 1900 });
  });

  it("redondea a un decimal", () => {
    const r = calcularUniformidad([1000, 1000, 1001])!;
    expect(r.media).toBe(1000.3);
    expect(r.uniformidad).toBe(100);
  });

  it("devuelve null sin pesos", () => {
    expect(calcularUniformidad([])).toBeNull();
  });
});

describe("hoyHN", () => {
  it("usa la hora de Honduras (UTC-6)", () => {
    expect(hoyHN(new Date("2026-10-19T03:00:00Z"))).toBe("2026-10-18");
    expect(hoyHN(new Date("2026-10-19T07:00:00Z"))).toBe("2026-10-19");
  });
});

describe("cola de envíos", () => {
  beforeEach(() => localStorage.clear());

  const base = { tipo: "produccion" as const, lote_id: "l", fecha: "2026-10-18", datos: { huevos_total: 1 } };

  it("envía en orden y vacía la cola", async () => {
    encolar({ ...base, client_uuid: "a" });
    encolar({ ...base, client_uuid: "b" });
    const llamadas: string[] = [];
    const n = await enviarCola(async (_fn, args) => {
      llamadas.push(String(args.p_client_uuid));
      return { error: null };
    });
    expect(n).toBe(2);
    expect(llamadas).toEqual(["a", "b"]);
    expect(leerCola()).toEqual([]);
  });

  it("sin conexión conserva todo para reintentar", async () => {
    encolar({ ...base, client_uuid: "a" });
    encolar({ ...base, client_uuid: "b" });
    const n = await enviarCola(async () => ({ error: { message: "TypeError: Failed to fetch" } }));
    expect(n).toBe(0);
    expect(leerCola().map((e) => [e.client_uuid, e.error])).toEqual([["a", undefined], ["b", undefined]]);
  });

  it("un rechazo del servidor se marca y no bloquea los demás", async () => {
    encolar({ ...base, client_uuid: "a" });
    encolar({ ...base, client_uuid: "b" });
    const n = await enviarCola(async (_fn, args) =>
      args.p_client_uuid === "a" ? { error: { message: "La fecha no puede ser futura", code: "P0001" } } : { error: null },
    );
    expect(n).toBe(1);
    expect(leerCola()).toMatchObject([{ client_uuid: "a", error: "La fecha no puede ser futura" }]);
    // Un envío con error no se reintenta solo
    const otra = vi.fn(async () => ({ error: null }));
    await enviarCola(otra);
    expect(otra).not.toHaveBeenCalled();
  });
});
