const LADO_MAXIMO = 1280;
const CALIDAD = 0.7;

/**
 * Reduce la foto del teléfono (varios MB) a un JPEG de ~150–300 KB que se
 * pueda guardar en el teléfono sin señal y subir rápido. Los números del
 * medidor siguen legibles a 1280 px.
 */
export async function comprimirFoto(archivo: File): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("No se pudo leer la foto"));
      i.src = url;
    });
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la foto");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", CALIDAD);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Convierte "data:image/jpeg;base64,..." en un archivo para subir. */
export function dataUrlABlob(dataUrl: string): Blob {
  const [cabecera, base64] = dataUrl.split(",");
  const tipo = /data:([^;]+)/.exec(cabecera)?.[1] ?? "image/jpeg";
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}
