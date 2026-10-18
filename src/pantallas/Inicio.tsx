import { supabase } from "../supabase";
import type { EnvioEnCola } from "../datos";
import type { Pantalla } from "../App";

interface Props {
  nombre: string;
  enLinea: boolean;
  cola: EnvioEnCola[];
  sinCatalogo: boolean;
  onIr: (p: Pantalla) => void;
}

export function Inicio({ nombre, enLinea, cola, sinCatalogo, onIr }: Props) {
  const porEnviar = cola.filter((e) => !e.error).length;
  const conError = cola.filter((e) => e.error).length;

  return (
    <div className="pagina">
      <header className="encabezado">
        <div>
          <p className="suave pequeno">CIAA Operarios</p>
          <h1>Hola, {nombre.split(" ")[0]}</h1>
        </div>
        <button className="enlace" onClick={() => void supabase.auth.signOut()}>Salir</button>
      </header>

      {!enLinea && <p className="aviso">Sin señal. Lo que registres se guarda en el teléfono y se envía al volver la conexión.</p>}
      {porEnviar > 0 && <p className="aviso">{porEnviar} registro{porEnviar === 1 ? "" : "s"} esperando señal para enviarse.</p>}
      {conError > 0 && (
        <button className="aviso error-aviso" onClick={() => onIr({ id: "envios" })}>
          {conError} registro{conError === 1 ? "" : "s"} no se pudo enviar. Toca para revisar.
        </button>
      )}
      {sinCatalogo && <p className="aviso">Conéctate una vez a internet para descargar la lista de lotes y clientes.</p>}

      <nav className="menu">
        <button className="tarjeta-boton" onClick={() => onIr({ id: "produccion" })} disabled={sinCatalogo}>
          <span className="emoji" aria-hidden>🥚</span>
          <span><strong>Producción del día</strong><small>Huevos, mortalidad, alimento</small></span>
        </button>
        <button className="tarjeta-boton" onClick={() => onIr({ id: "uniformidad" })} disabled={sinCatalogo}>
          <span className="emoji" aria-hidden>⚖️</span>
          <span><strong>Uniformidad</strong><small>Pesos de la muestra de aves</small></span>
        </button>
        <button className="tarjeta-boton" onClick={() => onIr({ id: "venta" })} disabled={sinCatalogo}>
          <span className="emoji" aria-hidden>🧾</span>
          <span><strong>Venta</strong><small>Cliente, producto, cantidad</small></span>
        </button>
        <button className="tarjeta-boton secundario" onClick={() => onIr({ id: "envios" })}>
          <span className="emoji" aria-hidden>📋</span>
          <span><strong>Mis envíos</strong><small>Pendientes, aprobados y rechazados</small></span>
        </button>
      </nav>
    </div>
  );
}
