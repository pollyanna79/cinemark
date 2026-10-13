require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('node:crypto');

const PRECO_INGRESSO = 20;
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



const gerarNumeroPedido = () => `CINE${crypto.randomInt(1000, 10000)}`;

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
      DATE_FORMAT(f.estreia, '%Y-%m-%d') AS data_estreia,
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
  const {
    nome,
    email,
    meio_pagamento,
    dados_pagamento,
    dia_agendamento,
    sessao_id,
    sala_id,
    assento_ids
  } = req.body;

  if (!nome || !email || !meio_pagamento || !dia_agendamento || !sessao_id || !sala_id || !Array.isArray(assento_ids) || assento_ids.length === 0){
    return res.status(400).json({ error: 'Preencha todos os campos e selecione pelo menos um assento.' });
  }

  const meioPagamentoLower = String(meio_pagamento).trim().toLowerCase();
  const meioPagamentoEscolhido = meioPagamentoLower === 'pix'
    ? 'pix'
    : ['cartão', 'cartao', 'card'].includes(meioPagamentoLower)
      ? 'cartao'
      : null;

  if (!meioPagamentoEscolhido) {
    return res.status(400).json({ error: 'Selecione Pix ou cartão como meio de pagamento.' });
  }

  const dadosPagamentoInformados = String(dados_pagamento || '').trim();
  const dadosPagamentoValor = meioPagamentoEscolhido === 'pix'
    ? dadosPagamentoInformados
    : `****${dadosPagamentoInformados}`;

  if (
    (meioPagamentoEscolhido === 'pix' && !dadosPagamentoInformados) ||
    (meioPagamentoEscolhido === 'cartao' && !/^\d{4}$/.test(dadosPagamentoInformados))
  ) {
    return res.status(400).json({ error: 'Informe o código Pix ou somente os quatro últimos dígitos do cartão.' });
  }

  const agendamentoMatch = /^(\d{4}-\d{2}-\d{2})T(10|12|14|16|18|20):00$/.exec(dia_agendamento);
  if (!agendamentoMatch) {
    return res.status(400).json({ error: 'Selecione uma data e um horário disponíveis: 10h, 12h, 14h, 16h, 18h ou 20h.' });
  }

  const dataSelecionada = new Date(`${agendamentoMatch[1]}T00:00:00Z`);
  if (Number.isNaN(dataSelecionada.getTime()) || dataSelecionada.toISOString().slice(0, 10) !== agendamentoMatch[1]) {
    return res.status(400).json({ error: 'A data de agendamento não é válida.' });
  }

  db.query(
    `SELECT DATE_FORMAT(f.estreia, '%Y-%m-%d') AS data_estreia, s.sala_id
     FROM sessoes s
     JOIN filmes f ON f.id = s.filme_id
     WHERE s.id = ?`,
    [sessao_id],
    (scheduleErr, scheduleResults) => {
      if (scheduleErr) {
        console.error('Erro ao validar agendamento:', scheduleErr);
        return res.status(500).json({ error: 'Erro ao validar a data do filme.' });
      }

      if (scheduleResults.length === 0 || Number(scheduleResults[0].sala_id) !== Number(sala_id)) {
        return res.status(400).json({ error: 'Sessão inválida para este agendamento.' });
      }

      const dataEstreia = scheduleResults[0].data_estreia;
      if (!dataEstreia) {
        return res.status(400).json({ error: 'A data de estreia deste filme não está cadastrada.' });
      }

      const primeiroDia = new Date(`${dataEstreia}T00:00:00Z`);
      const ultimoDia = new Date(`${dataEstreia}T00:00:00Z`);
      primeiroDia.setUTCDate(primeiroDia.getUTCDate() + 1);
      ultimoDia.setUTCDate(ultimoDia.getUTCDate() + 31);
      const dataMinima = primeiroDia.toISOString().slice(0, 10);
      const dataMaxima = ultimoDia.toISOString().slice(0, 10);

      if (agendamentoMatch[1] < dataMinima || agendamentoMatch[1] > dataMaxima) {
        return res.status(400).json({
          error: `Escolha uma data entre ${dataMinima} e ${dataMaxima}, considerando a estreia do filme.`
        });
      }

      const agendamentoParaBanco = `${agendamentoMatch[1]} ${agendamentoMatch[2]}:00:00`;
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
                res.status(409).json({ error: 'Erro ao verificar disponibilidade dos assentos.' });
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
                res.json({
                  message: 'Reserva realizada com sucesso!',
                  clienteId,
                  assentos: assento_ids,
                  codigo_pedido: numeroPedido,
                  valor_total: assento_ids.length * PRECO_INGRESSO
                });
              });
            });
          });
        };
        const numeroPedido = gerarNumeroPedido();

        if (findResult.length > 0) {
          const clienteId = findResult[0].id_cliente;
          const updateCliente = `
            UPDATE registro_clientes 
            SET nome = ?, email = ?, meio_pagamento = ?, dados_pagamento = ?, codigo_s = ?, pedido = ?, dia_agendamento = ?
            WHERE id_cliente = ?
          `;

          connection.query(updateCliente, [
            nome,
            email,
            meioPagamentoEscolhido,
            dadosPagamentoValor,
            '--',
            numeroPedido,
            agendamentoParaBanco,
            clienteId
          ], (updateErr) => {
            if (updateErr) {
              return connection.rollback(() => {
                connection.release();
                res.status(500).json({ error: 'Erro ao atualizar dados do cliente.' });
              });
            }
            insertIngressos(clienteId);
          });

        } else {
          const insertCliente = `
            INSERT INTO registro_clientes 
            (nome, email, meio_pagamento, dados_pagamento, codigo_s, pedido, dia_agendamento)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;

          connection.query(insertCliente, [
            nome,
            email,
            meioPagamentoEscolhido,
            dadosPagamentoValor,
            '--',
            numeroPedido,
            agendamentoParaBanco
          ], (clienteErr, clienteResult) => {
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
    }
  );
});
app.get('/meus-pedidos', (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Informe o email para buscar seus pedidos.' });
  }

  // Certifique-se de que a view/tabela faz o JOIN usando o id_cliente correto
  const queryPedidos = `
    SELECT
i.id AS ingresso_id,
    f.titulo AS filme_titulo,
    f.capa_url AS imagem,
    f.trailer_url AS trailer,
    f.categoria AS categoria,
    f.estreia AS data_filme,
    c.id_cliente AS cod,
    c.nome AS nome,
    c.pedido AS pedido,
    DATE_FORMAT(c.dia_agendamento, '%Y-%m-%d %H:%i') AS dia_agendamento,
    i.data_compra AS data_compra,
    (
      SELECT COUNT(*) * ${PRECO_INGRESSO}
      FROM ingressos total
      WHERE total.id_cliente = i.id_cliente
        AND total.data_compra = i.data_compra
    ) AS valor_total,
    a.sala_id AS sala,
    a.fileira AS fileira,
    a.numero AS numero_assento,
    i.status AS status_pagamento
FROM ingressos i
JOIN sessoes s ON i.sessao_id = s.id
JOIN filmes f ON s.filme_id = f.id
JOIN assentos a ON i.assento_id = a.id
JOIN registro_clientes c ON i.id_cliente = c.id_cliente
WHERE c.email = ?
ORDER BY i.data_compra DESC;
  `;

  db.query(queryPedidos, [email], (err, results) => {
    if (err) {
      console.error("Erro no MySQL:", err);
      return res.status(500).json({ error: 'Erro ao buscar pedidos.' });
    }

    console.log("Email buscado:", email);
    console.log("Resultados brutos do banco:", results);  

    // Se não encontrar nada, retorna um array vazio ou uma mensagem amigável com status 200/404 de forma controlada dentro do callback
    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'Nenhum pedido encontrado para este email.' });
    }

    return res.json(results);
  });
});
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
