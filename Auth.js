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

  const redirectUri = `${process.env.REDIRECT_DOMAIN}/callback`;

  // Link de autorização Shopee: CLIENT_ID é o da app, não PARTNER_ID
  const authUrl = `${process.env.AUTH_URL}?partner_id=${process.env.PARTNER_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  
  console.log("🔗 Redirecionando para:", authUrl);
  res.redirect(authUrl);
});

// Callback - recebe code e shop_id, troca por token
app.get("/callback", async (req, res) => {
  const { code, shop_id } = req.query;

  if (!code || !shop_id) {
    return res.status(400).send("Faltando code ou shop_id");
  }

  console.log("🔑 Código de autorização recebido:", code);
  console.log("🏪 Shop ID recebido:", shop_id);

  try {
    const redirectUri = `${process.env.REDIRECT_DOMAIN}/callback`;

    // Gera a assinatura HMAC (sign) exigida pela Shopee
    const baseString = `${String(process.env.CLIENT_ID)}${String(code)}${redirectUri}`;
    const sign = crypto.createHmac('sha256', process.env.CLIENT_SECRET)
                       .update(baseString)
                       .digest('hex');

    // POST para trocar code por token
    const tokenUrl = `${process.env.TOKEN_URL}?partner_id=${process.env.CLIENT_ID}&sign=${sign}`;

    const data = {
      code: String(code),
      shop_id: String(shop_id),
      redirect_uri: redirectUri
    };

    const response = await axios.post(tokenUrl, data, {
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

