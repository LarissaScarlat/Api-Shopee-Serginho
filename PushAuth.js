import express from "express";

const router = express.Router();

router.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

router.use((req, res, next) => {
  try {
    console.log(">> Body recebido:", req.rawBody);

    // Aqui você pode apenas validar, não responder
    next();

  } catch (err) {
    console.error("Erro no middleware Shopee:", err);
    next(err); 
  }
});

export default router;


