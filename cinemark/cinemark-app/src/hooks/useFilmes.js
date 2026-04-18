import { useState, useEffect } from 'react';
import api from '../services/api';

export function useFilmes() {
  const [filmes, setFilmes] = useState([]);

  useEffect(() => {
    api.get('/filmes')
      .then(response => setFilmes(response.data))
      .catch(err => console.error("Erro ao buscar filmes", err));
  }, []);

  return { filmes };
}
