import express from "express";
import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import { supabase } from "./Supabase.js";
import { salvarPedidoShopee } from "./SalvarShopeeSupabase.js";

const router = express.Router();

/* ============================================================
   🔹 FUNÇÃO PARA RENOVAR ACCESS TOKEN
============================================================ */
async function RenovaTokens() {
  try {
    console.log("🔄 Verificando validade do access_token...");

    let tokenInfo = JSON.parse(fs.readFileSync("tokens.json", "utf8"));
    const shop_id = tokenInfo.shop_id;
    let refresh_token = tokenInfo.refresh_token;

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

    // Base string correta para renovação
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

    // Salva novo access_token e refresh_token
    const novoToken = {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expire_in: response.data.expire_in,
      timestamp,
      expire_at: timestamp + response.data.expire_in,
      shop_id
    };

    fs.writeFileSync("tokens.json", JSON.stringify(novoToken, null, 2));
    console.log("✅ Token renovado com sucesso!");

    return novoToken;
  } catch (err) {
    console.error("❌ Erro ao renovar token:", err.response?.data || err);
    return null;
  }
}

/* ============================================================
   🔹 MIDDLEWARE PARA GARANTIR TOKEN ATUALIZADO
============================================================ */
async function garantirToken(req, res, next) {
  const tokenInfo = await RenovaTokens();
  if (!tokenInfo) {
    return res.status(500).json({ error: "Não foi possível renovar o token" });
  }
  req.access_token = tokenInfo.access_token;
  next();
}

/* ============================================================
   🔹 FUNÇÃO PARA CONSULTAR DETALHES DO PEDIDO
============================================================ */
async function consultarPedidoShopee(order_sn, access_token) {
  try {
    const tokenInfo = JSON.parse(fs.readFileSync("tokens.json", "utf8"));
    const partner_id = Number(process.env.PARTNER_ID);
    const partner_key = process.env.PARTNER_KEY;
    const shop_id = Number(tokenInfo.shop_id);

    const path = "/api/v2/order/get_order_detail";
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partner_id}${path}${timestamp}${access_token}${shop_id}`;
    const sign = crypto.createHmac("sha256", partner_key).update(baseString).digest("hex");

    const url =
      `https://openplatform.shopee.com.br${path}` +
      `?partner_id=${partner_id}` +
      `&timestamp=${timestamp}` +
      `&sign=${sign}` +
      `&access_token=${access_token}` +
      `&shop_id=${shop_id}`;

    const body = {
      order_sn_list: [order_sn],
      response_optional_fields:
        "recipient_address,item_list,payment_method,pay_time,shipping_carrier,tracking_number"
    };

    console.log("🔑 Access Token:", access_token);
    console.log("🛒 Shop ID:", shop_id);
    console.log("📦 Order SN:", order_sn);
    console.log("📤 URL da requisição:", url);

    const response = await axios.post(url, body);
    const pedido = response.data.response?.order_list?.[0];

    if (!pedido) {
      return { error: "order_not_found", raw: response.data };
    }

    return pedido;
  } catch (err) {
    return { error: "unexpected_error", detail: err };
  }
}

/* ============================================================
   🔹 ROTA PARA BUSCAR PEDIDO
============================================================ */
router.get("/buscar-pedido/:order_sn", garantirToken, async (req, res) => {
  const order_sn = req.params.order_sn;
  const access_token = req.access_token;

  console.log("🔎 Consulta manual de pedido:", order_sn);

  const pedido = await consultarPedidoShopee(order_sn, access_token);

  if (!pedido || pedido.error) {
    return res.status(404).json({ error: "Pedido não encontrado na Shopee", detalhe: pedido });
  }

  await salvarPedidoShopee(pedido);

  return res.json({
    mensagem: "Pedido encontrado e salvo no Supabase",
    pedido
  });
});

export default router;



