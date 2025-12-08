import fs from "fs";
import axios from "axios";
import crypto from "crypto";

export async function RenovaTokens() {
  try {
    console.log("🔄 Verificando validade do access_token...");

    // Lê token atual salvo
    const tokenInfo = JSON.parse(fs.readFileSync("tokens.json", "utf8"));

    // Pega o shop_id correto
    const shop_id = tokenInfo.shop_id || tokenInfo.shop_id_list?.[0];

    if (!shop_id) {
      console.log("❌ shop_id não encontrado no tokens.json");
      return null;
    }

    const expiresIn = Number(tokenInfo.expire_in);
    const lastUpdate = Number(tokenInfo.timestamp || 0);
    const agora = Math.floor(Date.now() / 1000);

    // Token ainda válido?
    if (agora - lastUpdate < expiresIn - 300) {
      console.log("✅ Token ainda válido.");
      return tokenInfo;
    }

    console.log("⚠ Token expirado! Renovando...");

    const path = "/api/v2/auth/access_token/get";
    const timestamp = Math.floor(Date.now() / 1000);

    // Debug para verificar valores
    console.log("🔑 Valores para assinatura:");
    console.log("partner_id:", process.env.PARTNER_ID);
    console.log("path:", path);
    console.log("timestamp:", timestamp);
    console.log("shop_id:", shop_id);
    console.log("refresh_token:", tokenInfo.refresh_token);

    // String base para assinatura
    const baseString = `${process.env.PARTNER_ID}${path}${timestamp}${tokenInfo.refresh_token}${shop_id}`;

    const sign = crypto
      .createHmac("sha256", process.env.PARTNER_KEY)
      .update(baseString)
      .digest("hex");

    console.log("🔏 Sign gerado:", sign);

    const url =
      `https://partner.shopeemobile.com${path}` +
      `?partner_id=${process.env.PARTNER_ID}` +
      `&timestamp=${timestamp}` +
      `&sign=${sign}` +
      `&shop_id=${shop_id}`;

    const body = {
      refresh_token: tokenInfo.refresh_token,
      partner_id: Number(process.env.PARTNER_ID),
      shop_id: Number(shop_id)
    };

    console.log("🌐 URL completa:", url);
    console.log("📦 Body da requisição:", body);

    const response = await axios.post(url, body);

    console.log("✅ Resposta da Shopee:", response.data);

    // Atualiza timestamp para controle futuro
    const novoToken = response.data;
    novoToken.timestamp = timestamp;
    novoToken.shop_id = shop_id;

    fs.writeFileSync("tokens.json", JSON.stringify(novoToken, null, 2));

    console.log("✅ Token renovado com sucesso!");
    return novoToken;

  } catch (error) {
    console.error("❌ Erro ao renovar token:", error.response?.data || error);
    return null;
  }
}
