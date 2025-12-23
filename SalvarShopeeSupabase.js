import { supabase } from "./Supabase.js";


export async function salvarPedidoShopee(pedido) {
  try {
    // -----------------------------
    // 1️⃣ Aceitar somente pedidos válidos
    // -----------------------------
    const statusPermitidos = ["COMPLETED", "READY_TO_SHIP"]; 
    // COMPLETED = concluído
    // READY_TO_SHIP = a enviar

    if (!statusPermitidos.includes(pedido.order_status)) {
      console.log(
        `⛔ Pedido ignorado (${pedido.order_sn}) — status não permitido: ${pedido.order_status}`
      );
      return;
    }

    // -----------------------------
    // 2️⃣ Verificar SE JÁ EXISTE O PEDIDO
    // -----------------------------
    const { data: existente } = await supabase
      .from("shopee_orders")
      .select("n_pedido")
      .eq("n_pedido", pedido.order_sn)
      .maybeSingle();

    if (existente) {
      console.log(`⚠ Pedido já existe no Supabase, ignorado: ${pedido.order_sn}`);
      return;
    }

    // -----------------------------
    // 3️⃣ Preparar dados
    // -----------------------------
    const item = pedido.item_list?.[0] || {};

    const dados = {
      n_pedido: pedido.order_sn,
      data_pedido: pedido.create_time
        ? new Date(pedido.create_time * 1000).toISOString()
        : null,
      status: pedido.order_status,
      plataforma: "Shopee",
      deposito: pedido.warehouse_type || null,
      sku: item.model_sku || item.item_sku || null,
      titulo_anuncio: item.item_name || null,
      quantidade:
        item.model_quantity_purchased ||
        item.quantity ||
        1, // fallback
    };

    console.log("📦 Dados enviados ao Supabase:", dados);

    // -----------------------------
    // 4️⃣ Inserir no Supabase
    // -----------------------------
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
