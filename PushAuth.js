import express from "express";
import crypto from "crypto";

const router = express.Router();


router.post("/", async (req, res) => {
  try {
    const rawBody = req.rawBody;
    const receivedSignature = req.headers["authorization"];
    const partnerKey = process.env.PARTNER_KEY;

    const webhookUrl = "https://api-shopee-serginho.onrender.com/notificacoes-shopee";
    const baseString = `${webhookUrl}|${rawBody}`;

    const calculatedSignature = crypto
      .createHmac("sha256", partnerKey)
      .update(baseString)
      .digest("hex");

    console.log(">> Body recebido:", rawBody);
    console.log(">> Assinatura recebida:", receivedSignature);
    console.log(">> Assinatura calculada:", calculatedSignature);

    const body = req.body;

    // 🔥 1️⃣ CASO ESPECIAL — VERIFICAÇÃO DE WEBHOOK
    if (body.code === 0 && body.data?.verify_info) {
      console.log("🔍 Webhook de verificação recebido. Respondendo formato exigido.");
      return res.status(200).json({
        code: 0,
        message: "success"
      });
    }

    // 🔥 2️⃣ Webhooks reais → validar assinatura
    if (receivedSignature !== calculatedSignature) {
      return res.status(401).json({ error: "Assinatura inválida!" });
    }

    console.log("🔐 Assinatura validada! Push é seguro.");
    return res.status(200).json({ message: "OK" });

  } catch (err) {
    console.error("Erro no webhook Shopee:", err);
    return res.status(500).json({ error: "Erro interno no webhook" });
  }
});

export default router;