import express from "express";
import axios from "axios";
import crypto from "crypto";
import { salvarPedidoShopee } from "./SalvarShopeeSupabase.js";
import { RenovaTokens } from "./RenovaTokens.js";

const router = express.Router();

/* ============================================================
   🔹 Middleware para garantir token válido
============================================================ */
async function garantirToken(req, res, next) {
  console.log("⏳ Verificando token antes da rota...");
  const tokenInfo = await RenovaTokens();
  if (!tokenInfo) {
    return res.status(500).json({ error: "Erro ao renovar token" });
  }

  // ⚠️ Ajuste: passamos token atualizado e shop_id diretamente
  req.access_token = tokenInfo.access_token;
  req.shop_id = tokenInfo.shop_id;
  next();
}

/* ============================================================
   Função para consultar pedido na Shopee
============================================================ */
async function consultarPedidoShopee(order_sn, access_token, shop_id) {
  try {
    const partner_id = Number(process.env.PARTNER_ID);
    const partner_key = process.env.PARTNER_KEY;

    if (!partner_id || !shop_id || !access_token || !partner_key) {
      return { error: "missing_credentials" };
    }

    const path = "/api/v2/order/get_order_detail";
    const timestamp = Math.floor(Date.now() / 1000);


    // 🔹 Base string correta para consulta
    const baseString = `${partner_id}${path}${timestamp}${access_token}${shop_id}`;
    const sign = crypto.createHmac("sha256", partner_key).update(baseString).digest("hex");

    const url =
      `https://openplatform.shopee.com${path}` +
      `?partner_id=${partner_id}` +
      `&timestamp=${timestamp}` +
      `&sign=${sign}` +
      `&access_token=${access_token}` +
      `&shop_id=${shop_id}`;

    const body = {
      order_sn_list: [order_sn],
      response_optional_fields: "recipient_address,item_list,payment_method,pay_time,shipping_carrier,tracking_number"
    };

    console.log("🔑 Access Token:", access_token);
    console.log("🛒 Shop ID:", shop_id);
    console.log("📦 Order SN:", order_sn);
    console.log("📤 URL da requisição:", url);
    console.log("📝 Body enviado:", body);

    const response = await axios.post(url, body);

    const pedido = response.data.response?.order_list?.[0];
    if (!pedido) {
      return { error: "order_not_found", raw: response.data };
    }

    return pedido;

  } catch (err) {
    return { error: "unexpected_error", detail: err.response?.data || err };
  }
}

/* ============================================================
   Rota para buscar pedido
============================================================ */
router.get("/buscar-pedido/:order_sn", garantirToken, async (req, res) => {
  const order_sn = req.params.order_sn;
  const access_token = req.access_token;
  const shop_id = req.shop_id;

  console.log("🔎 Consulta manual de pedido:", order_sn);

  const pedido = await consultarPedidoShopee(order_sn, access_token, shop_id);

 if (!pedido || pedido.error) {
  console.error("❌ ERRO AO CONSULTAR DETALHES DO PEDIDO:", pedido);
  return res.status(400).json({
    error: "Falha ao consultar pedido na Shopee",
    detalhe: pedido
  });
}
  console.log("✅ Pedido consultado com sucesso:", pedido);


  await salvarPedidoShopee(pedido);

  return res.json({
    mensagem: "Pedido encontrado e salvo no Supabase",
    pedido
  });
});

export default router;
