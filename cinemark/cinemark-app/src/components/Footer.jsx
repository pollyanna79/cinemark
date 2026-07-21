import React from 'react';
import { FaInstagram, FaFacebook, FaEnvelope, FaWhatsapp , FaMapMarkerAlt } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer className="footer">
      {/* Bloco 1: Sobre (Topo) */}
      <div className="footer-top">
        <h3>Sobre o CineMark</h3>
        <p>O melhor cinema para você aproveitar os grandes lançamentos com conforto e tecnologia.</p>
      </div>

      {/* Bloco 2: Contato e Siga-nos (Lado a lado) */}
      <div className="footer-bottom-grid">
        <div className="footer-section">
          <h3>Contato</h3>
          <div className="contact-item icon-email"><FaEnvelope /> <span>pollyannasantosouza@cinemark.com</span></div>
          <div className="contact-item icon-phone"><FaWhatsapp /> <span>(11) 7070-7070</span></div>
          <div className="contact-item icon-loc"><FaMapMarkerAlt /> <span>Rua dos Cinemas, 123 - Mauá, SP</span></div>
        </div>

        <div className="footer-section">
          <h3>Siga-nos</h3>
          <div className="social-icons">
            <a href="#" className="insta"><FaInstagram /></a>
            <a href="#" className="face"><FaFacebook /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}