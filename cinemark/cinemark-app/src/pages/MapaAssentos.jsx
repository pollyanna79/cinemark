import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { Armchair, CalendarDays, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FaQrcode } from 'react-icons/fa';

const CODIGO_PIX = 'PIX1234567890ABCDEF';
const PRECO_INGRESSO = 20;
const HORARIOS_AGENDAMENTO = ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];

function adicionarDias(data, dias) {
  if (!data) return '';
  const dataAjustada = new Date(`${data}T00:00:00Z`);
  dataAjustada.setUTCDate(dataAjustada.getUTCDate() + dias);
  return dataAjustada.toISOString().slice(0, 10);
}


export default function MapaAssentos() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [nomeNoCartao, setNomeNoCartao] = useState('');
  const [cartaoNumero, setCartaoNumero] = useState('');
  const [cartaoData, setCartaoData] = useState('');
  const [cartaoCvc, setCartaoCvc] = useState('');
  const dataAgendamentoRef = useRef(null);
  const [assentos, setAssentos] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [horarioAgendamento, setHorarioAgendamento] = useState('');
  const [meioPagamento, setMeioPagamento] = useState('cartão');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const [sessao, setSessao] = useState(null);
  const [salaNome, setSalaNome] = useState('');
  const [filmeTitulo, setFilmeTitulo] = useState('');
  const [sessaoError, setSessaoError] = useState('');
  const dataEstreia = sessao?.data_estreia?.slice(0, 10) || '';
  const dataMinimaAgendamento = adicionarDias(dataEstreia, 1);
  const dataMaximaAgendamento = adicionarDias(dataEstreia, 31);


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
  if (!nome.trim()) {
    setErro('Informe seu nome.');
    return;
  }
  if (!email.trim()) {
    setErro('Informe seu email.');
    return;
  }
  if (!dataAgendamento) {
    setErro('Escolha o dia do agendamento.');
    return;
  }
  if (!horarioAgendamento) {
    setErro('Escolha o horário do agendamento.');
    return;
  }
  if (selectedSeats.length === 0) {
    setErro('Selecione pelo menos um assento no mapa antes de confirmar.');
    return;
  }
  if (!dataEstreia) {
    setErro('Não foi possível confirmar a data de estreia deste filme.');
    return;
  }

  // 2. Validação de Formatos
  if (nome.trim().length < 3) return setErro("Digite seu nome completo.");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) return setErro("Email inválido.");
  if (
    dataAgendamento < dataMinimaAgendamento ||
    dataAgendamento > dataMaximaAgendamento ||
    !HORARIOS_AGENDAMENTO.includes(horarioAgendamento)
  ) {
    return setErro('Escolha uma data válida após a estreia e um horário disponível entre 10h e 20h.');
  }

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
      nome: nome.trim(),
      email: email.trim(),
      meio_pagamento: meioPagamento,
      dados_pagamento: meioPagamento === 'cartão'
        ? cartaoNumero.replace(/\D/g, '').slice(-4)
        : CODIGO_PIX,
      dia_agendamento: `${dataAgendamento}T${horarioAgendamento}:00`,
      sessao_id: sessao.sessao_id,
      sala_id: sessao.sala_id, // Certifique-se que essa variável existe
      assento_ids: selectedSeats,
    });

    // Limpeza após sucesso
    setNome(''); setEmail(''); setDataAgendamento(''); setHorarioAgendamento('');
    setCartaoNumero(''); setCartaoData(''); setCartaoCvc(''); setNomeNoCartao('');
    setMeioPagamento('cartão'); setSelectedSeats([]);

    const numeroPedido = response.data?.codigo_pedido || response.data?.pedido;
    window.alert(
      numeroPedido
        ? `Pedido confirmado com sucesso!\nNúmero do pedido: ${numeroPedido}`
        : 'Pedido confirmado com sucesso!'
    );
    navigate('/');

    setAssentos((prev) =>
      prev.map((assento) =>
        selectedSeats.includes(assento.id)
          ? { ...assento, status_visual: 'ocupado' }
          : assento
      )
    );
  } catch (submitErr) {
    console.error('Resposta da API ao finalizar o pedido:', submitErr?.response?.data || submitErr?.message);
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

  <fieldset className="schedule-panel">
    <legend>Escolha quando quer assistir</legend>
    {dataEstreia ? (
      <>
        <p>
          Agendamentos disponíveis de {new Date(`${dataMinimaAgendamento}T00:00:00`).toLocaleDateString('pt-BR')}
          {' '}a {new Date(`${dataMaximaAgendamento}T00:00:00`).toLocaleDateString('pt-BR')}.
          Horários: das 10h às 20h, de duas em duas horas.
        </p>
        <div className="schedule-fields">
          <label className="field-group">
            <span>Dia</span>
            <span className="schedule-date-control">
              <input
                ref={dataAgendamentoRef}
                className="schedule-date-input"
                type="date"
                value={dataAgendamento}
                min={dataMinimaAgendamento}
                max={dataMaximaAgendamento}
                onChange={(event) => setDataAgendamento(event.target.value)}
                disabled={!dataEstreia}
                required
              />
              <button
                className="schedule-calendar-button"
                type="button"
                aria-label="Abrir calendário"
                title="Abrir calendário"
                disabled={!dataEstreia}
                onClick={() => {
                  const campoData = dataAgendamentoRef.current;
                  if (typeof campoData?.showPicker === 'function') {
                    campoData.showPicker();
                  } else {
                    campoData?.focus();
                    campoData?.click();
                  }
                }}
              >
                <CalendarDays size={20} aria-hidden="true" />
              </button>
            </span>
          </label>
          <label className="field-group">
            <span>Horário</span>
            <select
              value={horarioAgendamento}
              onChange={(event) => setHorarioAgendamento(event.target.value)}
              disabled={!dataEstreia}
              required
            >
              <option value="">Selecione um horário</option>
              {HORARIOS_AGENDAMENTO.map((horario) => (
                <option key={horario} value={horario}>{horario}</option>
              ))}
            </select>
          </label>
        </div>
      </>
    ) : (
      <p>{sessaoError || 'Carregando a data de estreia do filme para liberar o calendário...'}</p>
    )}
  </fieldset>

  <fieldset className="payment-choice">
    <legend>Meio de pagamento</legend>
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
          <small>Pagamento rápido</small>
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
            <p>Copie o código para continuar.</p>
          </div>
        </div>
        <div className="pix-code">
          <input aria-label="Código Pix" readOnly value={CODIGO_PIX} />
          <button type="button" onClick={() => copiarTexto(CODIGO_PIX)}>Copiar código</button>
        </div>
      </div>
        
    ) : (
      <div className="payment-box card-box">
        <div className="payment-box-title">
          <span className="payment-icon card-icon"><CreditCard aria-hidden="true" /></span>
          <div>
            <h3>Dados do cartão</h3>
            <p>Informe os dados do titular.</p>
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
        <p className="secure-info">Somente os quatro últimos dígitos são registrados. O código de segurança não é armazenado.</p>
      </div>
    )}
  </div>

  {/* Resumo e Botão */}
  <div className="field-group selected-summary">
    <strong>Assentos selecionados:</strong>
    <span>{selectedLabels.length > 0 ? selectedLabels.join(', ') : 'Nenhum assento selecionado'}</span>
    <span>{selectedSeats.length} ingresso(s) × R$ {PRECO_INGRESSO.toFixed(2).replace('.', ',')}</span>
    <strong>Total da compra: R$ {(selectedSeats.length * PRECO_INGRESSO).toFixed(2).replace('.', ',')}</strong>
  </div>
  
  {erro && <div className="alert alert-danger" role="alert">{erro}</div>}

  <button className="btn-submit" type="submit" disabled={loading}>
    {loading ? 'Enviando reserva...' : 'Confirmar reserva'}
  </button>
</form>
        </div>
      </div>
    </div>
  );
}
