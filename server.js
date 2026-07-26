const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const dns = require('dns');

// Força o Node.js a utilizar preferencialmente IPv4 no DNS (evita ENETUNREACH)
dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(express.json());
app.use(cors());

// Rota de Health Check
app.get('/api/ping', (req, res) => {
  res.status(200).send('OK');
});

// Configuração do Nodemailer usando a porta 465 com SSL
const transporter = nodemailer.createTransport({
  host: '142.250.141.108',
  port: 465,
  secure: true, // Força conexão SSL (Obrigatório na porta 465)
  auth: {
    user: 'cesar.caraujo@gmail.com',
    pass: 'zitm dnvs taqk qrta' // Pega a Senha de App configurada no Render
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 15000
});

// Endpoint de Envio de E-mail
app.post('/api/enviar-email-confirmacao', async (req, res) => {
  const { nome, email, barbeiro, servico, preco, data, hora } = req.body;
  const dataFormatada = data ? data.split('-').reverse().join('/') : '';

  const mailOptions = {
    from: '"Barbearia Estilo & Corte" <cesar.caraujo@gmail.com>',
    to: email,
    subject: '✂️ Confirmação do seu Agendamento - Barbearia',
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; color: #333;">
        <div style="max-width: 500px; background: #ffffff; padding: 25px; border-radius: 8px; margin: 0 auto; border-top: 4px solid #e0a96d;">
          <h2 style="color: #e0a96d; text-align: center; margin-top: 0;">Agendamento Confirmado!</h2>
          <p>Olá, <strong>${nome}</strong>!</p>
          <p>Seu horário na barbearia foi reservado com sucesso. Confira os detalhes abaixo:</p>
          
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
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ E-mail enviado com sucesso para: ${email}`);
    res.status(200).json({ sucesso: true, mensagem: 'E-mail enviado com sucesso!' });
  } catch (error) {
    console.error('❌ Erro ao enviar e-mail:', error);
    res.status(500).json({ sucesso: false, erro: error.toString() });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
