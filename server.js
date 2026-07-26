const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Inicializa a API do Resend lendo da variável de ambiente no Render (ou insira sua chave entre aspas se preferir)
const resend = new Resend(process.env.RESEND_API_KEY);

// Armazenamento em memória dos agendamentos
// Nota: Para salvar de forma permanente quando o servidor reiniciar no Render, o recomendado é usar um banco de dados (ex: Supabase / PostgreSQL).
let agendamentos = [];

// Rota de Health Check / Ping para manter o Render ativo
app.get('/api/ping', (req, res) => {
  res.status(200).send('OK');
});

// 📌 1. ROTA PARA CONSULTAR HORÁRIOS OCUPADOS
// O front-end chama este endpoint ao escolher Data e Barbeiro
app.get('/api/horarios-ocupados', (req, res) => {
  const { data, barbeiro } = req.query;

  if (!data || !barbeiro) {
    return res.status(400).json({ erro: 'Data e Barbeiro são obrigatórios.' });
  }

  // Filtra e retorna apenas as horas que já foram reservadas
  const ocupados = agendamentos
    .filter(a => a.data === data && a.barbeiro === barbeiro)
    .map(a => a.hora);

  res.status(200).json(ocupados);
});

// 📌 2. ROTA DE AGENDAMENTO E ENVIO DE E-MAIL
app.post('/api/enviar-email-confirmacao', async (req, res) => {
  const { nome, email, barbeiro, servico, preco, data, hora } = req.body;

  if (!nome || !email || !barbeiro || !servico || !data || !hora) {
    return res.status(400).json({ sucesso: false, erro: 'Preencha todos os campos do agendamento.' });
  }

  // Trava de segurança: impede que dois clientes agendem exatamente o mesmo horário
  const jaAgendado = agendamentos.some(
    a => a.data === data && a.barbeiro === barbeiro && a.hora === hora
  );

  if (jaAgendado) {
    return res.status(400).json({
      sucesso: false,
      erro: 'Este horário acabou de ser reservado por outro cliente. Por favor, escolha outro horário.'
    });
  }

  // Registra o agendamento no sistema
  const novoAgendamento = { nome, email, barbeiro, servico, preco, data, hora, criadoEm: new Date() };
  agendamentos.push(novoAgendamento);

  const dataFormatada = data.split('-').reverse().join('/');

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

    console.log(`✅ Agendamento realizado com sucesso para ${nome} (${email}) às ${hora}hs.`);
    res.status(200).json({ sucesso: true, mensagem: 'Agendamento e e-mail confirmados!' });

  } catch (error) {
    console.error('❌ Erro ao enviar e-mail via Resend:', error);
    // Mesmo se o e-mail falhar, o agendamento permanece salvo
    res.status(500).json({
      sucesso: false,
      erro: 'Agendamento salvo, mas houve uma falha ao enviar o e-mail de confirmação.'
    });
  }
});

// Configuração da porta com bind da rede do Render ('0.0.0.0')
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor da Barbearia Rafael rodando na porta ${PORT}`);
});
