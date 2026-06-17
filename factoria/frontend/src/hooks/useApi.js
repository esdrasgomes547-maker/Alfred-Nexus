// Hook utilitário para chamadas ao backend — agora sobre o cliente `api`,
// que injeta o token JWT e trata 401 automaticamente.
import { useState, useCallback } from "react";
import { api } from "../lib/api";

// Mapeia (url, options.method/body) → método do cliente api.
function despachar(url, options = {}) {
  const metodo = (options.method || "GET").toUpperCase();
  const body = options.body ? JSON.parse(options.body) : undefined;
  if (metodo === "GET")    return api.get(url);
  if (metodo === "POST")   return api.post(url, body);
  if (metodo === "PUT")    return api.put(url, body);
  if (metodo === "PATCH")  return api.patch(url, body);
  if (metodo === "DELETE") return api.del(url);
  return api.get(url);
}

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const call = useCallback(async (url, options = {}) => {
    setLoading(true);
    setError(null);
    try {
      return await despachar(url, options);
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { call, loading, error };
}
