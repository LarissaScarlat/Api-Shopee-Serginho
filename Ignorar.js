import express from 'express';
import fs from 'fs';
import axios from 'axios';
import 'dotenv/config';

const router = express.Router();

/* ============================================================
   ROTA PRINCIPAL DO WEBHOOK SHOPEE
============================================================ */
router.post("/notificacoes-shopee", async (req, res) => {
  try {
    const body = req.body;

    console.log("====================================================");
    console.log("📩 Webhook recebido:", JSON.stringify(body));

    let order_sn = null;

    if (body.data?.ordersn) order_sn = body.data.ordersn;
    else if (body.data?.order_sn) order_sn = body.data.order_sn;
    else if (Array.isArray(body.data?.order_sn_list)) order_sn = body.data.order_sn_list[0];
    else if (body.ordersn) order_sn = body.ordersn;

    if (!order_sn) {
      console.log("⚠️ Webhook ignorado — não contém order_sn");
      return res.status(200).json({ message: "ignorado" });
    }

    console.log(`🔎 Pedido detectado: ${order_sn}`);

    // Chama o backend de detalhes
    try {
      await axios.get(`${process.env.REDIRECT_DOMAIN}/buscar-pedido/${order_sn}`);
      console.log(`📤 Pedido enviado para DetalhesPedidos.js`);
    } catch (err) {
      console.error("❌ Erro ao chamar backend de detalhes:", err);
    }

    return res.status(200).json({ message: "processado" });

  } catch (err) {
    console.error("❌ Erro ao processar webhook:", err);
    return res.status(500).json({ error: "erro interno" });
  }
});

export default router;






