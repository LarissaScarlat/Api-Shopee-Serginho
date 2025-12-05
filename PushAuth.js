import express from "express";
import crypto from "crypto";

const router = express.Router();

// Captura RAW BODY
router.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

router.post("/", async (req, res) => {
  try {
    const rawBody = req.rawBody;
    const body = req.body; // já parseado automaticamente

    const partnerKey = process.env.PARTNER_KEY;

    // 👇 Agora pegamos a assinatura correta
    const receivedSignature = body.sign;

    // Shopee Webhook = HMAC_SHA256(rawBody)
    const calculatedSignature = crypto
      .createHmac("sha256", partnerKey)
      .update(rawBody)
      .digest("hex");

    console.log(">> Body recebido:", rawBody);
    console.log(">> Assinatura recebida:", receivedSignature);
    console.log(">> Assinatura calculada:", calculatedSignature);

    // 1️⃣ Webhook de verificação
    if (body.code === 0 && body.data?.verify_info) {
      return res.status(200).json({ code: 0, message: "success" });
    }

    // 2️⃣ Validação real da assinatura
    if (receivedSignature !== calculatedSignature) {
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

