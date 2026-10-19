import { useEffect, useState } from "react";
import { misEnvios, quitarDeCola, type CapturaServidor, type Catalogo, type Datos, type EnvioEnCola, type TipoCaptura } from "../datos";
import { Formulario } from "./comunes";

const TIPO: Record<TipoCaptura, string> = { produccion: "Producción", uniformidad: "Uniformidad", venta: "Venta" };
const ESTADO: Record<string, string> = { pendiente: "En revisión", aprobada: "Aprobado", rechazada: "Rechazado" };

function resumen(tipo: TipoCaptura, datos: Datos, catalogo: Catalogo | null): string {
  if (tipo === "produccion") {
    const partes = [
      datos.huevos_total !== undefined && `${Number(datos.huevos_total).toLocaleString("es-HN")} huevos`,
      datos.aves_muertas !== undefined && `${datos.aves_muertas} muertas`,
      datos.alimento_lb !== undefined && `${datos.alimento_lb} lb alimento`,
      datos.lectura_medidor_gal !== undefined && `medidor ${datos.lectura_medidor_gal}`,
    ].filter(Boolean);
    return partes.join(" · ") || "Producción";
  }
  if (tipo === "uniformidad") {
    return [
      datos.peso_ave_g !== undefined && `${Number(datos.peso_ave_g).toLocaleString("es-HN")} g promedio`,
      datos.uniformidad_pct !== undefined && `${datos.uniformidad_pct} % uniformidad`,
    ].filter(Boolean).join(" · ") || "Uniformidad";
  }
  const cliente = catalogo?.clientes.find((c) => c.id === datos.cliente_id)?.nombre ?? "Cliente";
  const producto = catalogo?.productos.find((p) => p.id === datos.producto_id)?.nombre ?? "producto";
  return `${cliente} · ${datos.cantidad} ${producto}${datos.foto_recibo ? " · 📷 recibo" : ""}`;
}

function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

interface Props {
  catalogo: Catalogo | null;
  cola: EnvioEnCola[];
  onVolver: () => void;
  onCorregir: (c: CapturaServidor) => void;
  onReintentar: () => Promise<void>;
}

export function MisEnvios({ catalogo, cola, onVolver, onCorregir, onReintentar }: Props) {
  const [envios, setEnvios] = useState<CapturaServidor[] | null>(null);
  const [error, setError] = useState("");

  const cargar = () => {
    setError("");
    misEnvios()
      .then(setEnvios)
      .catch(() => setError("Sin conexión: no se pudo cargar el historial."));
  };

  useEffect(cargar, [cola.length]);

  // Lo que aún está en el teléfono (sin enviar o rechazado por el servidor)
  const enTelefono = cola.filter((e) => !envios?.some((s) => s.client_uuid === e.client_uuid));

  return (
    <Formulario titulo="Mis envíos" onVolver={onVolver}>
      {enTelefono.length > 0 && (
        <section>
          <h2>En este teléfono</h2>
          <ul className="lista">
            {enTelefono.map((e) => (
              <li key={e.client_uuid} className={e.error ? "item item-error" : "item"}>
                <div className="item-cabeza">
                  <strong>{TIPO[e.tipo]} · {fechaCorta(e.fecha)}</strong>
                  <span className="etiqueta">{e.error ? "No se pudo enviar" : "Esperando señal"}</span>
                </div>
                <p>{resumen(e.tipo, e.datos, catalogo)}</p>
                {e.error && (
                  <>
                    <p className="error">{e.error}</p>
                    <button className="enlace" onClick={() => quitarDeCola(e.client_uuid)}>Descartar y volver a registrarlo</button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {enTelefono.some((e) => !e.error) && (
            <button className="boton secundario" onClick={() => void onReintentar()}>Intentar enviar ahora</button>
          )}
        </section>
      )}

      <section>
        <h2>Enviados</h2>
        {error && <p className="aviso">{error}</p>}
        {envios === null && !error && <p className="suave">Cargando…</p>}
        {envios?.length === 0 && <p className="suave">Todavía no has enviado nada.</p>}
        <ul className="lista">
          {envios?.map((c) => (
            <li key={c.id} className={`item item-${c.estado}`}>
              <div className="item-cabeza">
                <strong>{TIPO[c.tipo]} · {fechaCorta(c.fecha)}</strong>
                <span className="etiqueta">{ESTADO[c.estado]}</span>
              </div>
              <p>{resumen(c.tipo, c.datos, catalogo)}</p>
              {c.estado === "rechazada" && c.motivo_rechazo && <p className="error">Motivo: {c.motivo_rechazo}</p>}
              {c.estado === "pendiente" && (
                <button className="enlace" onClick={() => onCorregir(c)}>Corregir</button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </Formulario>
  );
}
