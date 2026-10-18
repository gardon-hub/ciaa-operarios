import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./estilos.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Permite abrir la app sin señal e instalarla en el teléfono
// Al abrirla y cada vez que vuelve al frente, busca una versión nueva y, si la hay, se recarga sola
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  const habiaVersion = !!navigator.serviceWorker.controller;
  let recargando = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!habiaVersion || recargando) return;
    recargando = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: "none" })
      .then((registro) => {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void registro.update();
        });
      })
      .catch(() => {});
  });
}
