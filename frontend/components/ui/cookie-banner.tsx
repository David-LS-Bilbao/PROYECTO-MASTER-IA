"use client";
import React, { useEffect, useState } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) setVisible(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie_consent", "true");
    setVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem("cookie_consent", "false");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md bg-white shadow-lg rounded-lg border border-gray-200 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="text-sm text-gray-700">
        Utilizamos cookies para mejorar tu experiencia. Puedes aceptar o configurar tus preferencias.
      </div>
      <div className="flex gap-2">
        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700" onClick={handleAccept}>Aceptar</button>
        <button className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400" onClick={handleReject}>Rechazar</button>
      </div>
    </div>
  );
}
