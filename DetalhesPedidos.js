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
    const tokenInfo = JSON.parse(fs.readFileSync("tokens.json", "utf8"));

    const partner_id = Number(process.env.PARTNER_ID);

    // ALTERE AQUÍ ❗  
    // Antes: const shop_id = tokenInfo.shop_id_list[0];
    const shop_id = tokenInfo.shop_id;  

    const access_token = tokenInfo.access_token;
    const partner_key = process.env.PARTNER_KEY;

    const path = "/api/v2/order/get_order_detail";
    const timestamp = Math.floor(Date.now() / 1000);

    const baseString = `${partner_id}${path}${timestamp}${access_token}${shop_id}`;

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
      response_optional_fields:
        "recipient_address,item_list,payment_method,pay_time,shipping_carrier,tracking_number"
    };

    const response = await axios.post(url, body);

    console.log("🔍 Resposta Oficial Shopee:", JSON.stringify(response.data, null, 2));

    if (!response.data.response?.order_list?.[0]) return null;

    return response.data.response.order_list[0];

  } catch (err) {
    console.error("❌ Erro ao consultar Shopee:", err);
    return null;
  }
}

/* ============================================================
   FUNÇÃO PARA SALVAR NO SUPABASE
============================================================ */
async function salvarSupabase(detail) {
  try {
    const dataToSave = {
      order_sn: detail.order_sn,
      order_status: detail.order_status,
      payment_method: detail.payment_method,
      buyer_username: detail.buyer_user_name,
      shipping_carrier: detail.package_list?.[0]?.shipping_carrier || null,
      tracking_number: detail.package_list?.[0]?.tracking_number || null,
      pay_time: detail.pay_time,
      total_amount: detail.total_amount,
      recipient_name: detail.recipient_address?.name || null,
      recipient_phone: detail.recipient_address?.phone || null,
      recipient_address: detail.recipient_address?.full_address || null,
      items: detail.item_list,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("pedidos").upsert(dataToSave, {
      onConflict: "order_sn"
    });

    if (error) throw error;

    console.log(`💾 Pedido ${detail.order_sn} salvo no Supabase.`);
  } catch (err) {
    console.error("❌ Erro ao salvar no Supabase:", err);
  }
}

/* ============================================================
   ROTA PÚBLICA — CONSULTAR E SALVAR PEDIDO
============================================================ */
router.get("/buscar-pedido/:order_sn", async (req, res) => {
  try {
    const order_sn = req.params.order_sn;

    console.log("🔎 Recebida consulta manual para:", order_sn);

    const detail = await consultarPedidoShopee(order_sn);

    if (!detail) {
      return res.status(404).json({ erro: "Pedido não encontrado na Shopee" });
    }

    await salvarSupabase(detail);

    return res.json({
      mensagem: "Pedido processado com sucesso",
      pedido: detail
    });

  } catch (err) {
    console.error("❌ Erro geral:", err);
    return res.status(500).json({ erro: "Erro interno" });
  }
});

export default router;
