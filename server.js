const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');

const app = express();

// 1. CORS Simples e Efetivo
app.use(cors());

// 2. Middlewares de Parser (aumentado o limite para aceitar imagens em Base64)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Inicialização do Resend
const resend = new Resend(process.env.RESEND_API_KEY || 're_123456');

// Lista de barbeiros inicial
let usuariosBarbeiros = [
  {
    id: 1,
    nome: 'Rafael Santos',
    email: 'admin',
    senha: 'kurama01',
    foto: 'https://barbeariarafa.netlify.app/img/rafael.jpeg',
    primeiroAcesso: no
  }
];

let agendamentosGuardados = [];

// Rota de Ping / Health Check
app.get('/api/ping', (req, res) => {
  return res.status(200).json({ status: 'OK', mensagem: 'Servidor ativo' });
});

// Retorna a lista pública de barbeiros para o index.html e admin.html
app.get('/api/barbeiros', (req, res) => {
  const listaPublica = usuariosBarbeiros.map(b => ({
    id: b.id,
    nome: b.nome,
    foto: b.foto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
  }));
  return res.status(200).json(listaPublica);
});

// 🚀 NOVA ROTA: Adicionar Novo Barbeiro com Foto (upload em Base64)
app.post('/api/barbeiros', (req, res) => {
  try {
    const { nome, foto } = req.body || {};
    if (!nome) {
      return res.status(400).json({ sucesso: false, erro: 'Informe o nome do barbeiro.' });
    }

    const novoBarbeiro = {
      id: Date.now(),
      nome: nome.trim(),
      email: nome.toLowerCase().replace(/\s+/g, ''),
      senha: '1234',
      foto: foto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      primeiroAcesso: true
    };

    usuariosBarbeiros.push(novoBarbeiro);
    console.log(`✅ Novo barbeiro cadastrado: ${novoBarbeiro.nome}`);
    return res.status(200).json({ sucesso: true, barbeiro: novoBarbeiro });
  } catch (err) {
    console.error('❌ Erro ao adicionar barbeiro:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno no servidor.' });
  }
});

// 🚀 NOVA ROTA: Atualizar Foto ou Nome de Barbeiro Existente
app.put('/api/barbeiros/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nome, foto } = req.body || {};
    const barbeiro = usuariosBarbeiros.find(b => b.id === id);

    if (!barbeiro) {
      return res.status(404).json({ sucesso: false, erro: 'Barbeiro não encontrado.' });
    }

    if (nome) barbeiro.nome = nome.trim();
    if (foto) barbeiro.foto = foto;

    console.log(`✅ Barbeiro atualizado: ${barbeiro.nome}`);
    return res.status(200).json({ sucesso: true, barbeiro });
  } catch (err) {
    console.error('❌ Erro ao atualizar barbeiro:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno no servidor.' });
  }
});

// 🚀 NOVA ROTA: Remover Barbeiro
app.delete('/api/barbeiros/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    usuariosBarbeiros = usuariosBarbeiros.filter(b => b.id !== id);
    return res.status(200).json({ sucesso: true, mensagem: 'Barbeiro removido.' });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao remover barbeiro.' });
  }
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

  return res.status(200).json(ocupados);
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

    return res.status(200).json({ sucesso: true, mensagem: 'E-mail enviado com sucesso!' });
  } catch (error) {
    console.error('❌ Erro ao enviar e-mail:', error);
    return res.status(500).json({ sucesso: false, erro: error.toString() });
  }
});

// Rota de Login
app.post('/api/barbeiro/login', (req, res) => {
  try {
    const body = req.body || {};
    const email = body.email ? String(body.email).trim() : '';
    const senha = body.senha ? String(body.senha).trim() : '';

    if (!email || !senha) {
      return res.status(400).json({ sucesso: false, erro: 'Preencha usuário e senha.' });
    }

    const barbeiro = usuariosBarbeiros.find(u => 
      (u.email.toLowerCase() === email.toLowerCase() || u.nome.toLowerCase() === email.toLowerCase()) && 
      u.senha === senha
    );

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
    const barbeiro = usuariosBarbeiros.find(u => u.id === Number(idBarbeiro));

    if (!barbeiro) {
      return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado.' });
    }

    if (!novaSenha || novaSenha.length < 4) {
      return res.status(400).json({ sucesso: false, erro: 'A nova senha deve ter pelo menos 4 caracteres.' });
    }

    barbeiro.senha = String(novaSenha).trim();
    barbeiro.primeiroAcesso = false;

    return res.status(200).json({ sucesso: true, mensagem: 'Senha alterada com sucesso!' });
  } catch (err) {
    console.error('❌ Erro ao alterar senha:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno ao alterar senha.' });
  }
});

// Middleware para rotas inexistentes
app.use((req, res) => {
  return res.status(404).json({ erro: 'Rota não encontrada' });
});

// Porta do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
