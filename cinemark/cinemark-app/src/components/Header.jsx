import React from 'react';
import { Link } from 'react-router-dom';
import { Clapperboard, Ticket } from 'lucide-react';

export default function Header() {
  return (
    <header className="main-header">
      <div className="container header-top">
        <Link to="/" className="logo">
          <Clapperboard size={45} />
          <div>
            <strong className="titulo">CineMark</strong>
            <span className="texto-piscante">Reserve seu ingresso conosco</span>
          </div>
        </Link>
        <div className="header-actions">
          <Link to="/meus-pedidos" className="nav-button">
            <Ticket size={18} /> Meus Pedidos
          </Link>
        </div>
      </div>
    
    </header>
  );
}