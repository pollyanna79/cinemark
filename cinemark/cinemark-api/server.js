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
  port: process.env.DB_PORT || 38601,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
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

// Rota para listar todos os filmes com a primeira sessão disponível
app.get('/filmes', (req, res) => {
  const query = `
    SELECT
      f.id,
      f.titulo,
      f.capa_url,
      f.estreia,
      s.id AS sessao_id,
      s.sala_id,
      sa.nome AS sala_nome,
      s.dia,
      s.horario_inicio
    FROM filmes f
    LEFT JOIN sessoes s ON s.id = (
      SELECT id FROM sessoes WHERE filme_id = f.id ORDER BY dia ASC, horario_inicio ASC LIMIT 1
    )
    LEFT JOIN salas sa ON sa.id = s.sala_id
    ORDER BY f.id;
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// Rota para buscar dados de uma sessão específica
app.get('/sessoes/:id', (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT
      s.id AS sessao_id,
      s.filme_id,
      s.sala_id,
      sa.nome AS sala_nome,
      s.dia,
      s.horario_inicio
    FROM sessoes s
    JOIN salas sa ON sa.id = s.sala_id
    WHERE s.id = ?
  `;

  db.query(query, [id], (err, results) => {
    if (err) return res.status(500).json(err);
    if (results.length === 0) return res.status(404).json({ error: 'Sessão não encontrada.' });
    res.json(results[0]);
  });
});



// Rota para buscar a primeira sessão de um filme
app.get('/filmes/:id/sessao', (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT
      s.id AS sessao_id,
      s.filme_id,
      f.titulo AS filme_titulo,
      s.sala_id,
      sa.nome AS sala_nome,
      s.dia,
      s.horario_inicio
    FROM sessoes s
    JOIN salas sa ON sa.id = s.sala_id
    JOIN filmes f ON f.id = s.filme_id
    WHERE s.filme_id = ?
    ORDER BY s.dia ASC, s.horario_inicio ASC
    LIMIT 1;
  `;

  db.query(query, [id], (err, results) => {
    if (err) return res.status(500).json(err);
    if (results.length === 0) return res.status(404).json({ error: 'Sessão não encontrada para este filme.' });
    res.json(results[0]);
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

app.post('/reservar', (req, res) => {
  const { nome, email, telefone, meio_pagamento, sessao_id, sala_id, assento_ids } = req.body;

  if (!nome || !email || !telefone || !meio_pagamento || !sessao_id || !sala_id || !Array.isArray(assento_ids) || assento_ids.length === 0){
    return res.status(400).json({ error: 'Preencha todos os campos e selecione pelo menos um assento.' });
  }
  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Erro interno ao conectar ao banco de dados.' });

    connection.beginTransaction((txErr) => {
      if (txErr) {
        connection.release();
        return res.status(500).json({ error: 'Erro interno ao iniciar transação.' });
      }

      const findCliente = 'SELECT id_cliente FROM registro_clientes WHERE email = ? LIMIT 1';
      connection.query(findCliente, [email], (findErr, findResult) => {
        if (findErr) {
          return connection.rollback(() => {
            connection.release();
            res.status(500).json({ error: 'Erro ao buscar cliente.' });
          });
        }

        const insertIngressos = (clienteId) => {
          const checkQuery = `
            SELECT assento_id
            FROM ingressos
            WHERE sessao_id = ?
              AND assento_id IN (?);
          `;

          connection.query(checkQuery, [sessao_id, assento_ids], (checkErr, occupiedSeats) => {
            if (checkErr) {
              return connection.rollback(() => {
                connection.release();
                res.status(500).json({ error: 'Erro ao verificar disponibilidade dos assentos.' });
              });
            }

            if (occupiedSeats.length > 0) {
              return connection.rollback(() => {
                connection.release();
                res.status(409).json({ error: 'Um ou mais assentos já estão ocupados. Atualize a página e escolha outros assentos.' });
              });
            }

            const now = new Date();
            const ingressosValues = assento_ids.map((assentoId) => [sessao_id, assentoId, clienteId, now, 'Aguardando aprovação', clienteId]);
            const insertQuery = 'INSERT INTO ingressos (sessao_id, assento_id, usuario_id, data_compra, status, id_cliente) VALUES ?';

            connection.query(insertQuery, [ingressosValues], (ingressoErr) => {
              if (ingressoErr) {
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).json({ error: 'Erro ao gravar ingressos.' });
                });
              }

              connection.commit((commitErr) => {
                if (commitErr) {
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).json({ error: 'Erro ao confirmar reserva.' });
                  });
                }

                connection.release();
                res.json({ message: 'Reserva realizada com sucesso!', clienteId, assentos: assento_ids });
              });
            });
          });
        };

        if (findResult.length > 0) {
          insertIngressos(findResult[0].id_cliente);
        } else {
          const codigoS = 'RSV' + Math.random().toString(36).substring(2, 8).toUpperCase();
          const insertCliente = 'INSERT INTO registro_clientes (nome, email, senha, meio_pagamento, dados_pagamento, codigo_s) VALUES (?, ?, ?, ?, ?, ?)';
          connection.query(insertCliente, [nome, email, 'reserva', 'reserva', telefone || '-', codigoS], (clienteErr, clienteResult) => {
            if (clienteErr) {
              return connection.rollback(() => {
                connection.release();
                res.status(500).json({ error: 'Erro ao gravar cliente.' });
              });
            }

            insertIngressos(clienteResult.insertId);
          });
        }
      });
    });
  });
});

app.get('/meus-pedidos', (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Informe o email para buscar seus pedidos.' });
  }

  const queryPedidos = `
    SELECT
    v.ingresso_id,
    v.filme_titulo,
    v.imagem,
    v.categoria,
    v.data_filme,
    v.cod AS pedido_numero,
    v.nome,
    v.data_compra,
    v.sala,
    v.fileira,
    v.poltrona_id,
    v.status_pagamento
  FROM reservas_clientes v
  INNER JOIN registro_clientes c ON CAST(c.id_cliente AS CHAR) = CAST(v.cod AS CHAR)
  WHERE c.email = ?
  ORDER BY v.data_compra DESC
`;
  db.query(queryPedidos, [email], (err, results) => {
  if (err) {
    console.error("Erro no MySQL:", err); // Verifique o terminal do Node
    return res.status(500).json({ error: 'Erro ao buscar pedidos.' });
  }

  // LOG DE DIAGNÓSTICO
  console.log("Email buscado:", email);
  console.log("Resultados brutos do banco:", results); 

  if (results.length === 0) {
    return res.status(404).json({ error: 'Nenhum pedido encontrado para este email.' });
  }

  res.json(results);
});
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});

