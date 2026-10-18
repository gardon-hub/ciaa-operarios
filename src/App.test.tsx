import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const catalogo = {
  lotes: [{ id: "lote-1", codigo: "L-001", nombre: "Postura A" }],
  clientes: [{ id: "cli-1", nombre: "Comedor UNAG" }],
  productos: [{ id: "prod-1", nombre: "Cartón de huevo", unidad: "carton", precio_sugerido: 105, unidades_por_carton: 30 }],
  formas_pago: ["efectivo", "transferencia", "credito", "donacion"],
};
const rpc = vi.fn();
const roles = vi.fn();

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { user: { id: "u1", email: "wilson@granja.ciaa", user_metadata: { full_name: "Wilson Andrade" } } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: vi.fn(),
    },
    from: (tabla: string) => ({
      select: () => ({
        eq: () => roles(),
        order: () => ({ limit: () => Promise.resolve({ data: tabla === "capturas_operario" ? [] : [], error: null }) }),
      }),
    }),
    rpc: (fn: string, args: unknown) => rpc(fn, args),
  },
}));

vi.mock("./foto", async (original) => ({
  ...(await original<typeof import("./foto")>()),
  comprimirFoto: async () => "data:image/jpeg;base64,/9j/AAAA",
}));

import { App } from "./App";

beforeEach(() => {
  localStorage.clear();
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => (fn === "op_catalogo" ? { data: catalogo, error: null } : { data: "id", error: null }));
  roles.mockResolvedValue({ data: [{ role: "operario" }], error: null });
});
afterEach(cleanup);

/** Abre una opción del inicio cuando ya se descargó la lista de lotes */
async function abrir(texto: string) {
  const boton = (await screen.findByText(texto)).closest("button")!;
  await waitFor(() => expect(boton.disabled).toBe(false));
  fireEvent.click(boton);
}

const escribir = (etiqueta: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

it("registra la producción del día y la envía", async () => {
  render(<App />);
  await abrir("Producción del día");
  escribir("Cartones (30)", "45");
  escribir("Huevos sueltos", "12");
  escribir("Huevos quebrados", "10");
  escribir("Aves muertas", "2");
  expect(screen.getByText("1,362")).toBeTruthy();
  fireEvent.click(screen.getByText("Enviar"));
  await screen.findByText("Enviado");
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("op_enviar_captura", expect.anything()));
  const args = rpc.mock.calls.find((c) => c[0] === "op_enviar_captura")![1];
  expect(args).toMatchObject({
    p_tipo: "produccion",
    p_lote_id: "lote-1", // único lote activo: se elige solo
    p_datos: { huevos_total: 1362, huevos_quebrados: 10, aves_muertas: 2 },
  });
});

it("no envía si los dañados superan el total", async () => {
  render(<App />);
  await abrir("Producción del día");
  escribir("Huevos sueltos", "5");
  escribir("Huevos quebrados", "10");
  fireEvent.click(screen.getByText("Enviar"));
  expect(await screen.findByText(/suman más que el total/)).toBeTruthy();
  expect(rpc).not.toHaveBeenCalledWith("op_enviar_captura", expect.anything());
});

it("calcula la uniformidad y exige 10 aves", async () => {
  render(<App />);
  await abrir("Uniformidad");
  const entrada = screen.getByPlaceholderText("Ej. 1580");
  for (const p of [1500, 1550, 1600, 1620, 1580, 1490, 1610, 1570, 1300]) {
    fireEvent.change(entrada, { target: { value: String(p) } });
    fireEvent.click(screen.getByText("Agregar"));
  }
  fireEvent.click(screen.getByText("Enviar"));
  expect(await screen.findByText(/al menos 10 aves \(llevas 9\)/)).toBeTruthy();
  fireEvent.change(entrada, { target: { value: "1900" } });
  fireEvent.click(screen.getByText("Agregar"));
  expect(screen.getByText("80 %")).toBeTruthy();
  fireEvent.click(screen.getByText("Enviar"));
  await screen.findByText("Enviado");
});

it("registra una venta con el precio sugerido", async () => {
  render(<App />);
  await abrir("Venta");
  escribir("Cliente", "cli-1");
  escribir("Producto", "prod-1");
  escribir("Cantidad (carton)", "4");
  expect(screen.getByText("L 420.00")).toBeTruthy();
  fireEvent.click(screen.getByText("Enviar"));
  await screen.findByText("Enviado");
  await waitFor(() =>
    expect(rpc).toHaveBeenCalledWith("op_enviar_captura", expect.objectContaining({
      p_tipo: "venta",
      p_datos: expect.objectContaining({ cliente_id: "cli-1", cantidad: 4, precio_unitario: 105, forma_pago: "efectivo" }),
    })),
  );
});

it("sin señal guarda en el teléfono", async () => {
  rpc.mockImplementation(async (fn: string) =>
    fn === "op_catalogo" ? { data: catalogo, error: null } : { data: null, error: { message: "TypeError: Failed to fetch" } },
  );
  // La lista de lotes quedó guardada la última vez que hubo señal
  localStorage.setItem("ciaa-op-catalogo", JSON.stringify(catalogo));
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  render(<App />);
  await abrir("Producción del día");
  escribir("Aves muertas", "1");
  fireEvent.click(screen.getByText("Enviar"));
  expect(await screen.findByText("Guardado en el teléfono")).toBeTruthy();
  expect(JSON.parse(localStorage.getItem("ciaa-op-cola")!)).toHaveLength(1);
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
});

it("rechaza cuentas que no son de operario", async () => {
  roles.mockResolvedValue({ data: [{ role: "admin" }], error: null });
  render(<App />);
  expect(await screen.findByText("Esta app es solo para operarios")).toBeTruthy();
});

it("la lectura del medidor exige la foto y la guarda con el envío", async () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  localStorage.setItem("ciaa-op-catalogo", JSON.stringify(catalogo));
  render(<App />);
  await abrir("Producción del día");
  escribir("Lectura del medidor", "209625.0");
  fireEvent.click(screen.getByText("Enviar"));
  expect(await screen.findByText("Toma la foto del medidor.")).toBeTruthy();
  const archivo = new File(["x"], "medidor.jpg", { type: "image/jpeg" });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [archivo] } });
  expect(await screen.findByAltText("Foto del medidor")).toBeTruthy();
  fireEvent.click(screen.getByText("Enviar"));
  expect(await screen.findByText("Guardado en el teléfono")).toBeTruthy();
  const [envio] = JSON.parse(localStorage.getItem("ciaa-op-cola")!);
  expect(envio).toMatchObject({ datos: { lectura_medidor_gal: 209625 }, foto: "data:image/jpeg;base64,/9j/AAAA" });
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
});
