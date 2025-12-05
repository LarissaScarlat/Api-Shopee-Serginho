import express from "express";
import crypto from "crypto";

const router = express.Router();

router.post("/", (req, res) => {
  const rawBody = req.rawBody; // Corpo cru
  const receivedSignature = req.headers["authorization"];
  const partnerKey = process.env.PARTNER_KEY;
  const webhookUrl = "https://api-shopee-serginho.onrender.com/notificacoes-shopee";

  console.log(">> Body RAW:", rawBody);

  // A Shopee NÃO envia assinatura durante o teste automático
  if (!receivedSignature) {
    console.log(">> Teste de verificação da Shopee recebido.");
    return res.status(200).json({ message: "OK" });
  }

  const baseString = webhookUrl + "|" + rawBody;

  const generatedSign = crypto
    .createHmac("sha256", partnerKey)
    .update(baseString)
    .digest("hex");

  console.log(">> Assinatura recebida:", receivedSignature);
  console.log(">> Assinatura calculada:", generatedSign);

  if (receivedSignature !== generatedSign) {
    return res.status(401).json({ error: "Assinatura inválida" });
  }

  console.log(">> Notificação válida recebida:", req.body);

  return res.status(200).json({ message: "OK" });
});

export default router;

