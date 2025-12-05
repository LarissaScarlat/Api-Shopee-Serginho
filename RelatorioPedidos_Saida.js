// PushPedidos.js
import express from "express";
import crypto from "crypto";
import axios from "axios";
import fs from "fs";
import { supabase } from "./supabase.js";
import { createClient } from '@supabase/supabase-js'

const router = express.Router();

// Capturar RAW BODY (necessário para validar a assinatura)
router.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));


// Função para buscar detalhes do pedido
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

  const response = await axios.post(url, body, {
    headers: { "Content-Type": "application/json" }
  });

  return response.data.response.order_list[0];
}


// Função para gravar sem duplicidade
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



// Webhook principal
router.post("/", async (req, res) => {
  try {
    const rawBody = req.rawBody;
    const receivedSignature = req.headers["authorization"];
    const partnerKey = process.env.PARTNER_KEY;

    const webhookUrl = "https://api-shopee-serginho.onrender.com/notificacoes-shopee";

    // Assinatura da Shopee: url + "|" + body
    const baseString = webhookUrl + "|" + rawBody;

    const calculatedSignature = crypto
      .createHmac("sha256", partnerKey)
      .update(baseString)
      .digest("hex");

    console.log("Body recebido:", rawBody);
    console.log("Assinatura recebida:", receivedSignature);
    console.log("Assinatura calculada:", calculatedSignature);

    if (receivedSignature !== calculatedSignature) {
      return res.status(401).json({ error: "Assinatura inválida!" });
    }

    const body = JSON.parse(rawBody);

    // SHOPEE TESTE DE VERIFICAÇÃO
    if (body?.code === 0) {
      console.log("Teste de verificação recebido.");
      return res.status(200).json({ msg: "OK" });
    }

    // RECEBE PEDIDOS DE FATO
    if (body.code === 1 && body.data?.order_sn_list) {
      for (const order_sn of body.data.order_sn_list) {
        console.log("📦 Recebendo pedido:", order_sn);

        const detail = await getOrderDetail(order_sn);

        if (detail) {
          await saveOrder(detail);
        }
      }

      return res.status(200).json({ message: "Pedidos processados" });
    }

    return res.status(200).json({ message: "Ignorado" });

  } catch (err) {
    console.error("Erro no webhook:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

export default router;


