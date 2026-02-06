import React from "react";

export default function PoliticaPrivacidadPage() {
  return (
    <main className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Política de Privacidad</h1>
      <section className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Responsable</h2>
        <p>[NOMBRE_EMPRESA], CIF [CIF], domicilio en [DIRECCIÓN], email [EMAIL].</p>
      </section>
      <section className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Finalidad</h2>
        <p>Los datos personales recabados serán utilizados para [FINALIDAD], conforme a la normativa vigente.</p>
      </section>
      <section className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Legitimación</h2>
        <p>La base legal para el tratamiento de sus datos es [BASE_LEGAL].</p>
      </section>
      <section className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Destinatarios</h2>
        <p>Sus datos podrán ser comunicados a [DESTINATARIOS] para cumplir con las obligaciones legales.</p>
      </section>
      <section className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Derechos</h2>
        <p>Puede ejercer sus derechos de acceso, rectificación, supresión, oposición y portabilidad enviando un email a [EMAIL].</p>
      </section>
    </main>
  );
}
