import axios from 'axios';
import { getAccessToken } from './RenovaTokens.js';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

router.post("/notificacoes-ml", async (req, res) => {
  try {
    const body = req.body;
    const { resource, topic } = body;

    console.log("📩 Notificação recebida:", body);

    if (!resource || !topic.includes("order")) {
      return res.status(200).send("OK");
    }

    const orderId = resource.split("/")[2];

    const access_token = await getAccessToken();

    const orderResponse = await axios.get(
      `https://api.mercadolibre.com/orders/${orderId}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const order = orderResponse.data;

    if (order.status !== 'paid') {
      return res.status(200).send("OK");
    }

    // Mapeia itens para inserir em lote
    const itensParaInserir = order.order_items.map(item => ({
  order_id: order.id,
  order_date: order.date_created,
  product_id: item.item.seller_sku || item.item.id,  // <<--- Aqui está o SKU
  title: item.item.title,
  quantity: item.quantity,
  total_amount: item.full_unit_price * item.quantity,
  platform: order.context.site,
  status: order.status,
  buyer_document: order.buyer?.tax_id || null,
  buyer_state: order.shipping?.receiver_address?.state || null,
  deposit: "Full"
}));


  // Inserção em lote com proteção contra duplicidade
const { data, error } = await supabase
  .from("ml_orders")
  .insert(itensParaInserir)
  .select();

if (error) {
  // Se for erro de chave duplicada (pedido já existe)
  if (error.code === "23505") {
  console.log("⚠️ Item já inserido anteriormente. Ignorando duplicidade.");
  return res.status(200).send("OK");
}

  console.error("❌ Erro ao inserir no Supabase:", error);
  return res.status(500).send("Erro ao inserir no banco");
}

  console.log("✅ Itens inseridos:", data);


    return res.status(200).send("OK");

  } catch (error) {
    console.error("❌ Erro ao processar notificação:", error.response?.data || error.message);
    return res.status(500).send("Erro interno");
  }
});

export default router;