import axios from 'axios';

const api = axios.create({
  // URL do seu futuro servidor Node/Express
  baseURL: 'http://127.0.0.1:3000', 
});

export default api;
