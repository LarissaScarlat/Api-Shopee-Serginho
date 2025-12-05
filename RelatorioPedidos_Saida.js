// PushPedidos.js
import express from "express";
import axios from "axios";
import fs from "fs";
import crypto from "crypto";
import { supabase } from "./Supabase.js";

const router = express.Router();

/* ============================================================
   BUSCA DETALHES DO PEDIDO NA SHOPEE
============================================================ */
async function getOrderDetail(order_sn) {
  try {
    const tok = JSON.parse(fs.readFileSync("tokens.json", "utf8"));

    const partner_id = Number(process.env.PARTNER_ID);
    const shop_id = tok.shop_id_list[0];        // 👈 CORRETO
    const access_token = tok.access_token;      // 👈 CORRETO
    const partner_key = process.env.PARTNER_KEY;

    const path = "/api/v2/order/get_order_detail";
    const timestamp = Math.floor(Date.now() / 1000);

    const baseString =
      `${partner_id}${path}${timestamp}${access_token}${shop_id}`;

    const sign = crypto
      .createHmac("sha256", partner_key)
      .update(baseString)
      .digest("hex");

    const url =
      `https://openplatform.shopee.com.br${path}` +
      `?partner_id=${partner_id}` +
      `&timestamp=${timestamp}` +
      `&sign=${sign}` +
      `&access_token=${access_token}` +
      `&shop_id=${shop_id}`;

    const body = {
      order_sn_list: [order_sn],
      response_optional_fields: "recipient_address,item_list,payment_method"
    };

    const response = await axios.post(url, body);

    // Debug para ver resposta real da Shopee
    console.log("🔍 RETORNO DA SHOPEE:", JSON.stringify(response.data, null, 2));

    return response.data.response?.order_list?.[0] || null;
  } catch (err) {
    console.error("❌ Erro ao consultar detalhes do pedido:", err);
    return null;
  }
}

/* ============================================================
   ROTA PRINCIPAL DO WEBHOOK SHOPEE
============================================================ */
router.post("/notificacoes-shopee", async (req, res) => {
  try {
    const body = req.body;

    console.log("====================================================");
    console.log("📩 Webhook recebido:", JSON.stringify(body));

   
let order_sn = null;

// Caso mais comum
if (body.data?.ordersn) {
  order_sn = body.data.ordersn;
}

// Alternativa em alguns eventos
else if (body.data?.order_sn) {
  order_sn = body.data.order_sn;
}

// Quando vem lista
else if (Array.isArray(body.data?.order_sn_list) && body.data.order_sn_list.length > 0) {
  order_sn = body.data.order_sn_list[0];
}

// Quando vem no body raiz (alguns webhooks antigos da Shopee)
else if (body.ordersn) {
  order_sn = body.ordersn;
}

if (!order_sn) {
  console.log("⚠️ Webhook ignorado — não contém order_sn");
  return res.status(200).json({ message: "ignorado" });
}

console.log(`🔎 Pedido detectado: ${order_sn} (code ${body.code})`);


    /* ----------------------------------------------------
       BUSCA DETALHES COMPLETOS NA API
    ---------------------------------------------------- */
    const detail = await getOrderDetail(order_sn);

    if (!detail) {
      console.log("⚠️ Nenhum detalhe retornado pela Shopee.");
      return res.status(200).json({ message: "sem detalhes" });
    }

    /* ----------------------------------------------------
       SALVA NO SUPABASE
    ---------------------------------------------------- */
    await saveOrder(detail);

    return res.status(200).json({ message: "processado" });
  } catch (err) {
    console.error("❌ Erro ao processar webhook:", err);
    return res.status(500).json({ error: "erro interno" });
  }
});

export default router;





