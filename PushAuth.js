import express from "express";
import { consultarPedidoShopee } from "./DetalhesPedidos.js";
import { RenovaTokens } from "./RenovaTokens.js";
import { salvarPedidoShopee } from "./SalvarShopeeSupabase.js";

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

    // ============================================================
    // 1️⃣ Extrai order_sn do webhook
    // ============================================================
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

    // ============================================================
    // 2️⃣ Renovar token antes de consultar pedido
    // ============================================================
    const tokenInfo = await RenovaTokens();
    if (!tokenInfo || !tokenInfo.access_token) {
      console.error("❌ Falha ao renovar token");
      return res.status(500).json({ error: "Falha ao renovar token" });
    }

    const access_token = tokenInfo.access_token;
    const shop_id = tokenInfo.shop_id;

    // ============================================================
    // 3️⃣ Consulta pedido diretamente sem fazer HTTP para si mesmo
    // ============================================================
    const pedido = await consultarPedidoShopee(order_sn, access_token, shop_id);

    if (!pedido || pedido.error) {
      console.error("❌ Falha ao consultar pedido:", pedido);
      return res.status(400).json({ error: "Falha ao consultar pedido", detalhe: pedido });
    }

    // ============================================================
    // 4️⃣ Salvar pedido no Supabase
    // ============================================================
    await salvarPedidoShopee(pedido);
    console.log("✅ Pedido salvo com sucesso:", order_sn);

    return res.status(200).json({ message: "Pedido processado", pedido });

  } catch (err) {
    console.error("❌ Erro no webhook Shopee:", err);
    return res.status(500).json({ error: "Erro interno no webhook" });
  }
});

export default router;



