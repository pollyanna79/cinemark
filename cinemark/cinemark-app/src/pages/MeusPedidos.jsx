import React, { useState } from 'react';
import api from '../services/api';
import { Link } from 'react-router-dom';


function formatDateTime(value) {
  if (!value) return 'Não disponível';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);
}

function formatAppointment(value) {
  if (!value) return 'Agendamento não informado';
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]} às ${match[4]}:${match[5]}`;
}

export default function MeusPedidos() {
  const [email, setEmail] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [erro, setErro] = useState('');
  const [buscaRealizada, setBuscaRealizada] = useState(false);

  const buscarPedidos = async (event) => {
    event.preventDefault();
    setErro('');
    setBuscaRealizada(true);

    if (!email) {
      setErro('Informe um email para buscar seus pedidos.');
      return;
    }

    try {
      const response = await api.get('/meus-pedidos', { params: { email } });
      setPedidos(response.data);
    } catch (error) {
      console.error(error);
      setErro(error?.response?.data?.error || 'Erro ao buscar pedidos.');
      setPedidos([]);
    }
  };

  const pedidosAgrupados = Object.values(pedidos.reduce((grupos, ingresso) => {
    const chave = `${ingresso.pedido || ingresso.cod}-${ingresso.dia_agendamento}`;
    if (!grupos[chave]) {
      grupos[chave] = { ...ingresso, assentos: [] };
    }
    grupos[chave].assentos.push(`${ingresso.fileira}${ingresso.numero_assento}`);
    return grupos;
  }, {}));

  return (
    <div className="container">
      <nav className="container nav-content">
        <Link to="/" className="nav-link">Início</Link>
      </nav>
      <header className="orders-header">
        <span className="orders-eyebrow">CINEMARK</span>
        <h1 className="main-title">Meus pedidos</h1>
        <p>Consulte seus ingressos e o total de cada compra.</p>
      </header>

      <form className="meus-pedidos-form" onSubmit={buscarPedidos}>
        <div className="field-group">
          <label htmlFor="orders-email">Email</label>
          <input
            id="orders-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setBuscaRealizada(false); // Reseta a busca ao digitar
            }}
            placeholder="seu@email.com"
          />
        </div>
        <button className="btn-comprar" type="submit">Buscar pedidos</button>
      </form>

      {erro && <div className="alert alert-danger">{erro}</div>}

      {pedidosAgrupados.length > 0 ? (
        <section className="orders-list" aria-label="Pedidos encontrados">
          {pedidosAgrupados.map((pedido) => (
            <article className="order-card" key={`${pedido.pedido}-${pedido.dia_agendamento}`}>
              <div className="order-card-header">
                <div>
                  <span className="orders-eyebrow">SEU PEDIDO</span>
                  <h2>{pedido.pedido || `#${pedido.ingresso_id}`}</h2>
                </div>
                <span className="order-status">{pedido.status_pagamento || 'Em processamento'}</span>
              </div>
              <div className="order-details">
                <div className="order-item">
                  <strong>Filme</strong>
                  <span>{pedido.filme_titulo || '—'}</span>
                </div>
                <div className="order-item">
                  <strong>Sala</strong>
                  <span>{pedido.sala || '—'}</span>
                </div>
                <div className="order-item">
                  <strong>Data da compra</strong>
                  <span>{formatDateTime(pedido.data_compra)}</span>
                </div>
                <div className="order-item">
                  <strong>Agendamento para o dia:</strong>
                  <span>{formatAppointment(pedido.dia_agendamento)}</span>
                </div>
              </div>
              <div className="order-seats">
                <strong>Assentos</strong>
                <div className="order-seat-list">
                  {pedido.assentos.map((assento) => (
                    <span className="order-seat" key={assento}>{assento}</span>
                  ))}
                </div>
              </div>
              <div className="order-total">
                <span>{pedido.assentos.length} ingresso(s)</span>
                <strong>{formatCurrency(pedido.valor_total)}</strong>
              </div>
            </article>
          ))}
        </section>
      ) : (
        buscaRealizada && !erro && <p className="orders-empty">Nenhum pedido encontrado para este email.</p>
      )}
    </div>
  );
}