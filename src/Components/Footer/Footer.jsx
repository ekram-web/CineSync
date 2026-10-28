import React from "react";
import "./footer.css";

const Footer = () => {
  return (
    <footer className="footer-simple">
      <p className="footer-simpleText">
        CineSync © {new Date().getFullYear()} · Powered by TMDB & Google Gemini
      </p>
    </footer>
  );
};

export default Footer;
