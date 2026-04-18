import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import MapaAssentos from './pages/MapaAssentos';

function App() {
  return (
    <BrowserRouter>
    
      <Routes>
        {/* Rota para a lista de filmes */}
        <Route path="/" element={<Home />} />
        
        {/* Rota para o mapa de 75 assentos (passando o ID da sessão) */}
        <Route path="/sessao/:id" element={<MapaAssentos />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;