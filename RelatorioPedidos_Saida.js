import express from "express";
import fs from "fs";
import crypto from "crypto";
import axios from "axios";

const router = express.Router();

function readTokens() {
  try {
    const data = fs.readFileSync("tokens.json", "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Erro ao ler tokens.json:", err);
    return null;
  }
}

function generateApiSign(path, timestamp, accessToken, shopId) {
  const baseString =
    process.env.PARTNER_ID +
    path +
    timestamp +
    accessToken +
    shopId;

  return crypto
    .createHmac("sha256", process.env.PARTNER_KEY)
    .update(baseString)
    .digest("hex");
}

router.get("/RelatorioPedidos", async (req, res) => {
  try {
    const { dataInicial, dataFinal, status_do_pedido = 4 } = req.query;

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({
        error: "Parâmetros dataInicial e dataFinal são obrigatórios."
      });
    }

    const tokens = readTokens();

    if (!tokens) {
      return res.status(500).json({ error: "Tokens não encontrados." });
    }

    const accessToken = tokens.access_token;
    const shopId = tokens.shop_id;

    const time_from = Math.floor(new Date(dataInicial).getTime() / 1000);
    const time_to = Math.floor(new Date(dataFinal).getTime() / 1000);

    const path = "/api/v2/order/get_order_list";
    const timestamp = Math.floor(Date.now() / 1000);

    const sign = generateApiSign(path, timestamp, accessToken, shopId);

    const url =
      "https://openplatform.shopee.com.br/api/v2/order/get_order_list";

    const response = await axios.get(url, {
      params: {
        partner_id: process.env.PARTNER_ID,
        shop_id: shopId,
        access_token: accessToken,
        timestamp,
        sign,
        time_range_field: "create_time",
        time_from,
        time_to,
        order_status: Number(status_do_pedido)
      }
    });

    return res.json(response.data);
  } catch (error) {
    console.error(
      "❌ Erro ao buscar pedidos:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      error: "Erro ao consultar a API da Shopee."
    });
  }
});

export default router;
