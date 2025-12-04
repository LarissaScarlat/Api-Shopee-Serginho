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


router.get ("/pedidospreparação", async (req, res) => {
try {
    const { dataInicial, dataFinal } = req.query;

if (!dataInicial || !dataFinal) {
    return res.status(400).json({ error: "Parâmetros dataInicial e dataFinal são obrigatórios." });
}



} catch (error) {
    console.error("Erro ao buscar pedidos:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
}
});
