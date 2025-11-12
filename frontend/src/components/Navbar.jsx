import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Github, Menu, X } from "lucide-react";

export default function Navbar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { name: "Create", path: "/" },

  ];

  return (
    <nav
      className="w-full sticky top-0 z-50 bg-[#0C0C0C]/80 backdrop-blur-xl border-b border-[#1F1F1F]
                 text-white shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all duration-300"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-5 sm:px-8 py-3">
        {/*  Brand */}
        <Link
          to="/"
          className="text-[1.6rem] sm:text-[1.8rem] font-syne font-extrabold tracking-tight 
                     text-white hover:text-[#FF5A00] transition-colors duration-200"
        >
          Secure<span className="text-[#FF5A00]">Bin</span>
        </Link>

        {/*  Desktop Nav */}
        <div className="hidden sm:flex items-center gap-8 text-sm font-roboto font-medium">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`relative transition-colors duration-200 pb-1 ${
                location.pathname === link.path
                  ? "text-[#FF5A00] after:w-full"
                  : "text-[#A1A1A1] hover:text-white"
              } after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] 
                 after:bg-[#FF5A00] after:w-0 hover:after:w-full after:transition-all after:duration-300`}
            >
              {link.name}
            </Link>
          ))}

          <a
            href="https://github.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[#A1A1A1] hover:text-white transition-all duration-200"
          >
            <Github size={16} className="text-[#FF5A00]" />
            GitHub
          </a>
        </div>

        {/*  Mobile Menu Button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="sm:hidden text-[#FF5A00] hover:text-white transition-colors duration-200"
          aria-label="Toggle Menu"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/*  Mobile Dropdown */}
      {menuOpen && (
        <div className="sm:hidden border-t border-[#1F1F1F] bg-[#0C0C0C]/95 backdrop-blur-xl px-5 pb-4 animate-fadeIn">
          <div className="flex flex-col gap-3 mt-2 text-sm font-roboto">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMenuOpen(false)}
                className={`py-2 px-2 rounded-md transition-colors duration-200 ${
                  location.pathname === link.path
                    ? "bg-[#151515] text-[#FF5A00]"
                    : "text-[#A1A1A1] hover:bg-[#151515] hover:text-white"
                }`}
              >
                {link.name}
              </Link>
            ))}

            <a
              href="https://github.com/uditc0derr/SecureBin.git"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-2 px-2 text-[#A1A1A1] hover:text-white hover:bg-[#151515] rounded-md transition-all duration-200"
            >
              <Github size={16} className="text-[#FF5A00]" />
              GitHub
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
