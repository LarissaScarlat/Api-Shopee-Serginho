import express from "express";
import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import { supabase } from "./Supabase.js";
import { salvarPedidoShopee } from "./SalvarShopeeSupabase.js";


const router = express.Router();

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
router.get("/buscar-pedido/:order_sn", async (req, res) => {
  const order_sn = req.params.order_sn;

  console.log("🔎 Consulta manual de pedido:", order_sn);

  const pedido = await consultarPedidoShopee(order_sn);

  console.log("📥 Retorno bruto da Shopee:", pedido);

  if (!pedido || pedido.error) {
    return res.status(404).json({
      erro: "Pedido não encontrado ou Shopee não retornou dados",
      detalhe: pedido
    });
  }

  await salvarPedidoShopee(pedido);

  return res.json({
    mensagem: "Pedido encontrado e salvo no Supabase",
    pedido
  });
});


export default router;

