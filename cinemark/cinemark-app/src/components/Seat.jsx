// src/components/Seat.jsx
export function Seat({ assento, onSelect }) {
  const isOcupado = assento.status_visual === 'ocupado';
  
  return (
    <button
      className={`seat ${isOcupado ? 'ocupado' : 'disponivel'}`}
      disabled={isOcupado}
      onClick={() => onSelect(assento.id)}
      title={isOcupado ? "Assento já reservado" : `Lugar ${assento.fileira}${assento.numero}`}
    >
      {assento.fileira}{assento.numero}
    </button>
  );
}
