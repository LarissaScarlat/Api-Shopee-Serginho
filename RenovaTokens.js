// RenovaTokensShopee.js
import fs from "fs";
import axios from "axios";
import crypto from "crypto";

export async function RenovaTokens() {
  try {
    console.log("🔄 Verificando validade do access_token...");

    // 🔹 Lê token atual
    const tokenInfo = JSON.parse(fs.readFileSync("tokens.json", "utf8"));

    const expiresIn = tokenInfo.expire_in; // segundos
    const lastUpdate = tokenInfo.timestamp; // salvo por você
    const agora = Math.floor(Date.now() / 1000);
    const tempoPassado = agora - lastUpdate;

    // 🔹 Se o token ainda for válido, só retorna
    if (tempoPassado < expiresIn - 300) {  
      console.log("✅ Token ainda válido.");
      return tokenInfo;
    }

    console.log("⚠ Token expirado! Renovando...");

    const path = "/api/v2/auth/access_token/get";
    const timestamp = Math.floor(Date.now() / 1000);

    const baseString = `${process.env.PARTNER_ID}${path}${timestamp}${tokenInfo.refresh_token}${tokenInfo.shop_id_list[0]}`;
    const sign = crypto.createHmac("sha256", process.env.PARTNER_KEY)
      .update(baseString)
      .digest("hex");

    const url =
      `https://openplatform.shopee.com.br${path}` +
      `?partner_id=${process.env.PARTNER_ID}` +
      `&timestamp=${timestamp}` +
      `&sign=${sign}`;

    const body = {
      refresh_token: tokenInfo.refresh_token,
      partner_id: Number(process.env.PARTNER_ID),
      shop_id: Number(tokenInfo.shop_id_list[0])
    };

    const response = await axios.post(url, body);

    const novoToken = response.data;

    // 🔹 Atualiza timestamp para controle futuro
    novoToken.timestamp = timestamp;

    fs.writeFileSync("tokens.json", JSON.stringify(novoToken, null, 2));

    console.log("✅ Token renovado com sucesso!");

    return novoToken;

  } catch (error) {
    console.error("❌ Erro ao renovar token:", error.response?.data || error);
    return null;
  }
}



