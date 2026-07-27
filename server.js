const express = require('express');
const mongoose = require('mongoose');
const { Resend } = require('resend');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const resend = new Resend(process.env.RESEND_API_KEY || 're_123456');

// CONEXÃO MONGO
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.warn('⚠️ MONGO_URI não definida!');
} else {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('🍃 Conectado ao MongoDB Atlas com sucesso!'))
    .catch((err) => console.error('❌ Erro ao conectar ao MongoDB Atlas:', err));
}

// SCHEMAS
const barbeiroSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true, default: '1234' },
  foto: { type: String, default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
  primeiroAcesso: { type: Boolean, default: false }
}, { timestamps: true });

const agendamentoSchema = new mongoose.Schema({
  cliente: { type: String, required: true },
  email: { type: String },
  whats: { type: String },
  barbeiro: { type: String, required: true },
  servico: { type: String, required: true },
  preco: { type: Number, default: 0 },
  data: { type: String, required: true },
  hora: { type: String, required: true }
}, { timestamps: true });

const Barbeiro = mongoose.model('Barbeiro', barbeiroSchema);
const Agendamento = mongoose.model('Agendamento', agendamentoSchema);

// 🚨 ROTA DE EMERGÊNCIA: RESET DE ADMIN (Acesse via navegador se travar)
app.get('/api/reset-admin', async (req, res) => {
  try {
    // Remove qualquer admin antigo se existir e cria um limpo
    await Barbeiro.deleteMany({ email: 'admin' });
    
    const adminNovo = await Barbeiro.create({
      nome: 'Administrador',
      email: 'admin',
      senha: '1234',
      foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      primeiroAcesso: false
    });

    return res.status(200).json({ 
      sucesso: true, 
      mensagem: '✅ Usuário admin resetado com sucesso! Tente logar com admin / 1234',
      admin: adminNovo 
    });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

// PING
app.get('/api/ping', (req, res) => {
  return res.status(200).json({ status: 'OK' });
});

// LISTAR BARBEIROS
app.get('/api/barbeiros', async (req, res) => {
  try {
    const barbeiros = await Barbeiro.find({}, 'nome foto email primeiroAcesso');
    const listaFormatada = barbeiros.map(b => ({
      id: b._id,
      nome: b.nome,
      email: b.email,
      foto: b.foto,
      primeiroAcesso: b.primeiroAcesso
    }));
    return res.status(200).json(listaFormatada);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar barbeiros.' });
  }
});

// CADASTRAR BARBEIRO
app.post('/api/barbeiros', async (req, res) => {
  try {
    const { nome, foto } = req.body || {};
    if (!nome) return res.status(400).json({ sucesso: false, erro: 'Informe o nome.' });

    const emailGerado = nome.toLowerCase().trim().replace(/\s+/g, '');

    const novoBarbeiro = await Barbeiro.create({
      nome: nome.trim(),
      email: emailGerado,
      senha: '1234',
      foto: foto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      primeiroAcesso: true
    });

    return res.status(200).json({
      sucesso: true,
      barbeiro: { id: novoBarbeiro._id, nome: novoBarbeiro.nome, foto: novoBarbeiro.foto }
    });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao salvar barbeiro.' });
  }
});

// ATUALIZAR BARBEIRO
app.put('/api/barbeiros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, foto } = req.body || {};
    const atualizacao = {};
    if (nome) atualizacao.nome = nome.trim();
    if (foto) atualizacao.foto = foto;

    const barbeiroAtualizado = await Barbeiro.findByIdAndUpdate(id, atualizacao, { new: true });
    return res.status(200).json({ sucesso: true, barbeiro: barbeiroAtualizado });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar.' });
  }
});

// DELETAR BARBEIRO
app.delete('/api/barbeiros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Barbeiro.findByIdAndDelete(id);
    return res.status(200).json({ sucesso: true, mensagem: 'Removido.' });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao remover.' });
  }
});

