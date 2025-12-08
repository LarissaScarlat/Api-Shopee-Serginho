// SalvarShopeeSupabase.js
import { supabase } from "./Supabase.js";

// Converte epoch para ISO com segurança
function safeDate(epoch) {
  if (!epoch || isNaN(epoch)) return null;
  return new Date(epoch * 1000).toISOString();
}

export async function salvarPedidoShopee(pedido) {
  try {
    const item = pedido.item_list?.[0] || {};

    const dataToSave = {
      // Identificação
      order_sn: pedido.order_sn,
      order_status: pedido.order_status,
      create_time: safeDate(pedido.create_time),
      update_time: safeDate(pedido.update_time),

      // Comprador
      buyer_user_id: pedido.buyer_user_id || null,
      buyer_username: pedido.buyer_user_name || null,

      // Item
      item_id: item.item_id || null,
      item_name: item.item_name || null,
      item_sku: item.model_sku || null,
      item_model_id: item.model_id || null,
      item_model_name: item.model_name || null,
      item_quantity: item.model_quantity_purchased || null,
      item_original_price: item.original_price || null,
      item_actual_price: item.price || null,

      // Logística
      warehouse_type: pedido.warehouse_type || null,
      shipping_method: pedido.shipping_method || null,
      shipping_carrier: pedido.package_list?.[0]?.shipping_carrier || null,
      tracking_number: pedido.package_list?.[0]?.tracking_number || null,

      // Pagamento
      payment_method: pedido.payment_method || null,
      escrow_amount: pedido.escrow_amount || null,
      COD: pedido.cod || false,

      // Auditoria
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from("shopee_orders")
      .upsert(dataToSave, { onConflict: "order_sn" });

    if (error) {
      console.error("❌ Erro ao salvar no Supabase:", error);
      return false;
    }

    console.log(`💾 Pedido ${pedido.order_sn} salvo com sucesso no Supabase.`);
    return true;

  } catch (err) {
    console.error("❌ Erro inesperado ao salvar pedido:", err);
    return false;
  }
}

