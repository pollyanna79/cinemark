import React from 'react';

export function MovieCard({ filme }) {
  return (
    <div className="movie-card">
      <img src={filme.capa_url} alt={filme.titulo} />
      <h3>{filme.titulo}</h3>
      <p>{filme.categoria}</p>
      <span>R$ {filme.preco}</span>
      <button onClick={() => window.location.href = `/sessao/${filme.id}`}>
        Comprar Ingresso
      </button>
    </div>
  );
}
