const express = require('express');
const mongoose = require('mongoose');
const { Resend } = require('resend');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

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

const configSiteSchema = new mongoose.Schema({
  key: { type: String, default: 'geral', unique: true },
  whats: { type: String, default: '5513999999999' },
  horarioTxt: { type: String, default: 'TER - SÁB | 08H - 19H' },
  endereco: { type: String, default: 'Rua Santo Antônio, 622 - Vila Caiçara - Praia Grande/SP' },
  foto1: { type: String, default: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400' },
  foto2: { type: String, default: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400' },
  foto3: { type: String, default: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=400' },
  foto4: { type: String, default: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400' }
}, { timestamps: true });

const Barbeiro = mongoose.model('Barbeiro', barbeiroSchema);
const Agendamento = mongoose.model('Agendamento', agendamentoSchema);
const ConfigSite = mongoose.model('ConfigSite', configSiteSchema);

// PING
app.get('/api/ping', (req, res) => {
  return res.status(200).json({ status: 'OK' });
});

// GET / PUT CONFIGURAÇÕES DO SITE NO MONGODB
app.get('/api/config-site', async (req, res) => {
  try {
    let config = await ConfigSite.findOne({ key: 'geral' });
    if (!config) {
      config = await ConfigSite.create({ key: 'geral' });
    }
    return res.status(200).json(config);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar configurações.' });
  }
});

app.put('/api/config-site', async (req, res) => {
  try {
    const dados = req.body || {};
    const config = await ConfigSite.findOneAndUpdate(
      { key: 'geral' },
      { $set: dados },
      { new: true, upsert: true }
    );
    return res.status(200).json({ sucesso: true, config });
  } catch (err) {
    console.error('Erro ao salvar config site:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro ao salvar no banco de dados.' });
  }
});

// ROTA DE RESET ADMIN DE EMERGÊNCIA
app.get('/api/reset-admin', async (req, res) => {
  try {
    await Barbeiro.deleteMany({ email: 'admin' });
    const adminNovo = await Barbeiro.create({
      nome: 'Administrador',
      email: 'admin',
      senha: '1234',
      foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      primeiroAcesso: false
    });
    return res.status(200).json({ sucesso: true, mensagem: 'Admin resetado com sucesso!', admin: adminNovo });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

// BARBEIROS
app.get('/api/barbeiros', async (req, res) => {
  try {
    const barbeiros = await Barbeiro.find({}, 'nome foto email primeiroAcesso');
    return res.status(200).json(barbeiros.map(b => ({
      id: b._id,
      nome: b.nome,
      email: b.email,
      foto: b.foto,
      primeiroAcesso: b.primeiroAcesso
    })));
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar barbeiros.' });
  }
});

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

    return res.status(200).json({ sucesso: true, barbeiro: { id: novoBarbeiro._id, nome: novoBarbeiro.nome, foto: novoBarbeiro.foto } });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao salvar barbeiro.' });
  }
});

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

app.delete('/api/barbeiros/:id', async (req, res) => {
  try {
    await Barbeiro.findByIdAndDelete(req.params.id);
    return res.status(200).json({ sucesso: true, mensagem: 'Removido.' });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao remover.' });
  }
});

// LOGIN
app.post('/api/barbeiro/login', async (req, res) => {
  try {
    const body = req.body || {};
    const entrada = (body.email || body.usuario || body.login || body.loginUser || body.user || '').toString().trim().toLowerCase();
    const senhaInput = (body.senha || body.loginPass || body.pass || '').toString().trim();

    if (!entrada || !senhaInput) {
      return res.status(400).json({ sucesso: false, erro: 'Preencha usuário e senha.' });
    }

    const barbeiros = await Barbeiro.find();
    let barbeiro = barbeiros.find(u => 
      (u.email.toLowerCase() === entrada || u.nome.toLowerCase() === entrada) &&
      u.senha === senhaInput
    );

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
    return res.status(500).json({ sucesso: false, erro: 'Erro interno no login.' });
  }
});

// ALTERAR SENHA
app.post('/api/barbeiro/alterar-senha', async (req, res) => {
  try {
    const { idBarbeiro, novaSenha } = req.body || {};
    if (!novaSenha || novaSenha.length < 4) {
      return res.status(400).json({ sucesso: false, erro: 'Mínimo 4 caracteres.' });
    }

    let barbeiro = null;
    if (idBarbeiro && mongoose.Types.ObjectId.isValid(idBarbeiro)) {
      barbeiro = await Barbeiro.findById(idBarbeiro);
    }

    if (!barbeiro) {
      barbeiro = await Barbeiro.findOne({
        $or: [{ email: 'admin' }, { nome: new RegExp('administrador', 'i') }]
      });
    }

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
    return res.status(200).json({ sucesso: true, mensagem: 'Senha alterada com sucesso!' });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao alterar senha.' });
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
