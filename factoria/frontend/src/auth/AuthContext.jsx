// Contexto de autenticação — guarda usuário/token e expõe login/logout/setup.
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, getToken } from "../lib/api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [carregando, setCarr] = useState(true);
  const [precisaSetup, setPS] = useState(false);

  // Na montagem: descobre se a plataforma já tem admin e valida o token salvo.
  const inicializar = useCallback(async () => {
    setCarr(true);
    try {
      const { configurado } = await api.get("/api/auth/setup");
      setPS(!configurado);
      if (configurado && getToken()) {
        try { setUser(await api.get("/api/auth/me")); }
        catch { setToken(null); setUser(null); }
      }
    } catch { /* backend ainda subindo */ }
    setCarr(false);
  }, []);

  useEffect(() => { inicializar(); }, [inicializar]);

  // Volta ao login quando o cliente HTTP sinaliza 401.
  useEffect(() => {
    const sair = () => setUser(null);
    window.addEventListener("factoria:logout", sair);
    return () => window.removeEventListener("factoria:logout", sair);
  }, []);

  async function login(email, senha) {
    const { token, user } = await api.post("/api/auth/login", { email, senha });
    setToken(token); setUser(user); setPS(false);
    return user;
  }

  async function setup(email, senha, name) {
    const { token, user } = await api.post("/api/auth/setup", { email, senha, name });
    setToken(token); setUser(user); setPS(false);
    return user;
  }

  function logout() { setToken(null); setUser(null); }

  return (
    <AuthCtx.Provider value={{ user, carregando, precisaSetup, login, setup, logout, recarregar: inicializar }}>
      {children}
    </AuthCtx.Provider>
  );
}
