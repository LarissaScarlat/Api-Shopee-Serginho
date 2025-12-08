import express from "express";
import axios from "axios";
import detalhesPedidos from "./DetalhesPedidos.js";

const router = express.Router();

router.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

router.post("/", async (req, res) => {
  try {
    console.log(">> Body recebido:", req.rawBody);

    const body = req.body;

    /* ============================================================
       1. EXTRAI O ORDER_SN DO WEBHOOK
    ============================================================= */
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

    /* ============================================================
       2. CHAMA A ROTA DO DETALHESPEDIDOS
    ============================================================= */
    try {
      await axios.get(`${process.env.REDIRECT_DOMAIN}/buscar-pedido/${order_sn}`);
      console.log("📤 Pedido encaminhado para DetalhesPedidos.js");
    } catch (err) {
      console.error("❌ Erro ao chamar DetalhesPedidos:", err.message);
    }

    return res.status(200).json({ message: "processado" });

  } catch (err) {
    console.error("❌ Erro no webhook Shopee:", err);
    return res.status(500).json({ error: "Erro interno no webhook" });
  }
});

export default router;


