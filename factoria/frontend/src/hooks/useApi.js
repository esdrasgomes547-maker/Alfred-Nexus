// Hook utilitário para chamadas ao backend com tratamento de erro centralizado
import { useState, useCallback } from "react";

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const call = useCallback(async (url, options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      return json;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { call, loading, error };
}
