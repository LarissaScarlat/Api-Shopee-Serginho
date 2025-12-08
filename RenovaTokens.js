// RenovarTokensShopee.js
import axios from "axios";
import fs from "fs";
import crypto from "crypto";

export async function RenovaTokens() {
  try {
    const tokenInfo = JSON.parse(fs.readFileSync("tokens.json", "utf8"));

    const partner_id = Number(process.env.PARTNER_ID);
    const partner_key = process.env.PARTNER_KEY;
    const shop_id = tokenInfo.shop_id_list?.[0];
    const refresh_token = tokenInfo.refresh_token;

    const path = "/api/v2/auth/access_token/get";
    const timestamp = Math.floor(Date.now() / 1000);

    const baseString = `${partner_id}${path}${timestamp}${refresh_token}${shop_id}`;
    const sign = crypto.createHmac("sha256", partner_key).update(baseString).digest("hex");

    const url =
      `https://openplatform.shopee.com.br${path}` +
      `?partner_id=${partner_id}` +
      `&timestamp=${timestamp}` +
      `&sign=${sign}`;

    const body = {
      shop_id,
      refresh_token,
      partner_id,
    };

    console.log("🔄 Renovando token da Shopee...");

    const response = await axios.post(url, body);

    const novoAccess = response.data.access_token;
    const novoRefresh = response.data.refresh_token;

    if (!novoAccess) {
      console.error("❌ Erro ao renovar token:", response.data);
      return false;
    }

    // Salva novo tokens.json atualizado
    fs.writeFileSync(
      "tokens.json",
      JSON.stringify(
        {
          ...tokenInfo,
          access_token: novoAccess,
          refresh_token: novoRefresh,
        },
        null,
        2
      )
    );

    console.log("✅ Tokens renovados com sucesso!");
    return true;

  } catch (err) {
    console.error("❌ Erro ao renovar tokens:", err.response?.data || err);
    return false;
  }
}


