import React from "react";
import Link from "next/link";

const socialLinks = [
  { href: "#", icon: <span className="sr-only">Twitter</span> },
  { href: "#", icon: <span className="sr-only">Facebook</span> },
  { href: "#", icon: <span className="sr-only">Instagram</span> },
];

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full bg-gray-100 border-t border-gray-200 py-6 mt-12">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between px-4 gap-4">
        <div className="text-sm text-gray-500">
          &copy; {year} Verity News. Todos los derechos reservados.
        </div>
        <nav className="flex gap-6">
          <Link href="/aviso-legal" className="text-gray-600 hover:text-gray-900">Aviso Legal</Link>
          <Link href="/politica-privacidad" className="text-gray-600 hover:text-gray-900">Política de Privacidad</Link>
          <Link href="/politica-cookies" className="text-gray-600 hover:text-gray-900">Política de Cookies</Link>
        </nav>
        <div className="flex gap-4">
          {socialLinks.map((link, idx) => (
            <a key={idx} href={link.href} className="text-gray-400 hover:text-gray-700" aria-label="Red social">
              {/* Icono placeholder */}
              <span className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">?</span>
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
