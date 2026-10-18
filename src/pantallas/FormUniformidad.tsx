import { useState, type FormEvent } from "react";
import { hoyHN } from "../datos";
import { aNumero, BotonEnviar, Campo, CampoFecha, CampoNotas, Formulario, loteInicial, SelectorLote, useEnvio, type PropsFormulario } from "./comunes";

/** Hasta 2 decimales, como acepta la base de datos */
const dosDecimales = (n: number) => Math.round(n * 100) === n * 100;

/**
 * La uniformidad se calcula en la aplicación de pesaje; aquí solo se copian
 * sus dos resultados.
 */
export function FormUniformidad({ catalogo, corregir, onVolver, onEnviado }: PropsFormulario) {
  const d = corregir?.datos ?? {};
  const [lote, setLote] = useState(loteInicial(catalogo, corregir));
  const [fecha, setFecha] = useState(corregir?.fecha ?? hoyHN());
  const [peso, setPeso] = useState(d.peso_ave_g !== undefined ? String(d.peso_ave_g) : "");
  const [uniformidad, setUniformidad] = useState(d.uniformidad_pct !== undefined ? String(d.uniformidad_pct) : "");
  const [notas, setNotas] = useState(String(d.observaciones ?? ""));
  const { enviar, guardando, error, setError } = useEnvio("uniformidad", { corregir, onEnviado });

  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    if (!lote) return setError("Elige el lote.");
    const nPeso = aNumero(peso);
    const nUnif = aNumero(uniformidad);
    if (nPeso === null || Number.isNaN(nPeso) || nPeso <= 0 || nPeso > 5000) {
      return setError("Escribe el peso promedio en gramos (entre 1 y 5000).");
    }
    if (nUnif === null || Number.isNaN(nUnif) || nUnif < 0 || nUnif > 100) {
      return setError("Escribe la uniformidad en % (entre 0 y 100).");
    }
    if (!dosDecimales(nPeso) || !dosDecimales(nUnif)) return setError("Usa como máximo 2 decimales.");
    void enviar(lote, fecha, {
      peso_ave_g: nPeso,
      uniformidad_pct: nUnif,
      ...(notas.trim() ? { observaciones: notas.trim() } : {}),
    });
  };

  return (
    <Formulario titulo={corregir ? "Corregir uniformidad" : "Uniformidad"} onVolver={onVolver}>
      <form onSubmit={alEnviar} className="formulario">
        <SelectorLote catalogo={catalogo} valor={lote} onCambio={setLote} />
        <CampoFecha valor={fecha} onCambio={setFecha} />
        <p className="suave pequeno">Copia los resultados que da la aplicación de pesaje.</p>
        <Campo etiqueta="Peso promedio (gramos)" valor={peso} onCambio={setPeso} decimal ayuda="Ej.: 2017.65" />
        <Campo etiqueta="Uniformidad (%)" valor={uniformidad} onCambio={setUniformidad} decimal ayuda="Ej.: 86.5" />
        <CampoNotas valor={notas} onCambio={setNotas} />
        <BotonEnviar guardando={guardando} corrigiendo={!!corregir} error={error} />
      </form>
    </Formulario>
  );
}
