import express from "express";
import crypto from "crypto";

const router = express.Router();


// Para capturar o RAW body da requisição
router.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString(); // Guarda o corpo sem parse
  }
}));

router.post("/", async (req, res) => {
  try {
    const rawBody = req.rawBody;
    const receivedSignature = req.headers["authorization"]; // assinatura da Shopee

    const partnerKey = process.env.PARTNER_KEY;
    const webhookUrl = "https://api-shopee-serginho.onrender.com/notificacoes-shopee"; // exatamente como cadastrado

    // 🔥 Montar baseString da Shopee
    const baseString = webhookUrl + "|" + rawBody;

    // 🔥 Gerar assinatura local
    const calculatedSignature = crypto
      .createHmac("sha256", partnerKey)
      .update(baseString)
      .digest("hex");

    console.log(">> Body recebido:", rawBody);
    console.log(">> Assinatura recebida:", receivedSignature);
    console.log(">> Assinatura calculada:", calculatedSignature);

    // 🎯 Validar assinatura
    if (receivedSignature !== calculatedSignature) {
      return res.status(401).json({ error: "Assinatura inválida!" });
    }

    console.log("🔐 Assinatura validada! Push é seguro.");

    // Agora você pode tratar o evento normalmente
    const data = req.body;

    // Exemplos:
    // if (data.code === 1 && data.data.order_sn) { ... }
    // if (data.code === 2 && data.data.tracking_no) { ... }

    return res.status(200).json({ message: "OK" });

  } catch (err) {
    console.error("Erro no webhook Shopee:", err);
    return res.status(500).json({ error: "Erro interno no webhook" });
  }
});

export default router;
