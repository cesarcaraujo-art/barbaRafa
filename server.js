const express = require('express');
const mongoose = require('mongoose');
const { Resend } = require('resend');
const cors = require('cors');

const app = express();

// 1. CORS Simples e Efetivo
app.use(cors());

// 2. Middlewares de Parser (suporte a upload de imagens via base64 se necessário)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Inicialização do Resend
const resend = new Resend(process.env.RESEND_API_KEY || 're_123456');

// 3. CONEXÃO COM O MONGODB ATLAS (Defina a variável AQUI)
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.warn('⚠️ MONGO_URI não definida! Verifique as variáveis de ambiente no Render.');
} else {
  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log('🍃 Conectado ao MongoDB Atlas com sucesso!');
    })
    .catch((err) => {
      console.error('❌ Erro ao conectar ao MongoDB Atlas:', err);
    });
}

// 4. SCHEMAS E MODELOS DO MONGOOSE
const barbeiroSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true, default: '1234' },
  foto: { type: String, default: 'https://barbeariarafa.netlify.app/img/rafael.jpg' },
  primeiroAcesso: { type: Boolean, default: true }
}, { timestamps: true });

const agendamentoSchema = new mongoose.Schema({
  cliente: { type: String, required: true },
  email: { type: String },
  whats: { type: String },
  barbeiro: { type: String, required: true },
  servico: { type: String, required: true },
  preco: { type: Number, default: 0 },
  data: { type: String, required: true }, // Formato: YYYY-MM-DD
  hora: { type: String, required: true }  // Formato: HH:MM
}, { timestamps: true });

const Barbeiro = mongoose.model('Barbeiro', barbeiroSchema);
const Agendamento = mongoose.model('Agendamento', agendamentoSchema);

// Criar o admin inicial caso a coleção esteja vazia
async function inicializarBarbeiroPadrao() {
  try {
    const total = await Barbeiro.countDocuments();
    if (total === 0) {
      await Barbeiro.create({
        nome: 'Administrador',
        email: 'admin',
        senha: '1234',
        foto: 'https://barbeariarafa.netlify.app/img/rafael.jpg',
        primeiroAcesso: false
      });
      console.log('👤 Barbeiro admin inicial criado com sucesso no MongoDB!');
    }
  } catch (err) {
    console.error('Erro ao verificar/criar barbeiro padrão:', err);
  }
}

// 5. ROTAS DA API

// Health Check / Ping
app.get('/api/ping', (req, res) => {
  return res.status(200).json({ status: 'OK', mensagem: 'Servidor e Banco de Dados ativos' });
});

// ROTA GET: Busca os barbeiros cadastrados no MongoDB
app.get('/api/barbeiros', async (req, res) => {
  try {
    const barbeiros = await Barbeiro.find({});
    
    // Converte os documentos do Mongo para o formato que a tela espera (_id do Mongo como id)
    const listaFormatada = barbeiros.map(b => ({
      id: b._id,
      nome: b.nome,
      foto: b.foto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
    }));

    return res.status(200).json(listaFormatada);
  } catch (err) {
    console.error('❌ Erro ao buscar barbeiros:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro ao buscar barbeiros do banco.' });
  }
});

// Cadastrar novo Barbeiro
app.post('/api/barbeiros', async (req, res) => {
  try {
    const { nome, foto } = req.body || {};
    if (!nome) {
      return res.status(400).json({ sucesso: false, erro: 'Informe o nome do barbeiro.' });
    }

    const emailGerado = nome.toLowerCase().trim().replace(/\s+/g, '');

    const novoBarbeiro = await Barbeiro.create({
      nome: nome.trim(),
      email: emailGerado,
      senha: '1234',
      foto: foto || 'https://barbeariarafa.netlify.app/img/rafael.jpg',
      primeiroAcesso: true
    });

    return res.status(200).json({
      sucesso: true,
      barbeiro: {
        id: novoBarbeiro._id,
        nome: novoBarbeiro.nome,
        foto: novoBarbeiro.foto
      }
    });
  } catch (err) {
    console.error('❌ Erro ao cadastrar barbeiro:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro ao salvar barbeiro no banco de dados.' });
  }
});

// Atualizar Barbeiro (Nome e/ou Foto)
app.put('/api/barbeiros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, foto } = req.body || {};

    const atualizacao = {};
    if (nome) atualizacao.nome = nome.trim();
    if (foto) atualizacao.foto = foto;

    const barbeiroAtualizado = await Barbeiro.findByIdAndUpdate(id, atualizacao, { new: true });

    if (!barbeiroAtualizado) {
      return res.status(404).json({ sucesso: false, erro: 'Barbeiro não encontrado.' });
    }

    return res.status(200).json({ sucesso: true, barbeiro: barbeiroAtualizado });
  } catch (err) {
    console.error('❌ Erro ao atualizar barbeiro:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno ao atualizar barbeiro.' });
  }
});

