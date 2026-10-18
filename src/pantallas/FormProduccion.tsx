import { useState, type FormEvent } from "react";
import { hoyHN } from "../datos";
import { aNumero, BotonEnviar, Campo, CampoFecha, CampoNotas, Formulario, loteInicial, SelectorLote, useEnvio, type PropsFormulario } from "./comunes";

const HUEVOS_POR_CARTON = 30;

const CAMPOS = [
  { clave: "huevos_sucios", etiqueta: "Huevos sucios" },
  { clave: "huevos_quebrados", etiqueta: "Huevos quebrados" },
  { clave: "huevos_eliminados", etiqueta: "Huevos eliminados" },
  { clave: "aves_muertas", etiqueta: "Aves muertas" },
  { clave: "alimento_lb", etiqueta: "Alimento (libras)", decimal: true },
  { clave: "peso_huevo_g", etiqueta: "Peso del huevo (gramos)", decimal: true, ayuda: "Opcional" },
] as const;

const ENTEROS = new Set(["huevos_sucios", "huevos_quebrados", "huevos_eliminados", "aves_muertas"]);

export function FormProduccion({ catalogo, corregir, onVolver, onEnviado }: PropsFormulario) {
  const d = corregir?.datos ?? {};
  const totalInicial = typeof d.huevos_total === "number" ? d.huevos_total : null;
  const [lote, setLote] = useState(loteInicial(catalogo, corregir));
  const [fecha, setFecha] = useState(corregir?.fecha ?? hoyHN());
  const [cartones, setCartones] = useState(totalInicial !== null ? String(Math.floor(totalInicial / HUEVOS_POR_CARTON)) : "");
  const [sueltos, setSueltos] = useState(totalInicial !== null ? String(totalInicial % HUEVOS_POR_CARTON) : "");
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(CAMPOS.map((c) => [c.clave, d[c.clave] !== undefined ? String(d[c.clave]) : ""])),
  );
  const [notas, setNotas] = useState(String(d.observaciones ?? ""));
  const { enviar, guardando, error, setError } = useEnvio("produccion", { corregir, onEnviado });

  const nCartones = aNumero(cartones);
  const nSueltos = aNumero(sueltos);
  const total = nCartones === null && nSueltos === null ? null : (nCartones ?? 0) * HUEVOS_POR_CARTON + (nSueltos ?? 0);

  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    if (!lote) return setError("Elige el lote.");
    const datos: Record<string, number | string> = {};
    if (total !== null) {
      if (!Number.isInteger(total) || total < 0) return setError("Revisa cartones y huevos sueltos: deben ser números enteros.");
      datos.huevos_total = total;
    }
    for (const c of CAMPOS) {
      const n = aNumero(valores[c.clave]);
      if (n === null) continue;
      if (Number.isNaN(n) || n < 0) return setError(`Revisa «${c.etiqueta}».`);
      if (ENTEROS.has(c.clave) && !Number.isInteger(n)) return setError(`«${c.etiqueta}» debe ser un número entero.`);
      datos[c.clave] = n;
    }
    if (Object.keys(datos).length === 0) return setError("Escribe al menos un dato.");
    const danados = Number(datos.huevos_sucios ?? 0) + Number(datos.huevos_quebrados ?? 0) + Number(datos.huevos_eliminados ?? 0);
    if (total !== null && danados > total) return setError("Los huevos sucios, quebrados y eliminados suman más que el total.");
    if (notas.trim()) datos.observaciones = notas.trim();
    void enviar(lote, fecha, datos);
  };

  return (
    <Formulario titulo={corregir ? "Corregir producción" : "Producción del día"} onVolver={onVolver}>
      <form onSubmit={alEnviar} className="formulario">
        <SelectorLote catalogo={catalogo} valor={lote} onCambio={setLote} />
        <CampoFecha valor={fecha} onCambio={setFecha} />
        <fieldset className="grupo">
          <legend>Huevos recolectados</legend>
          <div className="fila">
            <Campo etiqueta={`Cartones (${HUEVOS_POR_CARTON})`} valor={cartones} onCambio={setCartones} />
            <Campo etiqueta="Huevos sueltos" valor={sueltos} onCambio={setSueltos} />
          </div>
          <p className="total">Total: <strong>{total === null || Number.isNaN(total) ? "—" : total.toLocaleString("es-HN")}</strong> huevos</p>
        </fieldset>
        {CAMPOS.map((c) => (
          <Campo
            key={c.clave}
            etiqueta={c.etiqueta}
            valor={valores[c.clave]}
            onCambio={(v) => setValores((s) => ({ ...s, [c.clave]: v }))}
            decimal={"decimal" in c}
            ayuda={"ayuda" in c ? c.ayuda : undefined}
          />
        ))}
        <CampoNotas valor={notas} onCambio={setNotas} />
        <BotonEnviar guardando={guardando} corrigiendo={!!corregir} error={error} />
      </form>
    </Formulario>
  );
}
