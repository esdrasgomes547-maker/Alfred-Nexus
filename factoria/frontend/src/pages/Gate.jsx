// Gate — tela de login (e setup do primeiro admin, se a plataforma for nova).
import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import Card   from "../components/Card";
import Input  from "../components/Input";
import Button from "../components/Button";

export default function Gate() {
  const { precisaSetup, login, setup } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [name, setName]   = useState("");
  const [erro, setErro]   = useState(null);
  const [enviando, setEnv] = useState(false);

  const modoSetup = precisaSetup;

  async function enviar(e) {
    e.preventDefault();
    setErro(null);
    setEnv(true);
    try {
      if (modoSetup) await setup(email, senha, name);
      else           await login(email, senha);
    } catch (err) {
      setErro(err.message || "Falha ao entrar");
    } finally {
      setEnv(false);
    }
  }

  const label = { display: "block", fontSize: 12, color: "var(--text-sec)", marginBottom: 5 };
  const group = { marginBottom: 16 };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(circle at 50% 0%, #14101f 0%, var(--bg-base) 60%)",
      padding: 20,
    }}>
      <div className="fade-in" style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>
            Factor<span style={{ color: "var(--accent)" }}>IA</span>
          </div>
          <div style={{ color: "var(--text-sec)", fontSize: 13, marginTop: 6 }}>
            {modoSetup ? "Crie a conta de administrador" : "Entre para gerenciar seus agentes"}
          </div>
        </div>

        <Card>
          <form onSubmit={enviar}>
            {modoSetup && (
              <div style={group}>
                <label style={label}>Seu nome</label>
                <Input value={name} placeholder="Ex.: Esdras" onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div style={group}>
              <label style={label}>E-mail</label>
              <Input type="email" value={email} placeholder="voce@exemplo.com" onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <div style={group}>
              <label style={label}>Senha {modoSetup && <span style={{ color: "var(--text-muted)" }}>(mín. 8)</span>}</label>
              <Input type="password" value={senha} placeholder="••••••••" onChange={(e) => setSenha(e.target.value)} />
            </div>

            {erro && (
              <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 14, background: "var(--red-dim)", padding: "8px 10px", borderRadius: "var(--radius-sm)" }}>
                {erro}
              </div>
            )}

            <Button variant="primary" type="submit" loading={enviando} style={{ width: "100%" }}>
              {modoSetup ? "Criar administrador" : "Entrar"}
            </Button>
          </form>
        </Card>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 11, color: "var(--text-muted)" }}>
          {modoSetup
            ? "Esta conta terá controle total da plataforma."
            : "Acesso restrito — fale com o administrador para obter uma conta."}
        </div>
      </div>
    </div>
  );
}
