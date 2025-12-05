// PushPedidos.js
import express from "express";
import axios from "axios";
import fs from "fs";
import { supabase } from "./Supabase.js";

const router = express.Router();


// === BUSCA DETALHE DO PEDIDO ===
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
  return response.data.response.order_list[0];
}


// === SALVAR NO SUPABASE SEM DUPLICAR ===
async function saveOrder(order) {
  const order_sn = order.order_sn;

  const { data: exists } = await supabase
    .from("orders")
    .select("order_sn")
    .eq("order_sn", order_sn)
    .maybeSingle();

  if (exists) {
    console.log(`⚠️ Pedido ${order_sn} já existe. Pulando.`);
    return;
  }

  await supabase.from("orders").insert({
    order_sn: order.order_sn,
    status: order.order_status,
    buyer: order.buyer_username,
    total: order.total_amount,
    items: order.item_list,
    address: order.recipient_address
  });

  console.log(`✅ Pedido ${order_sn} salvo no Supabase!`);
}



// === ROTAS (APENAS PROCESSA) ===
router.post("/", async (req, res) => {
  try {
    const body = req.body;  // já validado pelo outro arquivo

    // SHOPEE ENVIA: code 1 (pedido atualizado)
    if (body.code === 1 && body.data?.order_sn_list) {
      for (const order_sn of body.data.order_sn_list) {
        console.log("📦 Processando pedido:", order_sn);

        const detail = await getOrderDetail(order_sn);
        if (detail) await saveOrder(detail);
      }

      return res.status(200).json({ message: "Pedidos processados" });
    }

    return res.status(200).json({ message: "Nada para fazer" });

  } catch (err) {
    console.error("Erro ao processar pedidos:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

export default router;



