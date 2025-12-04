import fs from 'fs';
import axios from 'axios';

const TOKEN_FILE = 'tokens.json';

function carregarTokens() {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return null;
    }

    const data = fs.readFileSync(TOKEN_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Erro ao carregar tokens:", err);
    return null;
  }
}

function salvarTokens(tokens) {
  const data = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000
  };

  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log("💾 Tokens renovados e salvos com sucesso!");
}

async function renovarTokens(refresh_token) {
  console.log("🔄 Renovando tokens com refresh_token:", refresh_token);

  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("client_id", process.env.CLIENT_ID);
  params.append("client_secret", process.env.CLIENT_SECRET);
  params.append("refresh_token", refresh_token);

  try {
    const response = await axios.post(
      "https://api.mercadolibre.com/oauth/token",
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          accept: "application/json"
        }
      }
    );

    salvarTokens(response.data);

    return response.data.access_token;

  } catch (error) {
    console.error("❌ ERRO AO RENOVAR TOKEN:", error.response?.data || error);
    throw new Error("Falha ao renovar token");
  }
}

export async function getAccessToken() {
  const tokens = carregarTokens();

  if (!tokens) {
    throw new Error("❌ Nenhum tokens.json encontrado! Você precisa gerar o token inicial novamente.");
  }

  // SE O TOKEN EXPIROU, RENOVA
  if (!tokens.expires_at || Date.now() >= tokens.expires_at) {
    console.log("⏰ Token expirado — renovando...");
    return await renovarTokens(tokens.refresh_token);
  }

  // SE ESTÁ VÁLIDO, DEVOLVE O TOKEN ATUAL
  return tokens.access_token;
}