import fs from "fs";
import axios from "axios";
import crypto from "crypto";

export async function RenovaTokens() {
  try {
    console.log("🔄 Verificando validade do access_token...");

    // Lê arquivo com tokens
    let tokenInfo = JSON.parse(fs.readFileSync("tokens.json", "utf8"));

    const { shop_id, partner_id, refresh_token, access_token, expire_at } = tokenInfo;

    if (!shop_id || !partner_id || !refresh_token) {
      console.error("❌ tokens.json inválido!");
      return null;
    }

    const agora = Math.floor(Date.now() / 1000);

    // Se ainda estiver válido (faltando mais de 5 min)
    if (agora < expire_at - 300) {
      console.log("✅ Token ainda válido.");
      return tokenInfo;
    }

    console.log("⚠ Token expirado! Renovando...");

    const partner_key = process.env.PARTNER_KEY;
    const path = "/api/v2/auth/access_token/get";
    const timestamp = Math.floor(Date.now() / 1000);

    // Assinatura
    const baseString = `${partner_id}${path}${timestamp}`;
    const sign = crypto
      .createHmac("sha256", partner_key)
      .update(baseString)
      .digest("hex");

    const url =
      `https://partner.shopeemobile.com${path}` +
      `?partner_id=${partner_id}` +
      `&timestamp=${timestamp}` +
      `&sign=${sign}`;

    const body = {
      shop_id,
      refresh_token,
      partner_id
    };

    const response = await axios.post(url, body, {
      headers: { "Content-Type": "application/json" }
    });

    const data = response.data;

    if (data.error) {
      console.error("❌ Erro no refresh:", data);
      return null;
    }

    console.log("🔐 Nova resposta de token:", data);

    const novoToken = {
      partner_id,
      shop_id,
      access_token: data.access_token,
      refresh_token: data.refresh_token, // ⚠ novo refresh_token!!
      expire_at: timestamp + data.expire_in
    };

    fs.writeFileSync("tokens.json", JSON.stringify(novoToken, null, 2));
    console.log("💾 Tokens atualizados e salvos!");

    return novoToken;

  } catch (err) {
    console.error("❌ Erro ao renovar token:", err.response?.data || err);
    return null;
  }
}
