import React from "react";

export default function AvisoLegalPage() {
  return (
    <main className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Aviso Legal</h1>
      <section className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Titular</h2>
        <p>Este sitio web, Verity News, es propiedad de [NOMBRE_EMPRESA], con CIF [CIF] y domicilio en [DIRECCIÓN].</p>
      </section>
      <section className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Datos Identificativos</h2>
        <p>Contacto: [EMAIL] | Teléfono: [TELÉFONO]</p>
      </section>
      <section className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Propiedad Intelectual</h2>
        <p>Todos los contenidos de este sitio web (textos, imágenes, logotipos, etc.) son propiedad de [NOMBRE_EMPRESA] o de sus licenciantes. Queda prohibida su reproducción total o parcial sin autorización expresa.</p>
      </section>
      <section className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Exclusión de Garantías</h2>
        <p>Verity News no se responsabiliza de los daños derivados del uso de la información publicada ni garantiza la disponibilidad permanente del sitio.</p>
      </section>
    </main>
  );
}