// 🚀 ROTA DE LOGIN DEFINITIVA (RESPEITA A SENHA ALTERADA NO BANCO)
app.post('/api/barbeiro/login', async (req, res) => {
  try {
    const body = req.body || {};

    const entrada = (body.email || body.usuario || body.login || body.loginUser || body.user || '').toString().trim().toLowerCase();
    const senhaInput = (body.senha || body.loginPass || body.pass || '').toString().trim();

    if (!entrada || !senhaInput) {
      return res.status(400).json({ sucesso: false, erro: 'Preencha usuário e senha.' });
    }

    // 1. Consulta no MongoDB Atlas validando a entrada e a senha
    const barbeiros = await Barbeiro.find();
    let barbeiro = barbeiros.find(u => 
      (u.email.toLowerCase() === entrada || u.nome.toLowerCase() === entrada) &&
      u.senha === senhaInput
    );

    // 2. Se o admin ainda não foi cadastrado no banco e for a primeira tentativa com 1234
    if (!barbeiro && (entrada === 'admin' || entrada === 'administrador') && senhaInput === '1234') {
      const adminExistente = await Barbeiro.findOne({ email: 'admin' });
      if (!adminExistente) {
        barbeiro = await Barbeiro.create({
          nome: 'Administrador',
          email: 'admin',
          senha: '1234',
          foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          primeiroAcesso: false
        });
      }
    }

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
    console.error('❌ Erro no login:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno no login.' });
  }
});

// ALTERAR SENHA (ROBUSTA PARA ADMIN E BARBEIROS)
app.post('/api/barbeiro/alterar-senha', async (req, res) => {
  try {
    const { idBarbeiro, novaSenha } = req.body || {};
    
    if (!novaSenha || novaSenha.length < 4) {
      return res.status(400).json({ sucesso: false, erro: 'A senha deve ter no mínimo 4 caracteres.' });
    }

    let barbeiro = null;

    // 1. Se for um ID válido do MongoDB, busca por ID
    if (idBarbeiro && mongoose.Types.ObjectId.isValid(idBarbeiro)) {
      barbeiro = await Barbeiro.findById(idBarbeiro);
    }

    // 2. Se não encontrou por ID, busca pelo e-mail ou nome do admin
    if (!barbeiro) {
      barbeiro = await Barbeiro.findOne({
        $or: [
          { email: 'admin' },
          { nome: new RegExp('administrador', 'i') }
        ]
      });
    }

    // 3. Se o admin ainda não existia no MongoDB, cria com a nova senha
    if (!barbeiro) {
      barbeiro = new Barbeiro({
        nome: 'Administrador',
        email: 'admin',
        senha: String(novaSenha).trim(),
        foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        primeiroAcesso: false
      });
    } else {
      barbeiro.senha = String(novaSenha).trim();
      barbeiro.primeiroAcesso = false;
    }

    await barbeiro.save();
    console.log(`✅ Senha alterada com sucesso no MongoDB para o usuário: ${barbeiro.email}`);

    return res.status(200).json({ 
      sucesso: true, 
      mensagem: 'Senha alterada com sucesso!' 
    });
  } catch (err) {
    console.error('❌ Erro ao alterar senha:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno ao alterar senha.' });
  }
});

// AGENDAMENTOS
app.get('/api/horarios-ocupados', async (req, res) => {
  const { data, barbeiro } = req.query;
  if (!data || !barbeiro) return res.status(200).json([]);
  const agendamentos = await Agendamento.find({ data, barbeiro });
  return res.status(200).json(agendamentos.map(a => a.hora));
});

app.post('/api/enviar-email-confirmacao', async (req, res) => {
  const { nome, email, barbeiro, servico, preco, data, hora, whats } = req.body || {};
  try {
    await Agendamento.create({ cliente: nome, email, whats, barbeiro, servico, preco: parseFloat(preco || 0), data, hora });
    return res.status(200).json({ sucesso: true });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: err.toString() });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor na porta ${PORT}`));
