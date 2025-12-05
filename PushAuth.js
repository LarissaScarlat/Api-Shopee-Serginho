import express from "express";
import crypto from "crypto";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const rawBody = req.rawBody;
    const receivedSignature = req.headers["x-shopee-signature"];
    const timestamp = req.headers["x-shopee-timestamp"];
    const partnerKey = process.env.PARTNER_KEY;

    const path = "/notificacoes-shopee"; // o mesmo cadastrado na Shopee!

    console.log(">> Body recebido:", rawBody);
    console.log(">> Assinatura recebida:", receivedSignature);

    // Verificação especial de webhook
    if (req.body?.data?.verify_info) {
      console.log("🔍 Webhook de verificação recebido!");
      return res.status(200).json({
        code: 0,
        message: "success"
      });
    }

    // Calcula a assinatura correta Shopee v2
    const baseString = `${process.env.PARTNER_ID}${path}${timestamp}${rawBody}`;

    const calculatedSignature = crypto
      .createHmac("sha256", partnerKey)
      .update(baseString)
      .digest("hex");

    console.log(">> Assinatura calculada:", calculatedSignature);

    // Validação
    if (receivedSignature !== calculatedSignature) {
      console.log("❌ Assinatura inválida!");
      return res.status(401).json({ error: "Assinatura inválida!" });
    }

    console.log("🔐 Assinatura validada!");
    return res.status(200).json({ message: "OK" });

  } catch (err) {
    console.error("Erro no webhook Shopee:", err);
    return res.status(500).json({ error: "Erro interno no webhook" });
  }
});

export default router;

