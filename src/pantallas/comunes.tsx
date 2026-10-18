import { useState, type ReactNode } from "react";
import { corregirEnvio, encolar, hoyHN, nuevoId, type CapturaServidor, type Catalogo, type Datos, type TipoCaptura } from "../datos";

export interface PropsFormulario {
  catalogo: Catalogo | null;
  corregir?: CapturaServidor;
  onVolver: () => void;
  onEnviado: (enCola: boolean, corregido?: boolean) => void;
}

/** Convierte lo escrito ("1,350", "62,5") en número, o null si está vacío. */
export function aNumero(v: string): number | null {
  const s = v.trim();
  if (s === "") return null;
  const limpio = /^\d{1,3}([.,]\d{3})+$/.test(s) ? s.replace(/[.,]/g, "") : s.replace(",", ".");
  const n = Number(limpio);
  return Number.isFinite(n) ? n : NaN;
}

export function Formulario({ titulo, onVolver, children }: { titulo: string; onVolver: () => void; children: ReactNode }) {
  return (
    <div className="pagina">
      <header className="encabezado">
        <button className="enlace" onClick={onVolver}>← Volver</button>
        <h1>{titulo}</h1>
      </header>
      {children}
    </div>
  );
}

export function Campo({ etiqueta, valor, onCambio, ayuda, decimal = false }: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  ayuda?: string;
  decimal?: boolean;
}) {
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      <input inputMode={decimal ? "decimal" : "numeric"} value={valor} onChange={(e) => onCambio(e.target.value)} />
      {ayuda && <small className="suave">{ayuda}</small>}
    </label>
  );
}

export function SelectorLote({ catalogo, valor, onCambio }: { catalogo: Catalogo | null; valor: string; onCambio: (v: string) => void }) {
  return (
    <label className="campo">
      <span>Lote</span>
      <select value={valor} onChange={(e) => onCambio(e.target.value)}>
        <option value="">Elige el lote…</option>
        {catalogo?.lotes.map((l) => (
          <option key={l.id} value={l.id}>{l.codigo} · {l.nombre}</option>
        ))}
      </select>
    </label>
  );
}

export function CampoFecha({ valor, onCambio }: { valor: string; onCambio: (v: string) => void }) {
  return (
    <label className="campo">
      <span>Fecha</span>
      <input type="date" value={valor} max={hoyHN()} onChange={(e) => onCambio(e.target.value)} />
    </label>
  );
}

export function CampoNotas({ valor, onCambio }: { valor: string; onCambio: (v: string) => void }) {
  return (
    <label className="campo">
      <span>Observaciones (opcional)</span>
      <textarea rows={2} maxLength={500} value={valor} onChange={(e) => onCambio(e.target.value)} />
    </label>
  );
}

/** Lote inicial: el de la corrección, o el único lote activo si solo hay uno. */
export function loteInicial(catalogo: Catalogo | null, corregir?: CapturaServidor): string {
  if (corregir) return corregir.lote_id ?? "";
  return catalogo?.lotes.length === 1 ? catalogo.lotes[0].id : "";
}

/** Envía (o encola) la captura nueva, o guarda la corrección de una pendiente. */
export function useEnvio(tipo: TipoCaptura, { corregir, onEnviado }: Pick<PropsFormulario, "corregir" | "onEnviado">) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const enviar = async (loteId: string | null, fecha: string, datos: Datos) => {
    setError("");
    if (corregir) {
      setGuardando(true);
      try {
        await corregirEnvio(corregir.id, loteId, fecha, datos);
        onEnviado(false, true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
      } finally {
        setGuardando(false);
      }
      return;
    }
    encolar({ client_uuid: nuevoId(), tipo, lote_id: loteId, fecha, datos });
    onEnviado(!navigator.onLine);
  };

  return { enviar, guardando, error, setError };
}

export function BotonEnviar({ guardando, corrigiendo, error }: { guardando: boolean; corrigiendo: boolean; error: string }) {
  return (
    <>
      {error && <p className="error">{error}</p>}
      <button className="boton" disabled={guardando}>
        {guardando ? "Guardando…" : corrigiendo ? "Guardar corrección" : "Enviar"}
      </button>
    </>
  );
}
