import React from 'react';
import { useFilmes } from '../hooks/useFilmes';
import { Link } from 'react-router-dom';
import { MovieCard } from '../components/MovieCard';

export default function Home() {
  const { filmes } = useFilmes();

  return (
    <div className="container">
      <h1 className="main-title">Filmes em Cartaz</h1>
      <div className="grid-filmes">
        {filmes.length === 0 ? (
          <p>Carregando filmes ou banco vazio...</p>
        ) : (
          filmes.map((filme) => (
            /* O tabIndex permite que o container receba foco para a borda vermelha */
            <div key={filme.id} className="card-filme" tabIndex="0">
              <div className="image-wrapper">
                <img src={filme.capa_url} alt={filme.titulo} />
              </div>
              <div className="card-info">
                <h3>{filme.titulo}</h3>
                <p className="film-premiere">Estreia: {filme.estreia ? new Date(filme.estreia).toLocaleDateString('pt-BR') : 'Data indisponível'}</p>
                <Link to={`/sessao/${filme.id}`} className="btn-comprar">
                  Ingressos
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}