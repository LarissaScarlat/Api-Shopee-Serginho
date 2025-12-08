import express from "express";
import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import { supabase } from "./Supabase.js";

const router = express.Router();

/* ============================================================
   FUNÇÃO PARA CONSULTAR DETALHES DO PEDIDO NA SHOPEE
============================================================ */
async function consultarPedidoShopee(order_sn) {
  try {
    console.log("📌 Iniciando consulta Shopee para:", order_sn);

    // 1. Tokens
    let tokenInfo;
    try {
      tokenInfo = JSON.parse(fs.readFileSync("tokens.json", "utf8"));
    } catch (e) {
      console.error("❌ Erro ao ler tokens.json:", e);
      return { error: "tokens_json_error", detail: e };
    }

    // 2. Variáveis
    const partner_id = Number(process.env.PARTNER_ID);
    const shop_id = Number(tokenInfo.shop_id_list?.[0]);
    const access_token = tokenInfo.access_token;
    const partner_key = process.env.PARTNER_KEY;

    console.log("📌 partner_id:", partner_id);
    console.log("📌 shop_id:", shop_id);
    console.log("📌 access_token:", access_token ? "OK" : "FALTANDO");
    console.log("📌 partner_key:", partner_key ? "OK" : "FALTANDO");

    if (!partner_id || !shop_id || !access_token || !partner_key) {
      return { error: "missing_credentials" };
    }

    // 3. Assinatura
    const path = "/api/v2/order/get_order_detail";
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partner_id}${path}${timestamp}${access_token}${shop_id}`;
    const sign = crypto.createHmac("sha256", partner_key).update(baseString).digest("hex");

    console.log("📌 Sign gerada:", sign.slice(0, 10) + "...");

    const url =
      `https://openplatform.shopee.com.br${path}` +
      `?partner_id=${partner_id}` +
      `&timestamp=${timestamp}` +
      `&sign=${sign}` +
      `&access_token=${access_token}` +
      `&shop_id=${shop_id}`;

    console.log("🌐 URL chamada:", url);

    // 4. Chamada API
    const body = {
      order_sn_list: [order_sn],
      response_optional_fields:
        "recipient_address,item_list,payment_method,pay_time,shipping_carrier,tracking_number"
    };

    let response;
    try {
      response = await axios.post(url, body);
    } catch (e) {
      console.error("❌ Erro HTTP da Shopee:", e.response?.data || e);
      return { error: "http_error", detail: e.response?.data || e };
    }

    console.log("🔍 Resposta Shopee:", JSON.stringify(response.data, null, 2));

    const pedido = response.data.response?.order_list?.[0];

    if (!pedido) {
      return { error: "order_not_found", raw: response.data };
    }

    return pedido;

  } catch (err) {
    console.error("❌ Erro inesperado:", err);
    return { error: "unexpected_error", detail: err };
  }
}


export default router;
