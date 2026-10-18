import { useState, type FormEvent } from "react";
import { supabase } from "../supabase";

const DOMINIO = "@granja.ciaa";

export function Login() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [entrando, setEntrando] = useState(false);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setEntrando(true);
    const u = usuario.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({
      email: u.includes("@") ? u : u + DOMINIO,
      password,
    });
    setEntrando(false);
    if (error) {
      setError(
        /invalid/i.test(error.message)
          ? "Usuario o contraseña incorrectos."
          : /banned/i.test(error.message)
            ? "Esta cuenta está desactivada. Habla con el encargado."
            : "No se pudo entrar. Revisa la conexión e inténtalo de nuevo.",
      );
    }
  };

  return (
    <form className="pagina login" onSubmit={entrar}>
      <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="logo" />
      <h1>CIAA Operarios</h1>
      <p className="suave">Granja avícola · UNAG</p>
      <label className="campo">
        <span>Usuario</span>
        <input
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          placeholder="wilson.andrade"
          required
        />
      </label>
      <label className="campo">
        <span>Contraseña</span>
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="boton" disabled={entrando}>{entrando ? "Entrando…" : "Entrar"}</button>
      <p className="suave pequeno">¿Olvidaste la contraseña? Pídele al encargado que la cambie.</p>
    </form>
  );
}
