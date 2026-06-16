// Utilitários HTTP — wrapper de async, erro de aplicação e validação Zod.

// Erro de aplicação com status HTTP. Lançar isto em qualquer rota/serviço.
class AppError extends Error {
  constructor(status, message, detalhes) {
    super(message);
    this.status = status;
    this.detalhes = detalhes;
  }
}

// Envolve um handler async — encaminha qualquer rejeição pro middleware de erro,
// evitando try/catch repetido em toda rota.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Valida `req.body` contra um schema Zod; substitui o body pelo dado já parseado.
// Em falha, lança AppError 400 com a lista de problemas.
function validar(schema) {
  return (req, _res, next) => {
    const r = schema.safeParse(req.body);
    if (!r.success) {
      const detalhes = r.error.issues.map((i) => ({
        campo: i.path.join(".") || "(raiz)",
        erro: i.message,
      }));
      return next(new AppError(400, "Dados inválidos", detalhes));
    }
    req.body = r.data;
    next();
  };
}

// Middleware final de erro (registrado por último no app).
function tratadorDeErro(err, _req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) console.error("[erro]", err.stack || err.message);
  res.status(status).json({
    error: err.message || "Erro interno",
    ...(err.detalhes ? { detalhes: err.detalhes } : {}),
  });
}

module.exports = { AppError, asyncHandler, validar, tratadorDeErro };
