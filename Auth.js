import express from "express";
import "dotenv/config";
import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import cors from "cors";
import RouterRelatorio from "./RelatorioPedidos_Saida.js";
import RouterPush from "./PushAuth.js";




const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    }
  })
);


/**
 * Função para gerar assinatura Shopee v2
 * sign = HMAC_SHA256(partner_id + path + timestamp, partner_key)
 */
function generateSign(path, timestamp) {
  const baseString = `${process.env.PARTNER_ID}${path}${timestamp}`;
  return crypto
    .createHmac("sha256", process.env.PARTNER_KEY)
    .update(baseString)
    .digest("hex");
}

/**
 * 1️⃣ ROTA DE AUTORIZAÇÃO — GERA O LINK DE LOGIN
 */
app.get("/", (req, res) => {
  const redirectUri = `${process.env.REDIRECT_DOMAIN}/callback`;
  const path = "/api/v2/shop/auth_partner";
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = generateSign(path, timestamp);

  const authUrl =
    `${process.env.AUTH_URL}` +
    `?partner_id=${process.env.PARTNER_ID}` +
    `&timestamp=${timestamp}` +
    `&sign=${sign}` +
    `&redirect=${encodeURIComponent(redirectUri)}`;

  console.log("🔗 URL gerada:", authUrl);

  res.redirect(authUrl);
});

/**
 * 2️⃣ CALLBACK — RECEBE CODE E SHOP_ID E TROCA POR TOKEN
 */
app.get("/callback", async (req, res) => {
  const { code, shop_id } = req.query;

  if (!code || !shop_id) {
    return res.status(400).send("Faltando code ou shop_id");
  }

  console.log("🔑 Code recebido:", code);
  console.log("🏪 Shop ID recebido:", shop_id);

  try {
    const path = "/api/v2/auth/token/get";
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(path, timestamp);

    const tokenUrl =
      `${process.env.TOKEN_URL}` +
      `?partner_id=${process.env.PARTNER_ID}` +
      `&timestamp=${timestamp}` +
      `&sign=${sign}`;

    const body = {
      code: String(code),
      shop_id: Number(shop_id),
      partner_id: Number(process.env.PARTNER_ID)
    };

    console.log("📤 Enviando POST para:", tokenUrl);
    console.log("📦 Body:", body);

    const response = await axios.post(tokenUrl, body, {
      headers: { "Content-Type": "application/json" }
    });

    const tokenData = response.data;

    console.log("🔐 Token recebido:", tokenData);

    fs.writeFileSync("tokens.json", JSON.stringify(tokenData, null, 2));
    console.log("💾 Tokens salvos em tokens.json");

    res.json({
      message: "Autenticação concluída!",
      tokens: tokenData
    });
  } catch (error) {
    console.error(
      "❌ Erro ao trocar code pelo token:",
      error.response ? error.response.data : error.message
    );
    res.status(500).send("Erro ao obter token");
  }
});

app.use("/", RouterRelatorio);
app.use("/notificacoes-shopee", RouterPush);
app.use("/",RouterRelatorio);




app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

