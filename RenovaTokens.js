// RenovaTokensShopee.js
import fs from "fs";
import axios from "axios";
import crypto from "crypto";

export async function RenovaTokens() {
  try {
    console.log("🔄 Verificando validade do access_token...");

    // Lê token atual salvo
    const tokenInfo = JSON.parse(fs.readFileSync("tokens.json", "utf8"));

    // shop_id OBRIGATÓRIO
    const shop_id = tokenInfo.shop_id || tokenInfo.shop_id_list?.[0];

    if (!shop_id) {
      console.log("❌ shop_id não encontrado no tokens.json");
      return null;
    }

    // Garantir que valores sejam números/strings limpas
    const shop_id_clean = Number(shop_id);
    const refresh_token_clean = String(tokenInfo.refresh_token || "").trim();

    if (!refresh_token_clean) {
      console.log("❌ refresh_token vazio no tokens.json");
      return null;
    }

    const expiresIn = Number(tokenInfo.expire_in || 0);
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

    // Base string para gerar sign (corrigida)
    const baseString = `${process.env.PARTNER_ID}${path}${timestamp}${refresh_token_clean}${shop_id_clean}`;

    const sign = crypto
      .createHmac("sha256", process.env.PARTNER_KEY)
      .update(baseString)
      .digest("hex");

    // Debug detalhado
    console.log("🔑 Valores para assinatura:");
    console.log("partner_id:", process.env.PARTNER_ID);
    console.log("path:", path);
    console.log("timestamp:", timestamp);
    console.log("shop_id:", shop_id_clean);
    console.log("refresh_token:", refresh_token_clean);
    console.log("🔍 BaseString usada:", baseString);
    console.log("🔏 Sign gerado:", sign);

    // URL correta de produção Shopee BR
    const url =
      `https://partner.shopeemobile.com${path}` +
      `?partner_id=${process.env.PARTNER_ID}` +
      `&timestamp=${timestamp}` +
      `&sign=${sign}` +
      `&shop_id=${shop_id_clean}`;

    const body = {
      refresh_token: refresh_token_clean,
      partner_id: Number(process.env.PARTNER_ID),
      shop_id: shop_id_clean
    };

    console.log("📦 Body da requisição:", body);

    const response = await axios.post(url, body);

    if (response.data.error) {
      console.error("❌ Erro da Shopee ao renovar token:", response.data);
      return null;
    }

    const novoToken = response.data;

    // Atualiza timestamp e shop_id
    novoToken.timestamp = timestamp;
    novoToken.shop_id = shop_id_clean;

    // Salva no tokens.json
    fs.writeFileSync("tokens.json", JSON.stringify(novoToken, null, 2));

    console.log("✅ Token renovado com sucesso!");
    return novoToken;

  } catch (error) {
    console.error("❌ Erro ao renovar token:", error.response?.data || error);
    return null;
  }
}

