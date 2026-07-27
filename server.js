// CONEXÃO COM O MONGODB ATLAS
if (!MONGO_URI) {
  console.warn('⚠️ MONGO_URI não definida!');
} else {
  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log('🍃 Conectado ao MongoDB Atlas com sucesso!');
      // ⚠️ COMENTADO para não criar o "Administrador" automaticamente nunca mais:
      // inicializarBarbeiroPadrao();
    })
    .catch((err) => {
      console.error('❌ Erro ao conectar ao MongoDB Atlas:', err);
    });
}

// ROTA DE REMOVER BARBEIRO (Libeira a exclusão de qualquer ID)
app.delete('/api/barbeiros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Deleta diretamente do MongoDB pelo ID
    const deletado = await Barbeiro.findByIdAndDelete(id);

    if (!deletado) {
      return res.status(404).json({ sucesso: false, erro: 'Barbeiro não encontrado.' });
    }

    return res.status(200).json({ sucesso: true, mensagem: 'Barbeiro removido com sucesso.' });
  } catch (err) {
    console.error('❌ Erro ao remover barbeiro:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro ao remover barbeiro do banco.' });
  }
});
