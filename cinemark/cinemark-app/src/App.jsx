import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import MapaAssentos from './pages/MapaAssentos';
import MeusPedidos from './pages/MeusPedidos';
import Header from './components/Header';
import Footer from './components/Footer';

function App() {
  return (
    <BrowserRouter>
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sessao/:id" element={<MapaAssentos />} />
          <Route path="/meus-pedidos" element={<MeusPedidos />} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  );
}

export default App;