import axios from 'axios';

const api = axios.create({
  // URL do seu futuro servidor Node/Express
  baseURL: import.meta.env.VITE_API_URL || 'https://cinemark-z3wn.onrender.com' 
});

export default api;
