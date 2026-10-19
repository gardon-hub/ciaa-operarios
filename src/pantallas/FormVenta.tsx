import { useState, type FormEvent } from "react";
import { hoyHN } from "../datos";
import { aNumero, BotonEnviar, Campo, CampoFecha, CampoFotoCamara, CampoNotas, Formulario, useEnvio, type PropsFormulario } from "./comunes";

const FORMAS_PAGO: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  credito: "Crédito",
  donacion: "Donación",
};

const lps = (n: number) => `L ${n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function FormVenta({ catalogo, corregir, onVolver, onEnviado }: PropsFormulario) {
  const d = corregir?.datos ?? {};
  const [fecha, setFecha] = useState(corregir?.fecha ?? hoyHN());
  const [cliente, setCliente] = useState(String(d.cliente_id ?? ""));
  const [producto, setProducto] = useState(String(d.producto_id ?? ""));
  const [cantidad, setCantidad] = useState(d.cantidad !== undefined ? String(d.cantidad) : "");
  const [precio, setPrecio] = useState(d.precio_unitario !== undefined ? String(d.precio_unitario) : "");
  const [formaPago, setFormaPago] = useState(String(d.forma_pago ?? "efectivo"));
  const [recibo, setRecibo] = useState(String(d.recibo_numero ?? ""));
  const [notas, setNotas] = useState(String(d.observaciones ?? ""));
  const [foto, setFoto] = useState<string | null>(null);
  const fotoAnterior = typeof d.foto_recibo === "string" ? d.foto_recibo : null;
  const { enviar, guardando, error, setError } = useEnvio("venta", { corregir, onEnviado });

  const prod = catalogo?.productos.find((p) => p.id === producto);
  const nCantidad = aNumero(cantidad);
  const nPrecio = aNumero(precio);
  const total = nCantidad !== null && nPrecio !== null && !Number.isNaN(nCantidad * nPrecio) ? nCantidad * nPrecio : null;

  const elegirProducto = (id: string) => {
    setProducto(id);
    const p = catalogo?.productos.find((x) => x.id === id);
    if (p && precio.trim() === "") setPrecio(String(Number(p.precio_sugerido)));
  };

  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    if (!cliente) return setError("Elige el cliente.");
    if (!producto) return setError("Elige el producto.");
    if (nCantidad === null || Number.isNaN(nCantidad) || nCantidad <= 0) return setError("Escribe la cantidad.");
    if (nPrecio === null || Number.isNaN(nPrecio) || nPrecio < 0) return setError("Escribe el precio unitario.");
    if (recibo.trim() && !/^\d{1,10}$/.test(recibo.trim())) return setError("El número de recibo lleva solo dígitos.");
    if (!foto && !fotoAnterior) return setError("Toma la foto del recibo de entrega.");
    void enviar(null, fecha, {
      cliente_id: cliente,
      producto_id: producto,
      cantidad: nCantidad,
      precio_unitario: nPrecio,
      forma_pago: formaPago,
      ...(recibo.trim() ? { recibo_numero: recibo.trim() } : {}),
      ...(notas.trim() ? { observaciones: notas.trim() } : {}),
      ...(!foto && fotoAnterior ? { foto_recibo: fotoAnterior } : {}),
    }, foto ?? undefined, "foto_recibo");
  };

  return (
    <Formulario titulo={corregir ? "Corregir venta" : "Venta"} onVolver={onVolver}>
      <form onSubmit={alEnviar} className="formulario">
        <CampoFecha valor={fecha} onCambio={setFecha} />
        <label className="campo">
          <span>Cliente</span>
          <select value={cliente} onChange={(e) => setCliente(e.target.value)}>
            <option value="">Elige el cliente…</option>
            {catalogo?.clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label className="campo">
          <span>Producto</span>
          <select value={producto} onChange={(e) => elegirProducto(e.target.value)}>
            <option value="">Elige el producto…</option>
            {catalogo?.productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        <div className="fila">
          <Campo etiqueta={`Cantidad${prod ? ` (${prod.unidad})` : ""}`} valor={cantidad} onCambio={setCantidad} decimal />
          <Campo
            etiqueta="Precio unitario (L)"
            valor={precio}
            onCambio={setPrecio}
            decimal
            ayuda={prod ? `Sugerido: ${lps(Number(prod.precio_sugerido))}` : undefined}
          />
        </div>
        <p className="total">Total: <strong>{total === null ? "—" : lps(total)}</strong></p>
        <label className="campo">
          <span>Forma de pago</span>
          <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
            {(catalogo?.formas_pago ?? Object.keys(FORMAS_PAGO)).map((f) => <option key={f} value={f}>{FORMAS_PAGO[f] ?? f}</option>)}
          </select>
        </label>
        <Campo etiqueta="N.º de recibo (opcional)" valor={recibo} onCambio={setRecibo} />
        <fieldset className="grupo">
          <legend>Recibo de entrega</legend>
          <p className="suave pequeno">Toma la foto del recibo completo: que se lean el cliente, la cantidad y el total.</p>
          <CampoFotoCamara que="del recibo" foto={foto} anterior={!!fotoAnterior} onFoto={setFoto} onError={setError} />
        </fieldset>
        <CampoNotas valor={notas} onCambio={setNotas} />
        <BotonEnviar guardando={guardando} corrigiendo={!!corregir} error={error} />
      </form>
    </Formulario>
  );
}
