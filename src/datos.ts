import { supabase } from "./supabase";
import { dataUrlABlob } from "./foto";

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
  /** Foto del medidor (JPEG en base64) pendiente de subir */
  foto?: string;
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

/** Lanza ErrorSinEspacio si el teléfono no tiene lugar para guardar el envío. */
export function encolar(envio: Omit<EnvioEnCola, "creado">): void {
  try {
    guardarCola([...leerCola(), { ...envio, creado: new Date().toISOString() }]);
  } catch {
    throw new ErrorSinEspacio();
  }
}

export class ErrorSinEspacio extends Error {
  constructor() {
    super("El teléfono no tiene espacio para guardar este registro sin señal. Envía primero los pendientes con conexión.");
  }
}

export function quitarDeCola(clientUuid: string): void {
  guardarCola(leerCola().filter((e) => e.client_uuid !== clientUuid));
}

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: { message: string; code?: string } | null }>;
type Subir = (ruta: string, archivo: Blob) => PromiseLike<{ error: { message: string; statusCode?: string } | null }>;

const subirFoto: Subir = (ruta, archivo) =>
  supabase.storage.from("capturas").upload(ruta, archivo, { contentType: "image/jpeg", upsert: false }) as unknown as PromiseLike<{
    error: { message: string; statusCode?: string } | null;
  }>;

async function usuarioActual(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Ruta de la foto en el almacenamiento: <id del operario>/<id del envío>.jpg */
export function rutaFoto(uid: string, clientUuid: string): string {
  return `${uid}/${clientUuid}.jpg`;
}

/**
 * Sube la foto. Si ya estaba subida (un intento anterior se cortó después de
 * subirla) también cuenta como éxito. Devuelve "red" si no hay conexión.
 */
async function asegurarFoto(subir: Subir, ruta: string, dataUrl: string): Promise<"ok" | "red" | string> {
  const { error } = await subir(ruta, dataUrlABlob(dataUrl));
  if (!error) return "ok";
  if (error.statusCode === "409" || /exist|duplicate/i.test(error.message)) return "ok";
  if (/fetch|network|failed/i.test(error.message) || !navigator.onLine) return "red";
  return `No se pudo subir la foto: ${error.message}`;
}

/**
 * Error de la base de datos (validación, permisos): el envío no va a pasar
 * reintentando. Sin código suele ser un fallo de red: se reintenta después.
 */
function esRechazoDelServidor(error: { code?: string }): boolean {
  return typeof error.code === "string" && error.code.length > 0;
}

function marcarError(clientUuid: string, mensaje: string) {
  guardarCola(leerCola().map((e) => (e.client_uuid === clientUuid ? { ...e, error: mensaje } : e)));
}

let enviando = false;

/** Envía la cola en orden. Devuelve cuántos se enviaron. */
export async function enviarCola(
  rpc: Rpc = (fn, args) => supabase.rpc(fn, args),
  subir: Subir = subirFoto,
  uid: () => Promise<string | null> = usuarioActual,
): Promise<number> {
  if (enviando) return 0;
  enviando = true;
  let enviados = 0;
  try {
    for (const envio of leerCola()) {
      if (envio.error) continue;
      let datos = envio.datos;
      if (envio.foto) {
        const usuario = await uid();
        if (!usuario) break;
        const ruta = rutaFoto(usuario, envio.client_uuid);
        const r = await asegurarFoto(subir, ruta, envio.foto);
        if (r === "red") break;
        if (r !== "ok") {
          marcarError(envio.client_uuid, r);
          continue;
        }
        datos = { ...datos, foto_medidor: ruta };
      }
      const { error } = await rpc("op_enviar_captura", {
        p_client_uuid: envio.client_uuid,
        p_tipo: envio.tipo,
        p_lote_id: envio.lote_id,
        p_fecha: envio.fecha,
        p_datos: datos,
      });
      if (!error) {
        quitarDeCola(envio.client_uuid);
        enviados++;
      } else if (esRechazoDelServidor(error)) {
        marcarError(envio.client_uuid, error.message);
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

export async function corregirEnvio(id: string, loteId: string | null, fecha: string, datos: Datos, fotoNueva?: string): Promise<void> {
  if (fotoNueva) {
    // Una foto nueva va con un nombre nuevo: las subidas no reemplazan archivos
    const usuario = await usuarioActual();
    if (!usuario) throw new Error("Vuelve a iniciar sesión");
    const ruta = rutaFoto(usuario, nuevoId());
    const r = await asegurarFoto(subirFoto, ruta, fotoNueva);
    if (r === "red") throw new Error("Sin conexión: las correcciones necesitan señal.");
    if (r !== "ok") throw new Error(r);
    datos = { ...datos, foto_medidor: ruta };
  }
  const { error } = await supabase.rpc("op_corregir_captura", {
    p_id: id,
    p_lote_id: loteId,
    p_fecha: fecha,
    p_datos: datos,
  });
  if (error) throw error;
}
