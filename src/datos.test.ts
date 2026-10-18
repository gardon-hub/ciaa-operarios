import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: {} }));

const FOTO = "data:image/jpeg;base64,/9j/AAAA";

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

describe("cola con foto del medidor", () => {
  beforeEach(() => localStorage.clear());

  const conFoto = {
    client_uuid: "c1",
    tipo: "produccion" as const,
    lote_id: "l",
    fecha: "2026-10-18",
    datos: { lectura_medidor_gal: 209625 },
    foto: FOTO,
  };
  const uid = async () => "u1";

  it("sube la foto a la carpeta del operario y la enlaza al envío", async () => {
    encolar(conFoto);
    const subidas: string[] = [];
    const rpc = vi.fn(async () => ({ error: null }));
    await enviarCola(rpc, async (ruta, archivo) => {
      subidas.push(`${ruta}:${archivo.type}`);
      return { error: null };
    }, uid);
    expect(subidas).toEqual(["u1/c1.jpg:image/jpeg"]);
    expect(rpc).toHaveBeenCalledWith("op_enviar_captura", expect.objectContaining({
      p_datos: { lectura_medidor_gal: 209625, foto_medidor: "u1/c1.jpg" },
    }));
    expect(leerCola()).toEqual([]);
  });

  it("si la foto ya estaba subida (intento cortado), continúa", async () => {
    encolar(conFoto);
    const rpc = vi.fn(async () => ({ error: null }));
    await enviarCola(rpc, async () => ({ error: { message: "The resource already exists", statusCode: "409" } }), uid);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(leerCola()).toEqual([]);
  });

  it("sin señal conserva la foto para reintentar", async () => {
    encolar(conFoto);
    const rpc = vi.fn(async () => ({ error: null }));
    await enviarCola(rpc, async () => ({ error: { message: "Failed to fetch" } }), uid);
    expect(rpc).not.toHaveBeenCalled();
    expect(leerCola()).toMatchObject([{ client_uuid: "c1", foto: FOTO }]);
    expect(leerCola()[0].error).toBeUndefined();
  });

  it("un rechazo al subir la foto se marca como error", async () => {
    encolar(conFoto);
    const rpc = vi.fn(async () => ({ error: null }));
    await enviarCola(rpc, async () => ({ error: { message: "new row violates row-level security policy", statusCode: "403" } }), uid);
    expect(rpc).not.toHaveBeenCalled();
    expect(leerCola()[0].error).toMatch(/No se pudo subir la foto/);
  });
});
