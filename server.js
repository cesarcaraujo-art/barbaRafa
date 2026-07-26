const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');

const app = express();

// 1. Configuração completa do CORS
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200
};

// Aplica o CORS para todas as rotas
app.use(cors(corsOptions));

// 2. Responde imediatamente às requisições Preflight (OPTIONS)
app.options('*', cors(corsOptions));

// Parsers para JSON e formulários
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicialização do Resend
const resend = new Resend(process.env.RESEND_API_KEY || 're_123456');

// Usuário admin inicial
let usuariosBarbeiros = [
  {
    id: 1,
    nome: 'Administrador',
    email: 'admin',
    senha: '1234',
    primeiroAcesso: true
  }
];

let agendamentosGuardados = [];

// Rota de Ping / Health Check
app.get('/api/ping', (req, res) => {
  res.status(200).json({ status: 'OK', mensagem: 'Servidor ativo' });
});

// Consulta de Horários Ocupados
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

// Envio de E-mail de Confirmação
app.post('/api/enviar-email-confirmacao', async (req, res) => {
  const { nome, email, barbeiro, servico, preco, data, hora } = req.body || {};
  const dataFormatada = data ? data.split('-').reverse().join('/') : '';

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
            <p>Seu horário na <strong>Barbearia Rafael</strong> foi reservado com sucesso.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;">
            <p><strong>💈 Barbeiro:</strong> ${barbeiro}</p>
            <p><strong>✂️ Serviço:</strong> ${servico} (R$ ${parseFloat(preco || 0).toFixed(2).replace('.', ',')})</p>
            <p><strong>📅 Data:</strong> ${dataFormatada}</p>
            <p><strong>🕒 Horário:</strong> ${hora}hs</p>
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

// Rota de Login
app.post('/api/barbeiro/login', (req, res) => {
  try {
    const { email, senha } = req.body || {};

    if (!email || !senha) {
      return res.status(400).json({ sucesso: false, erro: 'Preencha usuário e senha.' });
    }

    const barbeiro = usuariosBarbeiros.find(u => (u.email === email || u.nome === email) && u.senha === senha);

    if (!barbeiro) {
      return res.status(401).json({ sucesso: false, erro: 'Usuário ou senha incorretos.' });
    }

    return res.status(200).json({
      sucesso: true,
      barbeiro: {
        id: barbeiro.id,
        nome: barbeiro.nome,
        email: barbeiro.email,
        primeiroAcesso: barbeiro.primeiroAcesso
      }
    });
  } catch (err) {
    console.error('❌ Erro na rota de login:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno no servidor.' });
  }
});

// Rota de Alteração de Senha
app.post('/api/barbeiro/alterar-senha', (req, res) => {
  try {
    const { idBarbeiro, novaSenha } = req.body || {};
    const barbeiro = usuariosBarbeiros.find(u => u.id === idBarbeiro);

    if (!barbeiro) {
      return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado.' });
    }

    if (!novaSenha || novaSenha.length < 4) {
      return res.status(400).json({ sucesso: false, erro: 'A nova senha deve ter pelo menos 4 caracteres.' });
    }

    barbeiro.senha = novaSenha;
    barbeiro.primeiroAcesso = false;

    console.log(`✅ Senha alterada com sucesso para o usuário: ${barbeiro.nome}`);
    return res.status(200).json({ sucesso: true, mensagem: 'Senha alterada com sucesso!' });
  } catch (err) {
    console.error('❌ Erro ao alterar senha:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno ao alterar senha.' });
  }
});

// Middleware para rotas inexistentes
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// Porta do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
