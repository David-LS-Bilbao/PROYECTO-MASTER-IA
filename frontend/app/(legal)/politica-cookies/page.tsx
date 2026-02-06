import React from "react";

export default function PoliticaCookiesPage() {
  return (
    <main className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Política de Cookies</h1>
      <section className="mb-4">
        <h2 className="text-xl font-semibold mb-2">¿Qué son las cookies?</h2>
        <p>Las cookies son pequeños archivos que se almacenan en su dispositivo para mejorar la experiencia de usuario y analizar el uso del sitio.</p>
      </section>
      <section className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Tipos de cookies</h2>
        <ul className="list-disc pl-6">
          <li><strong>Técnicas:</strong> Necesarias para el funcionamiento del sitio.</li>
          <li><strong>Analíticas:</strong> Permiten analizar el comportamiento de los usuarios.</li>
        </ul>
      </section>
      <section className="mb-4">
        <h2 className="text-xl font-semibold mb-2">¿Cómo borrar las cookies?</h2>
        <p>Puede eliminar las cookies desde la configuración de su navegador. Consulte la ayuda de su navegador para más información.</p>
      </section>
    </main>
  );
}
