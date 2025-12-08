import express from "express";
import axios from "axios";
import crypto from "crypto";
import { salvarPedidoShopee } from "./SalvarShopeeSupabase.js";
import { RenovaTokens } from "./RenovaTokens.js";

const router = express.Router();

/* ============================================================
   🔹 Middleware — obtém token válido antes de cada consulta
============================================================ */
async function garantirToken(req, res, next) {
  try {
    console.log("⏳ Renovando token antes da requisição...");

    const tokenInfo = await RenovaTokens();
    if (!tokenInfo || !tokenInfo.access_token) {
      return res.status(500).json({ error: "Falha ao renovar token" });
    }

    req.access_token = tokenInfo.access_token;
    req.shop_id = tokenInfo.shop_id;

    next();

  } catch (err) {
    console.error("❌ Erro no middleware garantirToken:", err);
    return res.status(500).json({ error: "Erro interno ao gerar token" });
  }
}

/* ============================================================
   🔹 Função que consulta pedido na Shopee
============================================================ */
async function consultarPedidoShopee(order_sn, access_token, shop_id) {
  try {
    const partner_id = Number(process.env.PARTNER_ID);
    const partner_key = process.env.PARTNER_KEY;

    const path = "/api/v2/order/get_order_detail";
    const timestamp = Math.floor(Date.now() / 1000);

    const baseString = `${partner_id}${path}${timestamp}${access_token}${shop_id}`;
    const sign = crypto.createHmac("sha256", partner_key).update(baseString).digest("hex");

    const url =
      `https://openplatform.shopee.com.br${path}?` +
      `partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}&` +
      `access_token=${access_token}&shop_id=${shop_id}`;

    const body = {
      order_sn_list: [order_sn],
      response_optional_fields:
        "recipient_address,item_list,payment_method,pay_time,shipping_carrier,tracking_number"
    };

    console.log("📤 Consultando pedido:", order_sn);

    const response = await axios.post(url, body);

    const pedido = response.data.response?.order_list?.[0];
    if (!pedido) {
      return { error: "order_not_found", detalhe: response.data };
    }

    return pedido;
  } catch (err) {
    console.error("❌ ERRO AO CONSULTAR PEDIDO NA SHOPEE:");
    console.error("Status:", err.response?.status);
    console.error("Data:", err.response?.data);

    return {
      error: "unexpected_error",
      detalhe: err.response?.data || err
    };
  }
}

/* ============================================================
   ROTA para acessar detalhes do pedido via HTTP (opcional)
============================================================ */
router.get("/buscar-pedido/:order_sn", garantirToken, async (req, res) => {
  const order_sn = req.params.order_sn;
  console.log("🔎 Recebido pedido do webhook:", order_sn);

  const pedido = await consultarPedidoShopee(order_sn, req.access_token, req.shop_id);

  if (!pedido || pedido.error) {
    console.error("❌ Falha ao consultar pedido:", pedido);
    return res.status(400).json({ error: "Erro ao consultar pedido", detalhe: pedido });
  }

  console.log("✅ Pedido encontrado:", pedido.order_sn);

  // Salvar no Supabase
  await salvarPedidoShopee(pedido);

  return res.json({ mensagem: "Pedido salvo no Supabase", pedido });
});

export { consultarPedidoShopee };
export default router;