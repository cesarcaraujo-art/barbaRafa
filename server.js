const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');

const app = express();

// Permite requisições de qualquer origem (inclusive Netlify)
// Substitua o trecho do app.use(cors()) por este no seu server.js:
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Inicialização do Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Banco de dados em memória para barbeiros e agendamentos
let usuariosBarbeiros = [
  {
    id: 1,
    nome: 'Carlos Silva',
    email: 'carlos@barbearia.com',
    senha: 'senhaProvisoria123',
    primeiroAcesso: true
  }
];

let agendamentosGuardados = [];

// 1. Rota de Ping / Health Check
app.get('/api/ping', (req, res) => {
  res.status(200).send('OK');
});

// 2. Consulta de Horários Ocupados
app.get('/api/horarios-ocupados', (req, res) => {
  const { data, barbeiro } = req.query;

  if (!data || !barbeiro) {
    return res.status(200).json([]);
  }

  const ocupados = agendamentosGuardados
    .filter(a => a.data === data && a.barbeiro === barbeiro)
    .map(a => a.hora);

  res.status(200).json(ocupados);
});

// 3. Envio de E-mail de Confirmação
app.post('/api/enviar-email-confirmacao', async (req, res) => {
  const { nome, email, barbeiro, servico, preco, data, hora } = req.body;
  const dataFormatada = data ? data.split('-').reverse().join('/') : '';

  // Guarda o agendamento no servidor para bloquear o horário
  agendamentosGuardados.push({ nome, email, barbeiro, servico, preco, data, hora });

  try {
    const dataEnvio = await resend.emails.send({
      from: 'Barbearia Rafael <onboarding@resend.dev>',
      to: email,
      subject: '✂️ Confirmação do seu Agendamento - Barbearia Rafael',
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; color: #333;">
          <div style="max-width: 500px; background: #ffffff; padding: 25px; border-radius: 8px; margin: 0 auto; border-top: 4px solid #e0a96d;">
            <h2 style="color: #e0a96d; text-align: center; margin-top: 0;">Agendamento Confirmado!</h2>
            <p>Olá, <strong>${nome}</strong>!</p>
            <p>Seu horário na <strong>Barbearia Rafael</strong> foi reservado com sucesso. Confira os detalhes abaixo:</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;">
            
            <p><strong>💈 Barbeiro:</strong> ${barbeiro}</p>
            <p><strong>✂️ Serviço:</strong> ${servico} (R$ ${parseFloat(preco || 0).toFixed(2).replace('.', ',')})</p>
            <p><strong>📅 Data:</strong> ${dataFormatada}</p>
            <p><strong>🕒 Horário:</strong> ${hora}hs</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;">
            
            <p style="font-size: 0.85rem; color: #777; text-align: center; margin-bottom: 0;">
              Caso precise remarcar ou cancelar, entre em contato com antecedência. Te esperamos!
            </p>
          </div>
        </div>
      `
    });

    console.log(`✅ E-mail enviado para: ${email}`, dataEnvio);
    res.status(200).json({ sucesso: true, mensagem: 'E-mail enviado com sucesso!' });

  } catch (error) {
    console.error('❌ Erro ao enviar e-mail:', error);
    res.status(500).json({ sucesso: false, erro: error.toString() });
  }
});

// 4. Login do Barbeiro
app.post('/api/barbeiro/login', (req, res) => {
  const { email, senha } = req.body;
  const barbeiro = usuariosBarbeiros.find(u => u.email === email && u.senha === senha);

  if (!barbeiro) {
    return res.status(401).json({ sucesso: false, erro: 'E-mail ou senha incorretos.' });
  }

  res.status(200).json({
    sucesso: true,
    barbeiro: {
      id: barbeiro.id,
      nome: barbeiro.nome,
      email: barbeiro.email,
      primeiroAcesso: barbeiro.primeiroAcesso
    }
  });
});

// 5. Alteração de Senha Obrigatória
app.post('/api/barbeiro/alterar-senha', (req, res) => {
  const { idBarbeiro, novaSenha } = req.body;
  const barbeiro = usuariosBarbeiros.find(u => u.id === idBarbeiro);

  if (!barbeiro) {
    return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado.' });
  }

  if (!novaSenha || novaSenha.length < 6) {
    return res.status(400).json({ sucesso: false, erro: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }

  barbeiro.senha = novaSenha;
  barbeiro.primeiroAcesso = false;

  console.log(`✅ Senha alterada com sucesso para o barbeiro ID: ${idBarbeiro}`);
  res.status(200).json({ sucesso: true, mensagem: 'Senha alterada com sucesso!' });
});

// Porta do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando com sucesso na porta ${PORT}`);
});
