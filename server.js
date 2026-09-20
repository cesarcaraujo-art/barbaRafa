const express = require('express');
const mongoose = require('mongoose');
const { Resend } = require('resend');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const resend = new Resend(process.env.RESEND_API_KEY || 're_123456');

const MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('🍃 Conectado ao MongoDB Atlas com sucesso!'))
    .catch((err) => console.error('❌ Erro ao conectar ao MongoDB Atlas:', err));
}

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
  fotoShareWhatsapp: { type: String, default: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800' },
  enquadramentoWhatsapp: { type: String, default: 'cover-center' },
  foto1: { type: String, default: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400' },
  foto2: { type: String, default: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400' },
  foto3: { type: String, default: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=400' },
  foto4: { type: String, default: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400' },
  diasPorBarbeiro: { type: Object, default: {} },
  horariosPorBarbeiro: { type: Object, default: {} },
  servicosPorBarbeiro: { type: Object, default: {} }
}, { timestamps: true });

const Barbeiro = mongoose.model('Barbeiro', barbeiroSchema);
const Agendamento = mongoose.model('Agendamento', agendamentoSchema);
const ConfigSite = mongoose.model('ConfigSite', configSiteSchema);

app.get('/api/ping', (req, res) => res.status(200).json({ status: 'OK' }));

app.get('/api/config-site', async (req, res) => {
  try {
    let config = await ConfigSite.findOne({ key: 'geral' });
    if (!config) config = await ConfigSite.create({ key: 'geral' });
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
    return res.status(500).json({ sucesso: false, erro: 'Erro ao salvar no banco.' });
  }
});

app.get('/api/barbeiros', async (req, res) => {
  try {
    const barbeiros = await Barbeiro.find({ email: { $ne: 'admin' } }, 'nome foto email primeiroAcesso');
    return res.status(200).json(barbeiros.map(b => ({
      id: b._id, nome: b.nome, email: b.email, foto: b.foto, primeiroAcesso: b.primeiroAcesso
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
      nome: nome.trim(), email: emailGerado, senha: '1234',
      foto: foto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', primeiroAcesso: true
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

app.post('/api/barbeiro/login', async (req, res) => {
  try {
    const body = req.body || {};
    const entrada = (body.email || body.usuario || body.login || '').toString().trim().toLowerCase();
    const senhaInput = (body.senha || body.pass || '').toString().trim();
    if (!entrada || !senhaInput) return res.status(400).json({ sucesso: false, erro: 'Preencha usuário e senha.' });

    let barbeiro = await Barbeiro.findOne({
      $or: [{ email: entrada }, { nome: new RegExp(`^${entrada}$`, 'i') }],
      senha: senhaInput
    });

    if (!barbeiro && (entrada === 'admin' || entrada === 'administrador')) {
      let adminExistente = await Barbeiro.findOne({ email: 'admin' });
      if (!adminExistente) {
        adminExistente = await Barbeiro.create({
          nome: 'Administrador', email: 'admin', senha: senhaInput,
          foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', primeiroAcesso: false
        });
        barbeiro = adminExistente;
      } else if (adminExistente.senha === senhaInput) {
        barbeiro = adminExistente;
      }
    }

    if (!barbeiro) return res.status(401).json({ sucesso: false, erro: 'Usuário ou senha incorretos.' });

    return res.status(200).json({
      sucesso: true,
      barbeiro: { id: barbeiro._id, nome: barbeiro.nome, email: barbeiro.email, primeiroAcesso: barbeiro.primeiroAcesso }
    });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro interno no login.' });
  }
});

app.post('/api/barbeiro/alterar-senha', async (req, res) => {
  try {
    const { idBarbeiro, novaSenha } = req.body || {};
    if (!novaSenha || novaSenha.length < 4) return res.status(400).json({ sucesso: false, erro: 'Senha curta.' });
    let barbeiro = null;
    if (idBarbeiro && mongoose.Types.ObjectId.isValid(idBarbeiro)) barbeiro = await Barbeiro.findById(idBarbeiro);
    if (!barbeiro) barbeiro = await Barbeiro.findOne({ email: 'admin' });

    if (!barbeiro) {
      await Barbeiro.create({
        nome: 'Administrador', email: 'admin', senha: String(novaSenha).trim(),
        foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', primeiroAcesso: false
      });
    } else {
      barbeiro.senha = String(novaSenha).trim();
      barbeiro.primeiroAcesso = false;
      await barbeiro.save();
    }
    return res.status(200).json({ sucesso: true, mensagem: 'Senha alterada!' });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao alterar senha.' });
  }
});

app.get('/api/agendamentos', async (req, res) => {
  try {
    const agendamentos = await Agendamento.find().sort({ createdAt: -1 });
    return res.status(200).json(agendamentos.map(a => ({
      id: a._id, cliente: a.cliente, email: a.email, whats: a.whats,
      barbeiro: a.barbeiro, servico: a.servico, preco: a.preco, data: a.data, hora: a.hora
    })));
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar agendamentos.' });
  }
});

app.delete('/api/agendamentos/:id', async (req, res) => {
  try {
    await Agendamento.findByIdAndDelete(req.params.id);
    return res.status(200).json({ sucesso: true, mensagem: 'Removido.' });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao remover.' });
  }
});

app.get('/api/horarios-ocupados', async (req, res) => {
  const { data, barbeiro } = req.query;
  if (!data || !barbeiro) return res.status(200).json([]);
  const agendamentos = await Agendamento.find({ data, barbeiro });
  return res.status(200).json(agendamentos.map(a => a.hora));
});

// ROTA DE AGENDAMENTO COM SUPORTE A CHAVE EM BASE64
app.post('/api/enviar-email-confirmacao', async (req, res) => {
  const { nome, email, barbeiro, servico, preco, data, hora, whats } = req.body || {};

  try {
    const novoAgendamento = await Agendamento.create({
      cliente: nome, email, whats, barbeiro, servico,
      preco: parseFloat(preco || 0), data, hora
    });

    const dataFormatada = data ? data.split('-').reverse().join('/') : data;
    const precoFormatado = parseFloat(preco || 0).toFixed(2).replace('.', ',');

    // 1. ADICIONAR AUTOMATICAMENTE NA GOOGLE AGENDA
    if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      try {
        let privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

        const auth = new google.auth.JWT(
          process.env.GOOGLE_CLIENT_EMAIL,
          null,
          privateKey,
          ['https://www.googleapis.com/auth/calendar']
        );

        const calendar = google.calendar({ version: 'v3', auth });

        const [ano, mes, dia] = data.split('-');
        const [horaStr, minStr] = hora.split(':');
        const dataInicioIso = `${ano}-${mes}-${dia}T${horaStr}:${minStr}:00-03:00`;
        
        const horaFimNum = parseInt(horaStr) + 1;
        const horaFimStr = (horaFimNum < 10 ? '0' : '') + horaFimNum + ':' + minStr;
        const dataFimIso = `${ano}-${mes}-${dia}T${horaFimStr}:00-03:00`;

        await calendar.events.insert({
          calendarId: 'barbarafa100@gmail.com',
          resource: {
            summary: `✂️ ${servico} - ${nome} (${barbeiro})`,
            description: `Cliente: ${nome}\nWhatsApp: ${whats}\nServiço: ${servico}\nProfissional: ${barbeiro}\nValor: R$ ${precoFormatado}`,
            location: 'Rua Santo Antônio, 622 - Vila Caiçara - Praia Grande/SP',
            start: { dateTime: dataInicioIso },
            end: { dateTime: dataFimIso },
          },
        });
        console.log('✅ Evento inserido automaticamente na Google Agenda com sucesso!');
      } catch (calErr) {
        console.error('⚠️ Erro ao inserir na Google Agenda via API:', calErr.message);
      }
    }

    // 2. ENVIAR E-MAIL PARA O CLIENTE
    if (email) {
      await resend.emails.send({
        from: 'Barbearia Rafael <onboarding@resend.dev>',
        to: [email],
        subject: '✂️ Confirmação de Agendamento - Barbearia Rafael',
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #121212; color: #ffffff; padding: 20px; border-radius: 8px;">
            <h2 style="color: #e0a96d; text-align: center;">Olá, ${nome}!</h2>
            <p style="font-size: 1rem; text-align: center;">Seu agendamento foi realizado com sucesso.</p>
            
            <div style="background-color: #1e1e1e; padding: 15px; border-radius: 6px; border-left: 4px solid #e0a96d; margin: 20px 0;">
              <p style="margin: 5px 0;">💈 <b>Profissional:</b> ${barbeiro}</p>
              <p style="margin: 5px 0;">✂️ <b>Serviço:</b> ${servico} (R$ ${precoFormatado})</p>
              <p style="margin: 5px 0;">📅 <b>Data:</b> ${dataFormatada}</p>
              <p style="margin: 5px 0;">⏰ <b>Horário:</b> ${hora} hs</p>
            </div>
          </div>
        `
      });
    }

    return res.status(200).json({ sucesso: true, agendamento: novoAgendamento });
  } catch (err) {
    console.error('❌ Erro no agendamento/e-mail:', err);
    return res.status(200).json({ sucesso: true });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor na porta ${PORT}`));
