import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import {
  actualizarCatalogo,
  catalogoGuardado,
  enviarCola,
  leerCola,
  type CapturaServidor,
  type Catalogo,
  type EnvioEnCola,
} from "./datos";
import { Login } from "./pantallas/Login";
import { Inicio } from "./pantallas/Inicio";
import { FormProduccion } from "./pantallas/FormProduccion";
import { FormUniformidad } from "./pantallas/FormUniformidad";
import { FormVenta } from "./pantallas/FormVenta";
import { MisEnvios } from "./pantallas/MisEnvios";
import { Enviado } from "./pantallas/Enviado";

export type Pantalla =
  | { id: "inicio" }
  | { id: "produccion" | "uniformidad" | "venta"; corregir?: CapturaServidor }
  | { id: "envios" }
  | { id: "enviado"; enCola: boolean; corregido?: boolean };

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);
  const [esOperario, setEsOperario] = useState<boolean | null>(null);
  const [pantalla, setPantalla] = useState<Pantalla>({ id: "inicio" });
  const [catalogo, setCatalogo] = useState<Catalogo | null>(catalogoGuardado());
  const [cola, setCola] = useState<EnvioEnCola[]>(leerCola());
  const [enLinea, setEnLinea] = useState(navigator.onLine);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCargando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Esta app es solo para cuentas de operario
  useEffect(() => {
    if (!session) {
      setEsOperario(null);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .then(({ data, error }) => {
        if (error) {
          setEsOperario(true); // sin conexión: la base de datos vuelve a comprobarlo al enviar
          return;
        }
        setEsOperario((data ?? []).some((r) => r.role === "operario"));
      });
  }, [session]);

  const sincronizar = useCallback(async () => {
    if (!session || !navigator.onLine) return;
    await enviarCola();
    setCola(leerCola());
    try {
      setCatalogo(await actualizarCatalogo());
    } catch {
      /* se sigue usando la copia guardada */
    }
  }, [session]);

  useEffect(() => {
    const alCambiarCola = () => setCola(leerCola());
    const alConectar = () => {
      setEnLinea(true);
      void sincronizar();
    };
    const alDesconectar = () => setEnLinea(false);
    window.addEventListener("ciaa-op-cola", alCambiarCola);
    window.addEventListener("online", alConectar);
    window.addEventListener("offline", alDesconectar);
    const intervalo = window.setInterval(() => void sincronizar(), 60_000);
    void sincronizar();
    return () => {
      window.removeEventListener("ciaa-op-cola", alCambiarCola);
      window.removeEventListener("online", alConectar);
      window.removeEventListener("offline", alDesconectar);
      window.clearInterval(intervalo);
    };
  }, [sincronizar]);

  if (cargando) return <div className="centro">Cargando…</div>;
  if (!session) return <Login />;
  if (esOperario === false) {
    return (
      <div className="centro pagina">
        <h1>Esta app es solo para operarios</h1>
        <p className="suave">Tu cuenta es de CIAA Digital. Entra desde CIAA Digital.</p>
        <button className="boton secundario" onClick={() => void supabase.auth.signOut()}>Cerrar sesión</button>
      </div>
    );
  }

  const nombre = String(session.user.user_metadata?.full_name ?? session.user.email ?? "");
  const volver = () => setPantalla({ id: "inicio" });
  const alEnviar = (enCola: boolean, corregido = false) => {
    setCola(leerCola());
    setPantalla({ id: "enviado", enCola, corregido });
    if (!corregido) void sincronizar();
  };

  switch (pantalla.id) {
    case "produccion":
      return <FormProduccion catalogo={catalogo} corregir={pantalla.corregir} onVolver={volver} onEnviado={alEnviar} />;
    case "uniformidad":
      return <FormUniformidad catalogo={catalogo} corregir={pantalla.corregir} onVolver={volver} onEnviado={alEnviar} />;
    case "venta":
      return <FormVenta catalogo={catalogo} corregir={pantalla.corregir} onVolver={volver} onEnviado={alEnviar} />;
    case "envios":
      return <MisEnvios catalogo={catalogo} cola={cola} onVolver={volver} onCorregir={(c) => setPantalla({ id: c.tipo, corregir: c })} onReintentar={sincronizar} />;
    case "enviado":
      return <Enviado enCola={pantalla.enCola} corregido={pantalla.corregido} onListo={volver} />;
    default:
      return <Inicio nombre={nombre} enLinea={enLinea} cola={cola} sinCatalogo={!catalogo} onIr={setPantalla} />;
  }
}
