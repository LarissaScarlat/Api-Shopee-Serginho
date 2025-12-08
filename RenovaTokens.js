import fs from "fs";
import axios from "axios";
import crypto from "crypto";

export async function RenovaTokens() {
  try {
    console.log("🔄 Verificando validade do access_token...");

    const tokenInfo = JSON.parse(fs.readFileSync("tokens.json", "utf8"));

    const shop_id = tokenInfo.shop_id || tokenInfo.shop_id_list?.[0];
    const refresh_token = String(tokenInfo.refresh_token || "").trim();

    if (!shop_id || !refresh_token) {
      console.error("❌ shop_id ou refresh_token inválido");
      return null;
    }

    const agora = Math.floor(Date.now() / 1000);
    if (tokenInfo.expire_at && agora < tokenInfo.expire_at - 300) {
      console.log("✅ Token ainda válido.");
      return tokenInfo;
    }

    console.log("⚠ Token expirado! Renovando...");

    const partner_id = Number(process.env.PARTNER_ID);
    const partner_key = process.env.PARTNER_KEY;
    const path = "/api/v2/auth/access_token/get";
    const timestamp = Math.floor(Date.now() / 1000);

    // 🔹 Base string correta PARA RENOVAÇÃO (não inclui shop_id ou refresh_token)
    const baseString = `${partner_id}${path}${timestamp}`;
    const sign = crypto.createHmac("sha256", partner_key).update(baseString).digest("hex");

    const url = `https://openplatform.shopee.com.br${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}`;
    const body = { refresh_token, partner_id, shop_id };

    console.log("📤 URL:", url);
    console.log("📦 Body:", body);
    console.log("🔏 Sign:", sign);

    const response = await axios.post(url, body);

    if (response.data.error) {
      console.error("❌ Erro da Shopee ao renovar token:", response.data);
      return null;
    }

    const novoToken = response.data;
    novoToken.timestamp = timestamp;
    novoToken.shop_id = shop_id;
    novoToken.expire_at = timestamp + (novoToken.expire_in || 14400); // 4h padrão se não vier expire_in
    fs.writeFileSync("tokens.json", JSON.stringify(novoToken, null, 2));

    console.log("✅ Token renovado com sucesso!");
    return novoToken;

  } catch (error) {
    console.error("❌ Erro ao renovar token:", error.response?.data || error);
    return null;
  }
}
