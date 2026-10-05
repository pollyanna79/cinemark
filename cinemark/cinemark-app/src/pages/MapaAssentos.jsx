import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { Armchair, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FaQrcode } from 'react-icons/fa';



export default function MapaAssentos() {
  const { id } = useParams();
  const [nomeNoCartao, setNomeNoCartao] = useState('');
  const [cartaoNumero, setCartaoNumero] = useState('');
  const [cartaoData, setCartaoData] = useState('');
  const [cartaoCvc, setCartaoCvc] = useState('');
  const [assentos, setAssentos] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [meioPagamento, setMeioPagamento] = useState('cartão');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const [sessao, setSessao] = useState(null);
  const [salaNome, setSalaNome] = useState('');
  const [filmeTitulo, setFilmeTitulo] = useState('');
  const [sessaoError, setSessaoError] = useState('');


  const copiarTexto = (texto) => {
  navigator.clipboard.writeText(texto);
  alert("Código copiado com sucesso!");
};

  useEffect(() => {
    api.get(`/filmes/${id}/sessao`)
      .then((res) => {
        setSessao(res.data);
        setSalaNome(res.data.sala_nome || `Sala ${res.data.sala_id}`);
        setFilmeTitulo(res.data.filme_titulo || 'Filme');
      })
      .catch((err) => {
        console.error(err);
        setSessaoError('Não foi possível carregar os dados da sessão.');
      });
  }, [id]);

  useEffect(() => {
    if (!sessao) return;
    api.get(`/assentos/sala/${sessao.sala_id}?sessao_id=${sessao.sessao_id}`)
      .then((res) => setAssentos(res.data))
      .catch((err) => {
        console.error(err);
        setErro('Não foi possível carregar os assentos. Tente novamente mais tarde.');
      });
  }, [sessao]);

  const fileirasAgrupadas = assentos.reduce((acc, assento) => {
    const letra = assento.fileira;
    if (!acc[letra]) acc[letra] = [];
    acc[letra].push(assento);
    return acc;
  }, {});

  const handleSeatSelect = (assento) => {
    if (assento.status_visual === 'ocupado') return;

    setSelectedSeats((prev) =>
      prev.includes(assento.id)
        ? prev.filter((seatId) => seatId !== assento.id)
        : [...prev, assento.id]
    );
  };

const validarCartao = (numero) => {
  // Remove espaços ou traços caso o usuário digite
  const apenasNumeros = numero.replace(/\D/g, '');

  // Valida o tamanho (15 para Amex, 16 para a maioria)
  if (apenasNumeros.length < 15 || apenasNumeros.length > 16) {
    return 'Tamanho inválido';
  }

  // Regex para identificar bandeiras
  const visa = /^4[0-9]{12}(?:[0-9]{3})?$/;
  const master = /^5[1-5][0-9]{14}$/;
  const amex = /^3[47][0-9]{13}$/;

  if (visa.test(apenasNumeros)) return 'Visa';
  if (master.test(apenasNumeros)) return 'Mastercard';
  if (amex.test(apenasNumeros)) return 'American Express';
  
  return 'Outra';
};

const validarValidade = (validade) => {
  // Formato MM/AA
  const [mes, ano] = validade.split('/').map(n => parseInt(n));
  const dataAtual = new Date();
  const mesAtual = dataAtual.getMonth() + 1;
  const anoAtual = parseInt(dataAtual.getFullYear().toString().slice(-2));

  if (ano < anoAtual || (ano === anoAtual && mes <= mesAtual)) return false;
  return true;
};

  const handleSubmit = async (event) => {
  event.preventDefault();
  setMensagem('');
  setErro('');

  // 1. Validação Geral de campos obrigatórios
  if (!nome || !email || !telefone || !senha || selectedSeats.length === 0) {
    setErro('Preencha seus dados, crie uma senha e selecione pelo menos um assento.');
    return;
  }

  // 2. Validação de Formatos
  if (nome.length < 3) return setErro("Digite seu nome completo.");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return setErro("Email inválido.");
  if (telefone.replace(/\D/g, '').length < 10) return setErro("Telefone inválido.");
  if (senha.length < 8 || senha.length > 128) return setErro('A senha deve ter entre 8 e 128 caracteres.');

  // 3. Validação Específica de Cartão
  if (meioPagamento === 'cartão') {
    // Verifica se todos os campos do cartão foram preenchidos
    if (!cartaoNumero || !cartaoData || !cartaoCvc || !nomeNoCartao) {
      return setErro("Preencha todos os dados do cartão.");
    }
    
    // Validações de lógica do cartão
    const nomeCliente = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const nomeCartao = nomeNoCartao.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    
    if (nomeCliente !== nomeCartao) {
      return setErro("O nome no cartão deve ser igual ao nome do titular.");
    }
    if (!validarValidade(cartaoData)) return setErro("Cartão vencido ou vencimento inválido.");
    if (validarCartao(cartaoNumero) === 'Outra') return setErro("Bandeira não suportada ou número inválido.");
  }

  if (!sessao) {
    setErro('Sessão não carregada ainda.');
    return;
  }

  setLoading(true);

  try {
    const response = await api.post('/reservar', {
      nome,
      email,
      telefone,
      senha,
      meio_pagamento: meioPagamento,
      cartao_final: meioPagamento === 'cartão'
        ? cartaoNumero.replace(/\D/g, '').slice(-4)
        : null,
      sessao_id: sessao.sessao_id,
      sala_id: sessao.sala_id,
      assento_ids: selectedSeats,
    });

    if (
      !/^CINE\d{4}$/.test(response.data?.codigo_pedido || '') ||
      response.data?.pedido !== response.data?.codigo_pedido
    ) {
      setErro('O servidor não confirmou a gravação completa dos dados no banco. Atualize a API antes de aceitar a reserva.');
      return;
    }

    // Limpeza após sucesso
    setNome(''); setEmail(''); setTelefone(''); setSenha('');
    setCartaoNumero(''); setCartaoData(''); setCartaoCvc(''); setNomeNoCartao('');
    setMeioPagamento('cartão'); setSelectedSeats([]);

    setMensagem(response.data.message || 'Reserva realizada com sucesso!');

    setAssentos((prev) =>
      prev.map((assento) =>
        selectedSeats.includes(assento.id)
          ? { ...assento, status_visual: 'ocupado' }
          : assento
      )
    );
  } catch (submitErr) {
    console.error(submitErr);
    setErro(submitErr?.response?.data?.error || 'Erro ao reservar. Verifique as informações e tente novamente.');
  } finally {
    setLoading(false);
  }
};
  const selectedLabels = selectedSeats
    .map((seatId) => {
      const seat = assentos.find((item) => item.id === seatId);
      return seat ? `${seat.fileira}${seat.numero}` : seatId;
    })
    .filter(Boolean);
   

  return (
    
    <div className="container">
        <nav>
        <Link to="/" className="nav-button">Inicio</Link></nav>
      
      <div className="cinema-wrapper">
       
        <div className="screen-container">
          <div className="screen-curve"></div>
          <div className="screen-header">
            <h1 className="screen-title">{filmeTitulo}</h1>
            <h2 className="screen-subtitle">{salaNome}</h2>
          </div>
        </div>

        {sessaoError && <div className="alert alert-danger">{sessaoError}</div>}
        {erro && <div className="alert alert-danger">{erro}</div>}
        {mensagem && <div className="alert alert-success">{mensagem}</div>}

        <div className="cinema-room">
          {Object.keys(fileirasAgrupadas).length === 0 ? (
            <p>Carregando assentos...</p>
          ) : (
            Object.keys(fileirasAgrupadas).map((letra) => (
              <div key={letra} className="row">
                <div className="row-label">{letra}</div>
                <div className="row-seats">
                  {fileirasAgrupadas[letra].map((assento) => {
                    const isSelected = selectedSeats.includes(assento.id);
                    return (
                      <button
                        key={assento.id}
                        type="button"
                        className={`seat ${assento.status_visual} ${isSelected ? 'selected' : ''}`}
                        disabled={assento.status_visual === 'ocupado'}
                        onClick={() => handleSeatSelect(assento)}
                        title={
                          assento.status_visual === 'ocupado'
                            ? 'Assento ocupado'
                            : `Assento ${assento.fileira}${assento.numero}`
                        }
                      >
                        <Armchair className="seat-icon" />
                        <span className="seat-num">{assento.numero}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="row-label">{letra}</div>
              </div>
            ))
          )}
        </div>

        <div className="legend-cinema">
          <div className="leg-item">
            <Armchair className="free" size={18} /> Livre
          </div>
          <div className="leg-item">
            <Armchair className="occ" size={18} /> Ocupado
          </div>
          <div className="leg-item">
            <Armchair className="selected" size={18} /> Selecionado
          </div>
        </div>

        <div className="reservation-panel">
          <h2>Finalize sua reserva</h2>
          <p>Selecione seus assentos e preencha seus dados para confirmar a compra.</p>

          <form className="reservation-form" onSubmit={handleSubmit}>
  {/* Campos Básicos */}
  <div className="field-group">
    <label>Nome</label>
    <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
  </div>
  
  <div className="field-group">
    <label>Email</label>
    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
  </div>
  
  <div className="field-group">
    <label>Telefone</label>
    <input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
  </div>

  <div className="field-group">
    <label htmlFor="customer-password">Senha</label>
    <input
      id="customer-password"
      type="password"
      autoComplete="new-password"
      minLength={8}
      maxLength={128}
      value={senha}
      onChange={(e) => setSenha(e.target.value)}
      placeholder="Crie uma senha com pelo menos 8 caracteres"
      required
    />
  </div>

  <fieldset className="payment-choice">
    <legend>Como deseja pagar?</legend>
    <div className="payment-options" role="radiogroup" aria-label="Meio de pagamento">
      <button
        className={`payment-option ${meioPagamento === 'cartão' ? 'is-selected' : ''}`}
        type="button"
        role="radio"
        aria-checked={meioPagamento === 'cartão'}
        onClick={() => setMeioPagamento('cartão')}
      >
        <CreditCard size={22} aria-hidden="true" />
        <span className="payment-option-copy">
          <strong>Cartão</strong>
          <small>Crédito ou débito</small>
        </span>
        <span className="payment-option-check" aria-hidden="true">✓</span>
      </button>
      <button
        className={`payment-option ${meioPagamento === 'pix' ? 'is-selected' : ''}`}
        type="button"
        role="radio"
        aria-checked={meioPagamento === 'pix'}
        onClick={() => setMeioPagamento('pix')}
      >
        <FaQrcode size={22} aria-hidden="true" />
        <span className="payment-option-copy">
          <strong>Pix</strong>
          <small>Rápido e prático</small>
        </span>
        <span className="payment-option-check" aria-hidden="true">✓</span>
      </button>
    </div>
  </fieldset>

  {/* Renderização Condicional - MANTENHA ISSO DENTRO DO FORM */}
  <div className="payment-container">
    {meioPagamento === 'pix' ? (
      <div className="payment-box pix-box">
        <div className="payment-box-title">
          <span className="payment-icon pix-icon"><FaQrcode aria-hidden="true" /></span>
          <div>
            <h3>Pagamento via Pix</h3>
            <p>Copie o código abaixo para continuar.</p>
          </div>
        </div>
        <div className="pix-code">
          <input aria-label="Código Pix" readOnly value="PIX1234567890ABCDEF" />
          <button type="button" onClick={() => copiarTexto("PIX1234567890ABCDEF")}>Copiar código</button>
        </div>
      </div>
        
    ) : (
      <div className="payment-box card-box">
        <div className="payment-box-title">
          <span className="payment-icon card-icon"><CreditCard aria-hidden="true" /></span>
          <div>
            <h3>Dados do cartão</h3>
            <p>Preencha os dados impressos no seu cartão.</p>
          </div>
        </div>
        <div className="card-fields">
          <label className="payment-field card-name-field">
            <span>Nome no cartão</span>
            <input
              autoComplete="cc-name"
              placeholder="Nome impresso no cartão"
              value={nomeNoCartao}
              onChange={(e) => setNomeNoCartao(e.target.value.toUpperCase())}
            />
          </label>
          <label className="payment-field card-number-field">
            <span>Número do cartão</span>
            <input
              autoComplete="cc-number"
              inputMode="numeric"
              placeholder="0000 0000 0000 0000"
              value={cartaoNumero}
              onChange={(e) => setCartaoNumero(e.target.value)}
            />
          </label>
          <label className="payment-field">
            <span>Validade</span>
            <input
              autoComplete="cc-exp"
              placeholder="MM/AA"
              value={cartaoData}
              onChange={(e) => setCartaoData(e.target.value)}
            />
          </label>
          <label className="payment-field">
            <span>Código de segurança</span>
            <input
              autoComplete="cc-csc"
              inputMode="numeric"
              placeholder="CVC"
              value={cartaoCvc}
              onChange={(e) => setCartaoCvc(e.target.value)}
            />
          </label>
        </div>
        <p className="secure-info">🔒 Seus dados são usados apenas para esta reserva.</p>
      </div>
    )}
  </div>

  {/* Resumo e Botão */}
  <div className="field-group selected-summary">
    <strong>Assentos selecionados:</strong>
    <span>{selectedLabels.length > 0 ? selectedLabels.join(', ') : 'Nenhum assento selecionado'}</span>
  </div>
  
  <button className="btn-submit" type="submit" disabled={loading}>
    {loading ? 'Enviando reserva...' : 'Confirmar reserva'}
  </button>
</form>
        </div>
      </div>
    </div>
  );
}
