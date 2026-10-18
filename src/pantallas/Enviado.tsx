export function Enviado({ enCola, corregido, onListo }: { enCola: boolean; corregido?: boolean; onListo: () => void }) {
  return (
    <div className="pagina centro">
      <div className="exito" aria-hidden>{enCola ? "📱" : "✓"}</div>
      <h1>{corregido ? "Corrección guardada" : enCola ? "Guardado en el teléfono" : "Enviado"}</h1>
      <p className="suave">
        {enCola
          ? "No hay señal. Se enviará solo cuando vuelva la conexión; puedes cerrar la app."
          : "El encargado lo revisará. Puedes ver el estado en «Mis envíos»."}
      </p>
      <button className="boton" onClick={onListo}>Listo</button>
    </div>
  );
}
