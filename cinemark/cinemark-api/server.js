require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
// Teste de conexão imediato
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Erro de conexão no MySQL:', err.message);
    console.log('Verifique se sua senha no .env está correta!');
  } else {
    console.log('✅ Conexão com o MySQL estabelecida com sucesso!');
    connection.release();
  }
});

// Rota para listar todos os filmes
app.get('/filmes', (req, res) => {
  db.query('SELECT * FROM filmes', (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// Rota para buscar os 75 assentos de uma sala específica e ver quem ocupou
app.get('/assentos/sala/:id', (req, res) => {
  const { id } = req.params;
  const { sessao_id } = req.query; // Passamos o ID da sessão via query string

  const query = `
    SELECT 
        a.id, a.fileira, a.numero,
        CASE 
            WHEN i.id IS NOT NULL THEN 'ocupado'
            ELSE 'disponivel'
        END AS status_visual
    FROM assentos a
    LEFT JOIN ingressos i ON a.id = i.assento_id AND i.sessao_id = ?
    WHERE a.sala_id = ?
    ORDER BY a.fileira DESC, a.numero ASC;
  `;

  db.query(query, [sessao_id, id], (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

app.listen(process.env.PORT, () => {
  console.log(`Servidor rodando em http://localhost:${process.env.PORT}`);
});

