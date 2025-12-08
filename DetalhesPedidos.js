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

    const tokenInfo = JSON.parse(fs.readFileSync("tokens.json", "utf8"));

    const partner_id = Number(process.env.PARTNER_ID);
    const shop_id = Number(tokenInfo.shop_id_list?.[0]);
    const access_token = tokenInfo.access_token;
    const partner_key = process.env.PARTNER_KEY;

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

    const response = await axios.post(url, body);

    const pedido = response.data.response?.order_list?.[0];

    if (!pedido) return null;

    return pedido;

  } catch (err) {
    console.error("❌ ERRO Shopee:", err.response?.data || err);
    return null;
  }
}

/* ============================================================
   FUNÇÃO PARA SALVAR NO SUPABASE
============================================================ */
async function salvarSupabase(pedido) {
  try {
    const dataToSave = {
      order_sn: pedido.order_sn,
      order_status: pedido.order_status,
      payment_method: pedido.payment_method,
      buyer_username: pedido.buyer_user_name,

      shipping_carrier: pedido.package_list?.[0]?.shipping_carrier || null,
      tracking_number: pedido.package_list?.[0]?.tracking_number || null,

      pay_time: pedido.pay_time,
      total_amount: pedido.total_amount,

      recipient_name: pedido.recipient_address?.name || null,
      recipient_phone: pedido.recipient_address?.phone || null,
      recipient_address: pedido.recipient_address?.full_address || null,

      items: pedido.item_list,

      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from("pedidos")
      .upsert(dataToSave, { onConflict: "order_sn" });

    if (error) {
      console.error("❌ ERRO ao salvar no Supabase:", error);
      return false;
    }

    console.log(`💾 Pedido ${pedido.order_sn} salvo com sucesso no Supabase.`);
    return true;

  } catch (err) {
    console.error("❌ ERRO inesperado no Supabase:", err);
    return false;
  }
}

/* ============================================================
   ROTA PARA CONSULTAR E SALVAR PEDIDO
============================================================ */
router.get("/buscar-pedido/:order_sn", async (req, res) => {
  const order_sn = req.params.order_sn;

  console.log("🔎 Consulta manual de pedido:", order_sn);

  const pedido = await consultarPedidoShopee(order_sn);

  if (!pedido) {
    return res.status(404).json({ error: "Pedido não encontrado na Shopee" });
  }

  await salvarSupabase(pedido);

  return res.json({
    mensagem: "Pedido encontrado e salvo",
    pedido
  });
});

export default router;

