import React from 'react';
import { Link } from 'react-router-dom';
import { Clapperboard } from 'lucide-react'; // Ícone de claquete

export default function Header() {
  return (
    <header className="main-header">
      <nav className="container nav-content">
        <Link to="/" className="logo">
          <Clapperboard size={32} color="#e11d48" />
          <span>CineMark</span>
        </Link>
        <Link to="/" className="nav-link">Início</Link>
      </nav>
    </header>
  );
}