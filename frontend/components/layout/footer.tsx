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
    <footer className="w-full bg-gray-100 border-t border-gray-200 py-0.5 mt-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between px-4 gap-1">
        <div className="text-[9px] leading-tight text-gray-500">
          &copy; {year} Verity News. Todos los derechos reservados.
        </div>
        <nav className="hidden sm:flex gap-4 text-[10px]">
          <Link href="/aviso-legal" className="text-gray-600 hover:text-gray-900">Aviso Legal</Link>
          <Link href="/politica-privacidad" className="text-gray-600 hover:text-gray-900">Política de Privacidad</Link>
          <Link href="/politica-cookies" className="text-gray-600 hover:text-gray-900">Política de Cookies</Link>
        </nav>
      </div>
    </footer>
  );
}
