import express from "express";

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

    // Aqui você já pode processar o pedido no banco
    // exemplo:
    // await gravaPedidoSupabase(body);

    return res.status(200).json({ message: "OK" });

  } catch (err) {
    console.error("Erro no webhook Shopee:", err);
    return res.status(500).json({ error: "Erro interno no webhook" });
  }
});

export default router;

