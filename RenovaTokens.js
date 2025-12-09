// RenovaTokens.js
import fs from "fs";
import axios from "axios";
import crypto from "crypto";
import path from "path";

const TOKENS_FILE = path.resolve("tokens.json");
let renewingPromise = null; // evita renovação concorrente na mesma instância

function safeWriteFileSync(filePath, content) {
  // escrita atômica: escreve em temp e renomeia
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, content, { encoding: "utf8" });
  fs.renameSync(tmp, filePath);
}

function generateSign(partner_key, partner_id, reqPath, timestamp) {
  // sign = HMAC_SHA256(partner_id + api_path + timestamp, partner_key)
  const toSign = `${partner_id}${reqPath}${timestamp}`;
  return crypto.createHmac("sha256", partner_key).update(toSign).digest("hex");
}

export async function RenovaTokens() {
  // Se já está renovando, retorna a mesma promessa (evita corrida)
  if (renewingPromise) return renewingPromise;

  renewingPromise = (async () => {
    try {
      console.log("🔄 Verificando validade do access_token...");

      // Lê tokens salvos (se não existir, retorna null)
      let tokenInfo;
      try {
        const raw = fs.readFileSync(TOKENS_FILE, "utf8");
        tokenInfo = JSON.parse(raw);
      } catch (err) {
        console.warn("⚠ tokens.json não encontrado ou inválido:", err.message);
        renewingPromise = null;
        return null;
      }

      // Normaliza campos
      tokenInfo.expire_at = tokenInfo.expire_at ? Number(tokenInfo.expire_at) : 0;
      const shop_id = tokenInfo.shop_id_list?.[0] || tokenInfo.shop_id;
      const refresh_token = tokenInfo.refresh_token;

      if (!shop_id || !refresh_token) {
        console.error("❌ shop_id ou refresh_token inválido/no tokens.json");
        renewingPromise = null;
        return null;
      }

      const agora = Math.floor(Date.now() / 1000);

      // Valida timestamp local (protege contra relógio do servidor totalmente fora)
      // Jan 1 2020 ~ 1577836800 ; ano 2035 ~ 2040000000. Ajuste se necessário.
      if (agora < 1600000000 || agora > 2000000000) {
        console.error("❌ Timestamp do servidor parece inválido:", agora);
        // Não tentamos consertar o clock aqui — apenas abortamos para evitar assinaturas inválidas
        renewingPromise = null;
        return null;
      }

      // Se ainda válido com um buffer de 5 minutos
      if (tokenInfo.expire_at && agora < tokenInfo.expire_at - 300) {
        console.log("✅ Token ainda válido (expire_at:", tokenInfo.expire_at, ")");
        renewingPromise = null;
        return { ...tokenInfo, shop_id };
      }

      console.log("⚠ Token expirado (ou próximo do fim). Renovando...");

      const partner_id = Number(process.env.PARTNER_ID);
      const partner_key = process.env.PARTNER_KEY;
      if (!partner_id || !partner_key) {
        console.error("❌ PARTNER_ID ou PARTNER_KEY não definidos no .env");
        renewingPromise = null;
        return null;
      }

      const pathApi = "/api/v2/auth/access_token/get";
      const timestamp = Math.floor(Date.now() / 1000);

      const sign = generateSign(partner_key, partner_id, pathApi, timestamp);

      const url = `https://partner.shopeemobile.com${pathApi}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}`;

      const body = {
        partner_id,
        shop_id,
        refresh_token
      };

      // timeout e validateStatus para tratar non-2xx como erro
      const response = await axios.post(url, body, {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
        validateStatus: status => status >= 200 && status < 500 // permitimos ler body de 4xx/5xx
      });

      if (!response || !response.data) {
        console.error("❌ resposta inválida da Shopee:", response && response.status);
        renewingPromise = null;
        return null;
      }

      // Shopee devolve campos dentro de response.data — ajuste conforme resposta real
      const data = response.data;

      if (data.error && String(data.error).length) {
        console.error("❌ Erro da Shopee ao renovar token:", data);
        renewingPromise = null;
        return null;
      }

      // Dependendo da resposta, alguns endpoints encapsulam em data.response — tenta buscar os campos
      const access_token = data.access_token || data.response?.access_token;
      const new_refresh_token = data.refresh_token || data.response?.refresh_token;
      const expire_in = Number(data.expire_in || data.response?.expire_in || 0);
      const expire_at = data.expire_at
        ? Number(data.expire_at)
        : (expire_in ? timestamp + expire_in : timestamp + 4 * 3600);

      if (!access_token) {
        console.error("❌ Access token não recebido na renovação:", data);
        renewingPromise = null;
        return null;
      }

      const novoToken = {
        access_token,
        refresh_token: new_refresh_token || refresh_token,
        expire_in,
        expire_at,
        timestamp,
        shop_id,
        shop_id_list: [shop_id]
      };

      try {
        safeWriteFileSync(TOKENS_FILE, JSON.stringify(novoToken, null, 2));
        console.log("✅ Token renovado e salvo em tokens.json");
      } catch (err) {
        console.error("❌ Erro ao salvar tokens.json:", err);
        // Mesmo que salve falhe, retornamos o token em memória
      }

      renewingPromise = null;
      return novoToken;

    } catch (err) {
      console.error("❌ Erro inesperado em RenovaTokens:", err.response?.data || err.message || err);
      renewingPromise = null;
      return null;
    }
  })();

  return renewingPromise;
}
