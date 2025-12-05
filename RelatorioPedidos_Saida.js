// PushPedidos.js
import express from "express";
import axios from "axios";
import fs from "fs";
import crypto from "crypto";
import { supabase } from "./Supabase.js";

const router = express.Router();


// ======================================================
//  BUSCA DETALHES DO PEDIDO NA SHOPEE
// ======================================================
async function getOrderDetail(order_sn) {
  const t = JSON.parse(fs.readFileSync("tokens.json", "utf8"));

  const partner_id = Number(process.env.PARTNER_ID);
  const shop_id = t.shop_id_list[0];
  const access_token = t.access_token;
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
    response_optional_fields: "recipient_address,item_list,payment_method"
  };

  const response = await axios.post(url, body);

  return response.data.response.order_list[0] || null;
}



// ======================================================
//  INSERE OU ATUALIZA PEDIDO NO SUPABASE
// ======================================================
async function saveOrder(order) {
  const order_sn = order.order_sn;

  const { data: existing } = await supabase
    .from("shopee_orders")
    .select("*")
    .eq("order_sn", order_sn)
    .maybeSingle();

  const firstItem = order.item_list?.[0] || {};

  const row = {
    order_sn: order.order_sn,
    order_date: order.create_time ? new Date(order.create_time * 1000) : null,
    status: order.order_status,
    plataforma: "Shopee",
    deposito: order.warehouse_code || null,
    sku: firstItem.model_sku || firstItem.item_sku || null,
    titulo_anuncio: firstItem.item_name || null
  };

  /// SE NÃO EXISTE → INSERE
if (!existing) {
  const { error } = await supabase.from("shopee_orders").insert(row);
  if (error) {
    console.error("❌ Erro ao inserir no Supabase:", error);
  } else {
    console.log(`🟩 Novo pedido inserido: ${order_sn}`);
  }
  return;
}

// SE EXISTE → ATUALIZA
const { error } = await supabase
  .from("shopee_orders")
  .update(row)
  .eq("order_sn", order_sn);

if (error) {
  console.error("❌ Erro ao atualizar no Supabase:", error);
} else {
  console.log(`🔄 Pedido atualizado: ${order_sn} → ${order.order_status}`);
}
}

// ======================================================
//  ROTA PRINCIPAL DE WEBHOOK
// ======================================================
router.post("/", async (req, res) => {
  try {
    const body = req.body;

    console.log(">> Body recebido:", JSON.stringify(body));

    // ==============================================
    // PROCESSA PEDIDOS (code 1)
    // ==============================================
    if (body.code === 1 && body.data?.order_sn_list) {
      for (const order_sn of body.data.order_sn_list) {
        console.log("📦 Processando pedido (code 1):", order_sn);

        const detail = await getOrderDetail(order_sn);
        if (detail) await saveOrder(detail);
      }

      return res.status(200).json({ message: "Pedidos processados (code 1)" });
    }


    // ==============================================
    // PROCESSA LOGÍSTICA (code 30)
    // ==============================================
    if (body.code === 30 && body.data?.ordersn) {
      const order_sn = body.data.ordersn;
      const logStatus = body.data.fulfillment_status;

      console.log(`🚚 Atualização logística (code 30): ${order_sn} → ${logStatus}`);

      const detail = await getOrderDetail(order_sn);
      if (detail) await saveOrder(detail);

      return res.status(200).json({ message: "Logística processada (code 30)" });
    }
// ==============================================
// PROCESSA STATUS DO PEDIDO (code 3)
// ==============================================
if (body.code === 3 && body.data?.ordersn) {
  const order_sn = body.data.ordersn;
  const status = body.data.status;

  console.log(`📦 Atualização de pedido (code 3): ${order_sn} → ${status}`);

  const detail = await getOrderDetail(order_sn);
  if (detail) await saveOrder(detail);

  return res.status(200).json({ message: "Pedido processado (code 3)" });
}


    // ==============================================
    // SEM AÇÃO
    // ==============================================
    return res.status(200).json({ message: "Nada para fazer" });

  } catch (err) {
    console.error("❌ Erro ao processar webhook:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

export default router;




