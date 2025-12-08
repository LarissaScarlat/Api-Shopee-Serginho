// RenovaTokensShopee.js
import fs from "fs";
import axios from "axios";
import crypto from "crypto";

export async function RenovaTokens() {
  try {
    console.log("🔄 Verificando validade do access_token...");

    // Lê o token salvo
    const tokenInfo = JSON.parse(fs.readFileSync("tokens.json", "utf8"));

    const expiresIn = Number(tokenInfo.expire_in); // tempo de expiração
    const lastUpdate = Number(tokenInfo.timestamp || 0); // se não existir, vira 0
    const agora = Math.floor(Date.now() / 1000);

    // Token ainda válido?
    if (agora - lastUpdate < expiresIn - 300) {
      console.log("✅ Token ainda válido.");
      return tokenInfo;
    }

    console.log("⚠ Token expirado! Renovando...");

    const path = "/api/v2/auth/access_token/get";
    const timestamp = Math.floor(Date.now() / 1000);

    // 🚀 ASSINATURA CORRETA
    const baseString = 
      `${process.env.PARTNER_ID}${path}${timestamp}${tokenInfo.access_token}${tokenInfo.shop_id}`;

    const sign = crypto
      .createHmac("sha256", process.env.PARTNER_KEY)
      .update(baseString)
      .digest("hex");

    const url =
      `https://openplatform.shopee.com.br${path}` +
      `?partner_id=${process.env.PARTNER_ID}` +
      `&timestamp=${timestamp}` +
      `&sign=${sign}` +
      `&shop_id=${tokenInfo.shop_id}`;

    const body = {
      refresh_token: tokenInfo.refresh_token,
      shop_id: tokenInfo.shop_id,
      partner_id: Number(process.env.PARTNER_ID)
    };

    const response = await axios.post(url, body);

    const novoToken = response.data;

    // salva timestamp novamente
    novoToken.timestamp = timestamp;

    fs.writeFileSync("tokens.json", JSON.stringify(novoToken, null, 2));

    console.log("✅ Token renovado com sucesso!");
    return novoToken;

  } catch (error) {
    console.error("❌ Erro ao renovar token:", error.response?.data || error);
    return null;
  }
}
