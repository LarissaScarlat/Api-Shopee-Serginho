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
    const t = JSON.parse(fs.readFileSync("tokens.json", "utf8"));

    const partner_id = Number(process.env.PARTNER_ID);
    const shop_id = t.shop_id_list[0];
    const access_token = t.access_token;
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
      response_optional_fields: "recipient_address,item_list,payment_method"
    };

    const response = await axios.post(url, body);

    return response.data.response.order_list?.[0] || null;
  } catch (err) {
    console.error("❌ Erro ao consultar detalhes do pedido:", err);
    return null;
  }
}

/* ============================================================
   INSERE OU ATUALIZA PEDIDO NO SUPABASE
============================================================ */
async function saveOrder(order) {
  try {
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

    if (!existing) {
      const { error } = await supabase.from("shopee_orders").insert(row);
      if (error) {
        console.error("❌ Erro ao inserir:", error);
      } else {
        console.log(`🟩 Novo pedido inserido: ${order_sn}`);
      }
      return;
    }

    const { error } = await supabase
      .from("shopee_orders")
      .update(row)
      .eq("order_sn", order_sn);

    if (error) {
      console.error("❌ Erro ao atualizar:", error);
    } else {
      console.log(`🔄 Pedido atualizado: ${order_sn} (${order.order_status})`);
    }
  } catch (err) {
    console.error("❌ Erro geral ao salvar no Supabase:", err);
  }
}

/* ============================================================
   ROTA PRINCIPAL DO WEBHOOK SHOPEE
============================================================ */
router.post("/", async (req, res) => {
  try {
    const body = req.body;

    console.log("====================================================");
    console.log("📩 Webhook recebido:", JSON.stringify(body));

    /* ----------------------------------------------------
       NORMALIZA order_sn
       Pode vir como: ordersn, order_sn ou order_sn_list
    ---------------------------------------------------- */
    const order_sn =
      body.data?.ordersn ||
      body.data?.order_sn ||
      body.data?.order_sn_list?.[0] ||
      null;

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





