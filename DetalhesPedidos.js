import express from "express"; 
import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import { supabase } from "./Supabase.js";
import { salvarPedidoShopee } from "./SalvarShopeeSupabase.js";
import { RenovaTokens } from "./RenovaTokens.js";  // <-- você já tinha isso


const router = express.Router();

/* ============================================================
   🔹🔹🔹 ADIÇÃO 1 — MIDDLEWARE PARA RENOVAR TOKENS 🔹🔹🔹
============================================================ */
async function garantirToken(req, res, next) {
  console.log("⏳ Verificando token antes da rota...");
  const tokenInfo = await RenovaTokens();
  if (!tokenInfo) {
    return res.status(500).json({ error: "Erro ao renovar token" });
  }
  req.access_token = tokenInfo.access_token; // passa para a rota
  next();
}


/* ============================================================
   FUNÇÃO PARA CONSULTAR DETALHES DO PEDIDO NA SHOPEE
============================================================ */
async function consultarPedidoShopee(order_sn) {
  try {
    console.log("📌 Iniciando consulta Shopee para:", order_sn);

    let tokenInfo;
    try {
      tokenInfo = JSON.parse(fs.readFileSync("tokens.json", "utf8"));
    } catch (e) {
      console.error("❌ Erro ao ler tokens.json:", e);
      return { error: "tokens_json_error", detail: e };
    }

    const partner_id = Number(process.env.PARTNER_ID);
    const shop_id = Number(tokenInfo.shop_id_list?.[0]);
    const access_token = tokenInfo.access_token;
    const partner_key = process.env.PARTNER_KEY;

    if (!partner_id || !shop_id || !access_token || !partner_key) {
      return { error: "missing_credentials" };
    }

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

    // 🔹 LOGS PARA DEBUG
    console.log("🔑 Access Token:", access_token);
    console.log("🛒 Shop ID:", shop_id);
    console.log("📦 Order SN:", order_sn);
    console.log("📤 URL da requisição:", url);
    console.log("📝 Body enviado:", body);


    let response;
    try {
      response = await axios.post(url, body);
    } catch (e) {
      return { error: "http_error", detail: e.response?.data || e };
    }

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
   ROTA REAL OFICIAL QUE FALTAVA!!
============================================================ */

/* 
   🔹🔹🔹 ADIÇÃO 2 — ADICIONAR O MIDDLEWARE ANTES DA ROTA
   Ficou assim:
   router.get("/buscar-pedido/:order_sn", garantirToken, async (...)
*/
router.get("/buscar-pedido/:order_sn", garantirToken, async (req, res) => {
  const order_sn = req.params.order_sn;

  console.log("🔎 Consulta manual de pedido:", order_sn);

  const pedido = await consultarPedidoShopee(order_sn);

  if (!pedido) {
    return res.status(404).json({ error: "Pedido não encontrado na Shopee" });
  }

  await salvarPedidoShopee(pedido);

  return res.json({
    mensagem: "Pedido encontrado e salvo no Supabase",
    pedido
  });
});


export default router;


