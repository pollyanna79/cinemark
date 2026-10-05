require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const { randomBytes, randomInt, scryptSync } = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const reservationCodeLock = 'cinemark_reservation_code';

function hashCustomerPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

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
app.post('/reservar', async (req, res) => {
  const {
    nome,
    email,
    telefone,
    senha,
    meio_pagamento,
    cartao_final,
    sessao_id,
    sala_id,
    assento_ids,
  } = req.body;

  if (
    typeof nome !== 'string' || nome.trim().length < 3 ||
    typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof telefone !== 'string' || telefone.replace(/\D/g, '').length < 10 ||
    typeof senha !== 'string' || senha.length < 8 || senha.length > 128 ||
    !['cartão', 'pix'].includes(meio_pagamento) ||
    !sessao_id || !sala_id ||
    !Array.isArray(assento_ids) || assento_ids.length === 0
  ) {
    return res.status(400).json({ error: 'Confira seus dados, informe uma senha de 8 a 128 caracteres e selecione ao menos um assento.' });
  }

  if (meio_pagamento === 'cartão' && !/^\d{4}$/.test(cartao_final || '')) {
    return res.status(400).json({ error: 'Dados de cartão inválidos. Informe o número do cartão novamente.' });
  }

  const dadosPagamento = meio_pagamento === 'cartão'
    ? `Cartão final ****${cartao_final}`
    : 'Pix';
  const emailNormalizado = email.trim().toLowerCase();
  const nomeNormalizado = nome.trim();
  const senhaHash = hashCustomerPassword(senha);
  let connection;
  let transactionStarted = false;
  let lockAcquired = false;

  try {
    connection = await db.promise().getConnection();

    const [lockRows] = await connection.query(
      'SELECT GET_LOCK(?, 10) AS adquirido',
      [reservationCodeLock]
    );
    if (Number(lockRows[0]?.adquirido) !== 1) {
      return res.status(503).json({ error: 'Não foi possível iniciar a reserva. Tente novamente.' });
    }
    lockAcquired = true;

    await connection.beginTransaction();
    transactionStarted = true;

    const [clienteRows] = await connection.execute(
      'SELECT id_cliente FROM registro_clientes WHERE LOWER(email) = ? LIMIT 1',
      [emailNormalizado]
    );
    const [assentosOcupados] = await connection.query(
      'SELECT assento_id FROM ingressos WHERE sessao_id = ? AND assento_id IN (?)',
      [sessao_id, assento_ids]
    );
    if (assentosOcupados.length > 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ error: 'Um ou mais assentos já estão ocupados. Atualize a página e escolha outros assentos.' });
    }

    const [codigosRows] = await connection.query(`
      SELECT codigo_s AS codigo FROM registro_clientes WHERE codigo_s LIKE 'CINE%'
      UNION
      SELECT pedido AS codigo FROM registro_clientes WHERE pedido LIKE 'CINE%'
    `);
    const codigosUsados = new Set(codigosRows.map((row) => row.codigo));
    const inicio = randomInt(0, 9000);
    let codigoPedido;
    for (let offset = 0; offset < 9000; offset += 1) {
      const candidato = `CINE${1000 + ((inicio + offset) % 9000)}`;
      if (!codigosUsados.has(candidato)) {
        codigoPedido = candidato;
        break;
      }
    }
    if (!codigoPedido) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ error: 'Não há códigos de pedido disponíveis. Entre em contato com o atendimento.' });
    }

    const dataCompra = new Date();
    let clienteId;
    if (clienteRows.length > 0) {
      clienteId = clienteRows[0].id_cliente;
      await connection.execute(
        `UPDATE registro_clientes
         SET nome = ?, email = ?, senha = ?, meio_pagamento = ?, dados_pagamento = ?,
             codigo_s = ?, data_compra = ?, pedido = ?
         WHERE id_cliente = ?`,
        [nomeNormalizado, emailNormalizado, senhaHash, meio_pagamento, dadosPagamento, codigoPedido, dataCompra, codigoPedido, clienteId]
      );
    } else {
      const [clienteResult] = await connection.execute(
        `INSERT INTO registro_clientes
         (nome, email, senha, meio_pagamento, dados_pagamento, codigo_s, data_compra, pedido)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [nomeNormalizado, emailNormalizado, senhaHash, meio_pagamento, dadosPagamento, codigoPedido, dataCompra, codigoPedido]
      );
      clienteId = clienteResult.insertId;
    }

    const [clienteGravadoRows] = await connection.execute(
      `SELECT nome, email, senha, meio_pagamento, dados_pagamento, codigo_s, data_compra, pedido
       FROM registro_clientes WHERE id_cliente = ?`,
      [clienteId]
    );
    const clienteGravado = clienteGravadoRows[0];
    if (
      !clienteGravado ||
      clienteGravado.nome !== nomeNormalizado ||
      clienteGravado.email.toLowerCase() !== emailNormalizado ||
      clienteGravado.senha !== senhaHash ||
      clienteGravado.meio_pagamento !== meio_pagamento ||
      clienteGravado.dados_pagamento !== dadosPagamento ||
      clienteGravado.codigo_s !== codigoPedido ||
      clienteGravado.pedido !== codigoPedido ||
      !clienteGravado.data_compra
    ) {
      throw new Error('A conferência das colunas em registro_clientes falhou.');
    }

    const ingressosValues = assento_ids.map((assentoId) => [
      sessao_id,
      assentoId,
      clienteId,
      dataCompra,
      'Aguardando aprovação',
      clienteId,
    ]);
    await connection.query(
      'INSERT INTO ingressos (sessao_id, assento_id, usuario_id, data_compra, status, id_cliente) VALUES ?',
      [ingressosValues]
    );

    await connection.commit();
    transactionStarted = false;
    return res.json({
      message: 'Reserva realizada com sucesso!',
      clienteId,
      assentos: assento_ids,
      codigo_pedido: codigoPedido,
      pedido: codigoPedido,
      meio_pagamento,
    });
  } catch (error) {
    console.error('Erro ao gravar reserva no banco:', error);
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Erro ao desfazer transação da reserva:', rollbackError);
      }
    }
    return res.status(500).json({
      error: 'Não foi possível gravar todos os dados da reserva no banco.',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message,
    });
  } finally {
    if (connection) {
      if (lockAcquired) {
        try {
          await connection.query('SELECT RELEASE_LOCK(?)', [reservationCodeLock]);
        } catch (releaseError) {
          console.error('Erro ao liberar bloqueio do código do pedido:', releaseError);
        }
      }
      connection.release();
    }
  }
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
      i.data_compra AS data_compra,
      a.sala_id AS sala,
      a.fileira AS fileira,
      a.id AS poltrona_id,
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
