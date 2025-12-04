import express from 'express';
import fs from 'fs';
import axios from 'axios';
import 'dotenv/config';


function readTokens() {
 try {
   const data = fs.readFileSync('tokens.json', 'utf-8');
   return JSON.parse(data);
 } catch (error) {
   console.error("Erro ao ler tokens.json:", error);
   return null;
 }
}

const router = express.Router();

router.get("/RelatorioPedidos", async (req, res) => {
    try {
        const { dataInicial, dataFinal, status_do_pedido = 4 } = req.query; 
        // 4 = COMPLETED (pedidos concluídos)

        if (!dataInicial || !dataFinal) {
            return res.status(400).json({ error: "Parâmetros dataInicial e dataFinal são obrigatórios." });
        }

        // Converter para timestamps UNIX em segundos
        const time_from = Math.floor(new Date(dataInicial).getTime() / 1000);
        const time_to = Math.floor(new Date(dataFinal).getTime() / 1000);

        // Aqui você chamará a API da Shopee
        const axios = require("axios");

        const response = await axios.get("https://openplatform.shopee.com.br/api/v2/order/get_order_list", {
            params: {
                time_range_field: "create_time",
                time_from,
                time_to,
                order_status: status_do_pedido
            },
            headers: {
                // coloque aqui seus headers obrigatórios da Shopee (authorization)
            }
        });

        return res.json(response.data);

    } catch (error) {
        console.error("Erro ao buscar pedidos:", error.response?.data || error);
        return res.status(500).json({ error: "Erro interno do servidor." });
    }
});
