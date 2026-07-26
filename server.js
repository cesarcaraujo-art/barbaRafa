const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Rota de checagem para acordar o servidor no Render (Ping)
app.get('/api/ping', (req, res) => {
  res.status(200).send('OK');
});

// Configuração otimizada para nuvem (Render + Gmail)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Usa STARTTLS na porta 587
  requireTLS: true,
  family: 4, // 👈 FORÇA O USO DE IPV4 (Resolve o erro ENETUNREACH)
  auth: {
    user: 'cesar.caraujo@gmail.com',
    pass: 'zitm dnvs taqk qrta' // Insira sua Senha de App do Google (16 caracteres)
  },
  connectionTimeout: 20000, // 20 segundos de timeout para evitar desconexão no Render
  greetingTimeout: 20000,
  socketTimeout: 20000
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
          <h2 style="color: #e0a96d; text-align: center;">Agendamento Confirmado!</h2>
          <p>Olá, <strong>${nome}</strong>!</p>
          <p>Seu horário na barbearia foi reservado com sucesso. Confira os detalhes abaixo:</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;">
          
          <p><strong>💈 Barbeiro:</strong> ${barbeiro}</p>
          <p><strong>✂️ Serviço:</strong> ${servico} (R$ ${parseFloat(preco || 0).toFixed(2).replace('.', ',')})</p>
          <p><strong>📅 Data:</strong> ${dataFormatada}</p>
          <p><strong>🕒 Horário:</strong> ${hora}hs</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;">
          
          <p style="font-size: 0.85rem; color: #777; text-align: center;">
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