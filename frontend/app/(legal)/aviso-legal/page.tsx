import React from "react";

export default function AvisoLegalPage() {
  return (
    <main className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Aviso Legal</h1>

      {/* Naturaleza del Proyecto */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Naturaleza del Proyecto</h2>
        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <strong>Verity News</strong> es un proyecto académico de demostración técnica desarrollado como{" "}
          <strong>Trabajo Final de Máster</strong> sin fines de lucro comercial directos. Su objetivo es
          demostrar capacidades de análisis de sesgo e inteligencia artificial aplicadas al periodismo digital,
          con propósitos estrictamente educativos y de investigación.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Titular</h2>
        <p className="text-zinc-700 dark:text-zinc-300">
          Este sitio web, Verity News, es propiedad de <strong>David Lopez Sotelo</strong>, con CIF 78874938-A
          y domicilio en Galdakao, Bizkaia.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Datos Identificativos</h2>
        <p className="text-zinc-700 dark:text-zinc-300">
          Contacto: <a href="mailto:lopezsotelo77@gmail.com" className="text-blue-600 hover:underline dark:text-blue-400">lopezsotelo77@gmail.com</a> |
          Teléfono: 605279603
        </p>
      </section>

      {/* Propiedad Intelectual - Modificado */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Propiedad Intelectual</h2>

        <h3 className="text-lg font-medium mb-2 mt-4">Del Sistema y Código</h3>
        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-3">
          El <strong>código fuente, diseño visual, algoritmos de análisis de sesgo y arquitectura del sistema</strong> de
          Verity News son propiedad exclusiva de David Lopez Sotelo. Queda prohibida su reproducción, distribución
          o explotación comercial sin autorización expresa por escrito del titular.
        </p>

        <h3 className="text-lg font-medium mb-2 mt-4">Del Contenido de Noticias</h3>
        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <strong>Los titulares, fragmentos de texto e imágenes de las noticias mostradas pertenecen a sus
          respectivos autores y medios de comunicación originales.</strong> Verity News actúa como un{" "}
          <strong>agregador y analizador de contenido</strong>, facilitando siempre el enlace directo a la
          fuente original mediante el botón "Leer artículo completo".
        </p>
        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-2">
          No reclamamos ningún derecho de autor sobre los contenidos periodísticos originales. El uso de dichos
          contenidos se realiza bajo el amparo de:
        </p>
        <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 ml-4 mt-2 space-y-1">
          <li>Finalidad académica y de investigación (uso legítimo en contexto educativo)</li>
          <li>Citación de fuente original en cada artículo mostrado</li>
          <li>Enlace directo a la publicación original para lectura completa</li>
          <li>Agregación mediante feeds RSS públicos proporcionados por los propios medios</li>
        </ul>
      </section>

      {/* Uso de Fuentes y Tratamiento de Datos */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Uso de Fuentes RSS y Almacenamiento</h2>
        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
          La aplicación utiliza <strong>feeds RSS públicos</strong> proporcionados voluntariamente por los medios
          de comunicación con fines de difusión. El sistema procesa estos contenidos para:
        </p>
        <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 ml-4 mt-2 space-y-1">
          <li>Análisis de sesgo mediante inteligencia artificial (Gemini API)</li>
          <li>Generación de embeddings vectoriales para búsqueda semántica</li>
          <li>Extracción de metadatos (autor, fecha, fuente, categoría)</li>
        </ul>
        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-3">
          <strong>No se almacena el contenido íntegro de las noticias</strong> en la base de datos del sistema,
          sino únicamente los vectores matemáticos (embeddings), metadatos estructurados y análisis de IA necesarios
          para el funcionamiento del servicio. El contenido completo se mantiene en las fuentes originales,
          accesibles mediante los enlaces proporcionados.
        </p>
      </section>

      {/* Derechos de los Medios */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Derechos de los Medios de Comunicación</h2>
        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
          Si un medio de comunicación desea que sus contenidos no sean indexados o analizados por Verity News,
          puede contactar con nosotros a través de{" "}
          <a href="mailto:lopezsotelo77@gmail.com" className="text-blue-600 hover:underline dark:text-blue-400">
            lopezsotelo77@gmail.com
          </a>{" "}
          y procederemos a su exclusión inmediata del sistema en un plazo máximo de 48 horas.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Exclusión de Garantías y Responsabilidad</h2>
        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
          Verity News no se responsabiliza de:
        </p>
        <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 ml-4 mt-2 space-y-1">
          <li>La exactitud, veracidad o actualización de los contenidos periodísticos originales</li>
          <li>Los análisis de sesgo generados por IA (orientativos, no constituyen juicio definitivo)</li>
          <li>La disponibilidad permanente del sitio web o sus servicios</li>
          <li>Daños derivados del uso de la información publicada</li>
          <li>Enlaces rotos o contenidos eliminados por los medios originales</li>
        </ul>
        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-3">
          Los análisis de sesgo son generados automáticamente por algoritmos de inteligencia artificial y deben
          considerarse como <strong>herramienta orientativa</strong>, no como verdad absoluta. Se recomienda
          siempre el pensamiento crítico y la consulta de múltiples fuentes.
        </p>
      </section>

      {/* Legislación Aplicable */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Legislación Aplicable</h2>
        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
          El presente aviso legal se rige por la legislación española, en particular:
        </p>
        <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 ml-4 mt-2 space-y-1">
          <li>Ley 34/2002, de Servicios de la Sociedad de la Información y Comercio Electrónico (LSSI-CE)</li>
          <li>Real Decreto Legislativo 1/1996, de Propiedad Intelectual (TRLPI)</li>
          <li>Reglamento General de Protección de Datos (RGPD UE 2016/679)</li>
        </ul>
      </section>

      <footer className="mt-8 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500 dark:text-zinc-400">
        <p>Última actualización: Febrero 2026</p>
        <p className="mt-1">
          Para cualquier consulta relacionada con el aviso legal, contacte en{" "}
          <a href="mailto:lopezsotelo77@gmail.com" className="text-blue-600 hover:underline dark:text-blue-400">
            lopezsotelo77@gmail.com
          </a>
        </p>
      </footer>
    </main>
  );
}