// 🚀 ROTA DE REMOÇÃO ULTRA-FLEXÍVEL (Substitua no server.js)
app.delete('/api/barbeiros/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let deletado = null;

    // 1. Tenta deletar se for um ObjectId válido do Mongo
    if (mongoose.Types.ObjectId.isValid(id)) {
      deletado = await Barbeiro.findByIdAndDelete(id);
    }

    // 2. Se não deletou (ex: mandaram id "1" ou "admin"), busca pelo e-mail ou nome
    if (!deletado) {
      deletado = await Barbeiro.findOneAndDelete({
        $or: [
          { email: 'admin' },
          { nome: new RegExp('administrador', 'i') }
        ]
      });
    }

    return res.status(200).json({ 
      sucesso: true, 
      mensagem: 'Barbeiro removido com sucesso do banco de dados.' 
    });
  } catch (err) {
    console.error('❌ Erro ao remover barbeiro:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno ao remover do banco.' });
  }
});

// Rota de Login do Barbeiro
app.post('/api/barbeiro/login', async (req, res) => {
  try {
    const body = req.body || {};
    const email = body.email ? String(body.email).trim() : '';
    const senha = body.senha ? String(body.senha).trim() : '';

    if (!email || !senha) {
      return res.status(400).json({ sucesso: false, erro: 'Preencha usuário e senha.' });
    }

    // Busca por e-mail ou nome
    const barbeiro = await Barbeiro.findOne({
      $or: [
        { email: new RegExp(`^${email}$`, 'i') },
        { nome: new RegExp(`^${email}$`, 'i') }
      ],
      senha: senha
    });

    if (!barbeiro) {
      return res.status(401).json({ sucesso: false, erro: 'Usuário ou senha incorretos.' });
    }

    return res.status(200).json({
      sucesso: true,
      barbeiro: {
        id: barbeiro._id,
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
app.post('/api/barbeiro/alterar-senha', async (req, res) => {
  try {
    const { idBarbeiro, novaSenha } = req.body || {};

    if (!novaSenha || novaSenha.length < 4) {
      return res.status(400).json({ sucesso: false, erro: 'A nova senha deve ter pelo menos 4 caracteres.' });
    }

    const barbeiro = await Barbeiro.findById(idBarbeiro);

    if (!barbeiro) {
      return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado.' });
    }

    barbeiro.senha = String(novaSenha).trim();
    barbeiro.primeiroAcesso = false;
    await barbeiro.save();

    return res.status(200).json({ sucesso: true, mensagem: 'Senha alterada com sucesso!' });
  } catch (err) {
    console.error('❌ Erro ao alterar senha:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno ao alterar senha.' });
  }
});

// Consulta de Horários Ocupados
app.get('/api/horarios-ocupados', async (req, res) => {
  try {
    const { data, barbeiro } = req.query;

    if (!data || !barbeiro) {
      return res.status(200).json([]);
    }

    const agendamentos = await Agendamento.find({ data, barbeiro });
    const ocupados = agendamentos.map(a => a.hora);

    return res.status(200).json(ocupados);
  } catch (err) {
    console.error('❌ Erro ao consultar horários ocupados:', err);
    return res.status(500).json([]);
  }
});

// Envio de E-mail de Confirmação e Salvamento do Agendamento
app.post('/api/enviar-email-confirmacao', async (req, res) => {
  const { nome, email, barbeiro, servico, preco, data, hora, whats } = req.body || {};
  const dataFormatada = data ? data.split('-').reverse().join('/') : '';

  try {
    // Salva o agendamento no MongoDB Atlas
    await Agendamento.create({
      cliente: nome,
      email,
      whats,
      barbeiro,
      servico,
      preco: parseFloat(preco || 0),
      data,
      hora
    });

    // Tenta enviar o e-mail de confirmação via Resend
    if (email) {
      await resend.emails.send({
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
    }

    return res.status(200).json({ sucesso: true, mensagem: 'Agendamento salvo e e-mail enviado!' });
  } catch (error) {
    console.error('❌ Erro no agendamento/e-mail:', error);
    return res.status(500).json({ sucesso: false, erro: error.toString() });
  }
});

// Middleware para rotas não encontradas (404)
app.use((req, res) => {
  return res.status(404).json({ erro: 'Rota não encontrada' });
});

// Porta do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
