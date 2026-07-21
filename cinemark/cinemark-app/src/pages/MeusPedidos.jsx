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
return (
    <div className="container">
      <nav className="container nav-content">
      <Link to="/" className="nav-link">Início</Link></nav>
      <h1 className="main-title">Meus Pedidos</h1>

      <form className="meus-pedidos-form" onSubmit={buscarPedidos}>
        <div className="field-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setBuscaRealizada(false); // Reseta a busca ao digitar
            }}
            placeholder="seu@email.com"
          />
        </div>
        <button className="btn-comprar" type="submit">Buscar Pedidos</button>
      </form>

      {erro && <div className="alert alert-danger">{erro}</div>}

      {pedidos.length > 0 ? (
        pedidos.map((pedido) => {
          const formatarData = (data) => {
            if (!data) return '—';
            return new Date(data).toLocaleDateString('pt-BR');
          };

          return (
            <div className="order-card" key={pedido.id || Math.random()}>
              <h3>Pedido #{pedido.id}</h3>
              <div className="order-item"><strong>Filme:</strong> <span>{pedido.filme_titulo}</span></div>
              <div className="order-item"><strong>Status:</strong> <span>{pedido.status_pagamento || '—'}</span></div>
              <div className="order-item"><strong>Sala:</strong> <span>{pedido.sala || '—'}</span></div>
              <strong>Assentos:</strong> 
  <span>
    {/* Concatena a letra da fileira com o número da poltrona */}
    {pedido.fileira}{pedido.poltrona_id || ','}
  </span> 
            <div className="order-item"><strong>Fileira:</strong> <span>{pedido.fileira}</span></div>                 
              <div className="order-item"><strong>Data da compra:</strong> <span>{formatDateTime(pedido.data_compra)}</span></div>
              <div className="order-item"><strong>Dia do Filme:</strong> <span>{formatarData(pedido.data_filme)}</span></div>
              <div className="order-item"><strong>Nome:</strong> <span>{pedido.nome || '—'}</span></div>
            
            </div>
          );
        })
      ) : (
        buscaRealizada && !erro && <p>Nenhum pedido encontrado para este email.</p>
      )}
    </div>
  );
}