import express from "express";
import 'dotenv/config';
import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rota inicial - redireciona para autorização
app.get("/", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = `${process.env.REDIRECT_URI}/callback`;

  const authUrl = `${process.env.AUTH_URL}?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  
  console.log("🔗 Redirecionando para:", authUrl);
  res.redirect(authUrl);
});

// Callback - recebe code e troca por token
app.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code) return res.status(400).send("Código de autorização ausente");

  console.log("🔑 Código de autorização recebido:", code);

  try {
    const redirectUri = `${process.env.REDIRECT_URI}/callback`;

    // Gera a assinatura HMAC (sign) exigida pela Shopee
    const baseString = `${process.env.PARTNER_ID}${code}${redirectUri}`;
    const sign = crypto.createHmac('sha256', process.env.CLIENT_SECRET)
                       .update(baseString)
                       .digest('hex');

    const data = {
      partner_id: process.env.PARTNER_ID,
      code: code,
      redirect_uri: redirectUri,
      sign: sign
    };

    const response = await axios.post(process.env.TOKEN_URL, data, {
      headers: { 'Content-Type': 'application/json' }
    });

    const tokenData = response.data;
    console.log("🔐 Token recebido:", tokenData);

    // Retorna e salva os tokens
    res.json({
      message: "Autenticação bem-sucedida!",
      tokens: tokenData
    });

    fs.writeFileSync("tokens.json", JSON.stringify(tokenData, null, 2), "utf-8");
    console.log("💾 Tokens salvos em tokens.json");

  } catch (error) {
    console.error("❌ Erro ao obter o token:", error.response ? error.response.data : error.message);
    res.status(500).send("Erro ao obter o token de acesso.");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
