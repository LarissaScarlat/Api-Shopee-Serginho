import { supabase } from "./Supabase.js";

export async function salvarPedidoShopee(pedido) {
  try {
    const item = pedido.item_list?.[0] || {};

    const dados = {
      orden_sn: pedido.order_sn,
      order_date: pedido.create_time ? new Date(pedido.create_time * 1000).toISOString() : null,
      status: pedido.order_status || null,
      plataforma: "Shopee",
      deposito: pedido.warehouse_type || null,
      sku: item.model_sku || item.item_sku || null,
      titulo_anuncio: item.item_name || null,
    };

    console.log("📦 Dados enviados ao Supabase:", dados);

    const { data, error } = await supabase
      .from("shopee_orders")
      .insert(dados);

    if (error) {
      console.error("❌ Erro ao salvar no Supabase:", error);
      return;
    }

    console.log("✅ Pedido salvo no Supabase:", data);

  } catch (err) {
    console.error("❌ Erro inesperado:", err);
  }
}

