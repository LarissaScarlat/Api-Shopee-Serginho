import fs from "fs";
import axios from "axios";
import crypto from "crypto";

export async function RenovaTokens() {
  try {
    console.log("🔄 Verificando validade do access_token...");

    // Lê tokens salvos
    const tokenInfo = JSON.parse(fs.readFileSync("tokens.json", "utf8"));

    // ⚠️ Ajuste importante: pegar shop_id corretamente
    // A Shopee retorna shop_id_list como array, devemos pegar o primeiro
    const shop_id = tokenInfo.shop_id_list?.[0] || tokenInfo.shop_id;
    let refresh_token = tokenInfo.refresh_token;

    if (!shop_id || !refresh_token) {
      console.error("❌ shop_id ou refresh_token inválido");
      return null;
    }

    const agora = Math.floor(Date.now() / 1000);

    // ⚠️ Ajuste: verifica se o token ainda é válido
    if (tokenInfo.expire_at && agora < tokenInfo.expire_at - 300) {
      console.log("✅ Token ainda válido.");
      return { ...tokenInfo, shop_id };
    }

    console.log("⚠ Token expirado! Renovando...");

    const partner_id = Number(process.env.PARTNER_ID);
    const partner_key = process.env.PARTNER_KEY;
    const path = "/api/v2/auth/access_token/get";
    const timestamp = Math.floor(Date.now() / 1000);

    // 🔹 Base string correta para renovação de token
    const baseString = `${partner_id}${path}${timestamp}`;
    const sign = crypto.createHmac("sha256", partner_key).update(baseString).digest("hex");

    const url = `https://partner.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}`;
    const body = { shop_id, refresh_token, partner_id };

    const response = await axios.post(url, body, {
      headers: { "Content-Type": "application/json" }
    });

    if (response.data.error) {
      console.error("❌ Erro da Shopee ao renovar token:", response.data);
      return null;
    }

    // ⚠️ Ajuste: armazenar timestamp de expiração corretamente
    const novoToken = {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expire_in: response.data.expire_in,
      timestamp,
      expire_at: timestamp + response.data.expire_in,
      shop_id,
      shop_id_list: [shop_id] // garante compatibilidade com outros lugares do código
    };

    fs.writeFileSync("tokens.json", JSON.stringify(novoToken, null, 2));
    console.log("✅ Token renovado com sucesso!");

    return novoToken;

  } catch (err) {
    console.error("❌ Erro ao renovar token:", err.response?.data || err);
    return null;
  }
}
