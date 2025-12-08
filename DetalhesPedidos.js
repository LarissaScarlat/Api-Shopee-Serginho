import axios from "axios";
import crypto from "crypto";
import { RenovaTokens } from "./RenovaTokens.js";
import { salvarPedidoShopee } from "./SalvarShopeeSupabase.js";

/* ============================================================
   Função principal chamada pelo PushAuth
============================================================ */
export async function obterDetalhesPedido(order_sn) {
  console.log("🔎 Obtendo detalhes do pedido:", order_sn);

  // 1. Renova token
  const tokenInfo = await RenovaTokens();
  if (!tokenInfo) {
    return { error: "token_error", message: "Falha ao renovar token" };
  }

  const access_token = tokenInfo.access_token;
  const shop_id = tokenInfo.shop_id;

  // 2. Consulta pedido
  const pedido = await consultarPedidoShopee(order_sn, access_token, shop_id);

  if (!pedido || pedido.error) {
    console.error("❌ Erro ao consultar pedido:", pedido);
    return pedido;
  }

  // 3. Salva no Supabase
  await salvarPedidoShopee(pedido);

  return pedido;
}

/* ============================================================
   Consulta detalhes do pedido na API da Shopee
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
      `https://openplatform.shopee.com${path}` +
      `?partner_id=${partner_id}` +
      `&timestamp=${timestamp}` +
      `&sign=${sign}` +
      `&access_token=${access_token}` +
      `&shop_id=${shop_id}`;

    const body = {
      order_sn_list: [order_sn],
      response_optional_fields:
        "recipient_address,item_list,payment_method,pay_time,shipping_carrier,tracking_number"
    };

    console.log("📤 Enviando consulta:", url);

    const response = await axios.post(url, body);

    const pedido = response.data.response?.order_list?.[0];
    if (!pedido) {
      return { error: "order_not_found", raw: response.data };
    }

    return pedido;

  } catch (err) {
    console.error("❌ ERRO DETALHADO SHOPEE:");
    console.error("📌 Status:", err.response?.status);
    console.error("📌 Data:", err.response?.data);
    console.error("📌 Headers:", err.response?.headers);
    console.error("📌 Config:", err.config);

    return {
      error: "unexpected_error",
      detail: err.response?.data || err
    };
  }
}


export default router;
