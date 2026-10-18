import { useRef, useState, type FormEvent } from "react";
import { calcularUniformidad, hoyHN } from "../datos";
import { aNumero, BotonEnviar, CampoFecha, CampoNotas, Formulario, loteInicial, SelectorLote, useEnvio, type PropsFormulario } from "./comunes";

const MINIMO = 10;

export function FormUniformidad({ catalogo, corregir, onVolver, onEnviado }: PropsFormulario) {
  const [lote, setLote] = useState(loteInicial(catalogo, corregir));
  const [fecha, setFecha] = useState(corregir?.fecha ?? hoyHN());
  const [pesos, setPesos] = useState<number[]>(() => (Array.isArray(corregir?.datos.pesos) ? (corregir!.datos.pesos as number[]) : []));
  const [peso, setPeso] = useState("");
  const [aviso, setAviso] = useState("");
  const [notas, setNotas] = useState(String(corregir?.datos.observaciones ?? ""));
  const entrada = useRef<HTMLInputElement>(null);
  const { enviar, guardando, error, setError } = useEnvio("uniformidad", { corregir, onEnviado });

  const r = calcularUniformidad(pesos);

  const agregar = () => {
    const n = aNumero(peso);
    if (n === null) return;
    if (Number.isNaN(n) || n <= 0 || n > 5000) {
      setAviso("Escribe el peso en gramos (entre 1 y 5000).");
      return;
    }
    setAviso("");
    setPesos((p) => [...p, n]);
    setPeso("");
    entrada.current?.focus();
  };

  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    if (!lote) return setError("Elige el lote.");
    if (pesos.length < MINIMO) return setError(`Pesa al menos ${MINIMO} aves (llevas ${pesos.length}).`);
    void enviar(lote, fecha, { pesos, ...(notas.trim() ? { observaciones: notas.trim() } : {}) });
  };

  return (
    <Formulario titulo={corregir ? "Corregir uniformidad" : "Uniformidad"} onVolver={onVolver}>
      <form onSubmit={alEnviar} className="formulario">
        <SelectorLote catalogo={catalogo} valor={lote} onCambio={setLote} />
        <CampoFecha valor={fecha} onCambio={setFecha} />

        <fieldset className="grupo">
          <legend>Peso de cada ave (gramos)</legend>
          <div className="fila">
            <input
              ref={entrada}
              inputMode="decimal"
              placeholder="Ej. 1580"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  agregar();
                }
              }}
            />
            <button type="button" className="boton pequeno-boton" onClick={agregar}>Agregar</button>
          </div>
          {aviso && <p className="error">{aviso}</p>}
          {pesos.length > 0 && (
            <ul className="pesos" aria-label="Pesos registrados">
              {pesos.map((p, i) => (
                <li key={i}>
                  <button type="button" onClick={() => setPesos((s) => s.filter((_, j) => j !== i))} aria-label={`Quitar ${p} g`}>
                    {p} ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="suave pequeno">Toca un peso para quitarlo si te equivocaste.</p>
        </fieldset>

        <div className="resumen">
          <div><span>Aves</span><strong>{pesos.length}{pesos.length < MINIMO ? ` / ${MINIMO}` : ""}</strong></div>
          <div><span>Peso promedio</span><strong>{r ? `${r.media.toLocaleString("es-HN")} g` : "—"}</strong></div>
          <div><span>Uniformidad</span><strong>{r ? `${r.uniformidad.toLocaleString("es-HN")} %` : "—"}</strong></div>
        </div>
        <p className="suave pequeno">Uniformidad = % de aves con un peso dentro de ±10 % del promedio.</p>

        <CampoNotas valor={notas} onCambio={setNotas} />
        <BotonEnviar guardando={guardando} corrigiendo={!!corregir} error={error} />
      </form>
    </Formulario>
  );
}
