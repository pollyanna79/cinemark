import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom'; // Faltava o Link
import api from '../services/api';
import { Armchair, Home as HomeIcon } from 'lucide-react'; // Faltava o HomeIcon
// Se o Header for um componente separado, certifique-se que o caminho está correto
import Header from '../components/Header';

export default function MapaAssentos() {
  const { id } = useParams();
  const [assentos, setAssentos] = useState([]);

  useEffect(() => {
    // Substitua o '1' pelo ID da sessão real vindo do seu banco
    api.get(`/assentos/sala/${id}?sessao_id=1`)
      .then(res => setAssentos(res.data))
      .catch(err => console.error(err));
  }, [id]);
  // Lógica para agrupar assentos por letra da fileira (A, B, C...)
  const fileirasAgrupadas = assentos.reduce((acc, assento) => {
    const letra = assento.fileira;
    if (!acc[letra]) acc[letra] = [];
    acc[letra].push(assento);
    return acc;
  }, {});

  return (
   <div className="container">
   
      <div className="cinema-wrapper">
        <div className="screen-container">
          <div className="screen-curve"></div>
          <span>Sala</span>
        </div>

        <div className="cinema-room">
          {Object.keys(fileirasAgrupadas).map((letra) => (
            <div key={letra} className="row">
              <div className="row-label">{letra}</div>
              <div className="row-seats">
                {fileirasAgrupadas[letra].map((assento) => (
                  <button
                    key={assento.id}
                    className={`seat-btn ${assento.status_visual}`}
                    disabled={assento.status_visual === 'ocupado'}
                  >
                    <Armchair className="seat-icon" />
                    <span className="seat-num">{assento.numero}</span>
                  </button>
                ))}
              </div>
              <div className="row-label">{letra}</div>
            </div>
          ))}
        </div>

        <div className="legend-cinema">
          <div className="leg-item"><Armchair className="free" size={18}/> Livre</div>
          <div className="leg-item"><Armchair className="occ" size={18}/> Ocupado</div>
        </div>
        <Header />
      </div>
    </div>
  );
}