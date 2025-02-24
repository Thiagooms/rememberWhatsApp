require("dotenv").config();
const express = require("express");
const admin = require("firebase-admin");
const fs = require("fs");
const cron = require("node-cron");
const axios = require("axios");
const venom = require("venom-bot");

// Inicializar Firebase com a chave privada
const serviceAccount = require(process.env.FIREBASE_CREDENTIALS);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const app = express();
app.use(express.json()); // Para processar JSON nas requisições

// Rota de teste
app.get("/", (req, res) => {
  res.send("API de Lembretes funcionando!");
});

// Rota para cadastrar um lembrete
app.post("/lembrete", async (req, res) => {
    try {
      const { produto, data } = req.body;
  
      if (!produto || !data) {
        return res.status(400).json({ error: "Produto e data são obrigatórios" });
      }
  
      // Salvar no Firebase
      const novoLembrete = await db.collection("lembretes").add({
        produto,
        data,
        enviado: false,
      });
  
      res.json({ message: "Lembrete cadastrado!", id: novoLembrete.id });
    } catch (error) {
      res.status(500).json({ error: "Erro ao cadastrar lembrete" });
    }
});

// Função para verificar lembretes e marcar para envio
const verificarLembretes = async () => {
    try {
      const hoje = new Date();
      const dataAlvo = new Date();
      dataAlvo.setDate(hoje.getDate() + 10); // Buscar lembretes a 10 dias da data atual
  
      // Formatar data para YYYY-MM-DD (para comparar no banco)
      const dataFormatada = dataAlvo.toISOString().split("T")[0];
  
      // Buscar lembretes no Firebase que têm essa data e ainda não foram enviados
      const snapshot = await db
        .collection("lembretes")
        .where("data", "==", dataFormatada)
        .where("enviado", "==", false)
        .get();
  
      if (snapshot.empty) {
        console.log("Nenhum lembrete para enviar hoje.");
        return;
      }
  
      snapshot.forEach(async (doc) => {
        const lembrete = doc.data();
        console.log(`Lembrete encontrado para envio: ${lembrete.produto}`);
  
        // Aqui podemos chamar a função de envio do WhatsApp
        await enviarWhatsApp(lembrete.produto);
  
        // Atualizar no Firebase para indicar que já foi enviado
        await db.collection("lembretes").doc(doc.id).update({ enviado: true });
  
        console.log(`Lembrete enviado: ${lembrete.produto}`);
      });
    } catch (error) {
      console.error("Erro ao verificar lembretes:", error);
    }
  };
  
  // Agendar a execução todos os dias às 9h da manhã
  cron.schedule("0 9 * * *", () => {
    console.log("🔍 Verificando lembretes...");
    verificarLembretes();
});

// Criar uma sessão do WhatsApp
let client;

venom
  .create({
    session: "whatsapp-session", // Nome da sessão
  })
  .then((whatsappClient) => {
    client = whatsappClient;
    console.log("✅ WhatsApp conectado!");
  })
  .catch((error) => {
    console.error("Erro ao iniciar WhatsApp:", error);
  });

// Função para enviar mensagem pelo WhatsApp
const enviarWhatsApp = async (produto) => {
  try {
    const numeroDestino = "55XXXXXXXXXX"; // Substituir pelo número real do usuário
    const mensagem = `📢 Lembrete! Seu produto "${produto}" está com a data próxima.`;

    if (!client) {
      console.error("Erro: Cliente do WhatsApp não está pronto ainda.");
      return;
    }

    await client.sendText(numeroDestino + "@c.us", mensagem);
    console.log(`✅ Mensagem enviada para ${numeroDestino}: ${mensagem}`);
  } catch (error) {
    console.error("Erro ao enviar WhatsApp:", error);
  }
};

// Iniciar servidor na porta 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
