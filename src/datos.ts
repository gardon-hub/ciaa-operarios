import { supabase } from "./supabase";

export type TipoCaptura = "produccion" | "uniformidad" | "venta";
export type Datos = Record<string, unknown>;

export interface Catalogo {
  lotes: { id: string; codigo: string; nombre: string }[];
  clientes: { id: string; nombre: string }[];
  productos: { id: string; nombre: string; unidad: string; precio_sugerido: number; unidades_por_carton: number }[];
  formas_pago: string[];
}

export interface CapturaServidor {
  id: string;
  client_uuid: string;
  tipo: TipoCaptura;
  lote_id: string | null;
  fecha: string;
  datos: Datos;
  estado: "pendiente" | "aprobada" | "rechazada";
  motivo_rechazo: string | null;
  created_at: string;
  revisado_en: string | null;
}

/** Fecha de hoy en Honduras, "AAAA-MM-DD". */
export function hoyHN(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Tegucigalpa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

export function nuevoId(): string {
  return crypto.randomUUID();
}

// ---------- Uniformidad ----------

export interface ResultadoUniformidad {
  n: number;
  media: number;
  uniformidad: number;
  min: number;
  max: number;
}

/**
 * Peso promedio y % de aves dentro de ±10 % del promedio.
 * Redondeo igual al de la base de datos (1 decimal), que recalcula al recibir.
 */
export function calcularUniformidad(pesos: number[]): ResultadoUniformidad | null {
  if (pesos.length === 0) return null;
  const media = pesos.reduce((a, b) => a + b, 0) / pesos.length;
  const dentro = pesos.filter((p) => p >= media * 0.9 && p <= media * 1.1).length;
  return {
    n: pesos.length,
    media: Math.round(media * 10) / 10,
    uniformidad: Math.round((1000 * dentro) / pesos.length) / 10,
    min: Math.min(...pesos),
    max: Math.max(...pesos),
  };
}

// ---------- Catálogo (con copia en el teléfono para usarlo sin señal) ----------

const CLAVE_CATALOGO = "ciaa-op-catalogo";

export function catalogoGuardado(): Catalogo | null {
  try {
    const raw = localStorage.getItem(CLAVE_CATALOGO);
    return raw ? (JSON.parse(raw) as Catalogo) : null;
  } catch {
    return null;
  }
}

export async function actualizarCatalogo(): Promise<Catalogo> {
  const { data, error } = await supabase.rpc("op_catalogo");
  if (error) throw error;
  try {
    localStorage.setItem(CLAVE_CATALOGO, JSON.stringify(data));
  } catch {
    /* sin almacenamiento: se usa solo en memoria */
  }
  return data as Catalogo;
}

// ---------- Cola de envíos ----------

export interface EnvioEnCola {
  client_uuid: string;
  tipo: TipoCaptura;
  lote_id: string | null;
  fecha: string;
  datos: Datos;
  creado: string;
  /** Mensaje del servidor si rechazó el envío (no se reintenta solo) */
  error?: string;
}

const CLAVE_COLA = "ciaa-op-cola";

export function leerCola(): EnvioEnCola[] {
  try {
    const raw = localStorage.getItem(CLAVE_COLA);
    return raw ? (JSON.parse(raw) as EnvioEnCola[]) : [];
  } catch {
    return [];
  }
}

function guardarCola(cola: EnvioEnCola[]) {
  localStorage.setItem(CLAVE_COLA, JSON.stringify(cola));
  window.dispatchEvent(new Event("ciaa-op-cola"));
}

export function encolar(envio: Omit<EnvioEnCola, "creado">): void {
  guardarCola([...leerCola(), { ...envio, creado: new Date().toISOString() }]);
}

export function quitarDeCola(clientUuid: string): void {
  guardarCola(leerCola().filter((e) => e.client_uuid !== clientUuid));
}

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: { message: string; code?: string } | null }>;

/**
 * Error de la base de datos (validación, permisos): el envío no va a pasar
 * reintentando. Sin código suele ser un fallo de red: se reintenta después.
 */
function esRechazoDelServidor(error: { code?: string }): boolean {
  return typeof error.code === "string" && error.code.length > 0;
}

let enviando = false;

/** Envía la cola en orden. Devuelve cuántos se enviaron. */
export async function enviarCola(rpc: Rpc = (fn, args) => supabase.rpc(fn, args)): Promise<number> {
  if (enviando) return 0;
  enviando = true;
  let enviados = 0;
  try {
    for (const envio of leerCola()) {
      if (envio.error) continue;
      const { error } = await rpc("op_enviar_captura", {
        p_client_uuid: envio.client_uuid,
        p_tipo: envio.tipo,
        p_lote_id: envio.lote_id,
        p_fecha: envio.fecha,
        p_datos: envio.datos,
      });
      if (!error) {
        quitarDeCola(envio.client_uuid);
        enviados++;
      } else if (esRechazoDelServidor(error)) {
        guardarCola(leerCola().map((e) => (e.client_uuid === envio.client_uuid ? { ...e, error: error.message } : e)));
      } else {
        break; // sin conexión: se intenta más tarde
      }
    }
  } finally {
    enviando = false;
  }
  return enviados;
}

export async function misEnvios(): Promise<CapturaServidor[]> {
  const { data, error } = await supabase
    .from("capturas_operario")
    .select("id, client_uuid, tipo, lote_id, fecha, datos, estado, motivo_rechazo, created_at, revisado_en")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as CapturaServidor[];
}

export async function corregirEnvio(id: string, loteId: string | null, fecha: string, datos: Datos): Promise<void> {
  const { error } = await supabase.rpc("op_corregir_captura", {
    p_id: id,
    p_lote_id: loteId,
    p_fecha: fecha,
    p_datos: datos,
  });
  if (error) throw error;
}
