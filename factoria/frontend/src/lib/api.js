// Cliente HTTP central — injeta o token JWT e trata erros de forma uniforme.
const TOKEN_KEY = "factoria_token";

export function getToken()      { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t)     { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }

// Erro de API com status e detalhes (vindos do backend).
export class ApiError extends Error {
  constructor(status, message, detalhes) {
    super(message);
    this.status = status;
    this.detalhes = detalhes;
  }
}

async function request(method, url, body) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const resp = await fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  // 401 → sessão expirou; limpa o token e avisa o app pra voltar ao login.
  if (resp.status === 401) {
    setToken(null);
    window.dispatchEvent(new CustomEvent("factoria:logout"));
  }

  let dados = null;
  const texto = await resp.text();
  if (texto) { try { dados = JSON.parse(texto); } catch { dados = texto; } }

  if (!resp.ok) {
    const msg = (dados && dados.error) || `Erro ${resp.status}`;
    throw new ApiError(resp.status, msg, dados && dados.detalhes);
  }
  return dados;
}

export const api = {
  get:   (url)        => request("GET", url),
  post:  (url, body)  => request("POST", url, body ?? {}),
  put:   (url, body)  => request("PUT", url, body ?? {}),
  patch: (url, body)  => request("PATCH", url, body ?? {}),
  del:   (url)        => request("DELETE", url),
};
