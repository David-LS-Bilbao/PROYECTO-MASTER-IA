/**
 * Declaración de Accesibilidad
 * Conforme al Real Decreto 1112/2018 y Ley 11/2023
 * UNE-EN 301549 (Requisitos de accesibilidad para productos y servicios TIC)
 */

import React from 'react';
import { ChevronLeft, CheckCircle, AlertCircle, Mail, Calendar } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AccesibilidadPage() {
  const fechaActual = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                Declaración de Accesibilidad
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Compromiso con la accesibilidad digital
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 py-12 max-w-4xl">
        <div className="prose prose-zinc dark:prose-invert max-w-none">
          {/* Introducción */}
          <section className="mb-8 p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 text-blue-600 dark:text-blue-400 shrink-0 mt-1" aria-hidden="true" />
              <div>
                <h2 className="text-xl font-semibold mb-3 text-zinc-900 dark:text-white">
                  Compromiso de Accesibilidad
                </h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  <strong>Verity News</strong> se compromete a hacer accesible su sitio web de conformidad con el{' '}
                  <strong>Real Decreto 1112/2018</strong>, de 7 de septiembre, sobre accesibilidad de los sitios web
                  y aplicaciones para dispositivos móviles del sector público, y la <strong>Ley 11/2023</strong>{' '}
                  de transposición de Directivas de la Unión Europea.
                </p>
              </div>
            </div>
          </section>

          {/* Estado de Cumplimiento */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-white">
              Estado de Cumplimiento
            </h2>
            <div className="p-6 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                ✅ Parcialmente conforme con el RD 1112/2018
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Este sitio web es <strong>parcialmente conforme</strong> con los requisitos de la norma{' '}
                <strong>UNE-EN 301549:2022</strong> debido a las excepciones y/o el incumplimiento de los aspectos
                que se indican a continuación.
              </p>
            </div>
          </section>

          {/* Contenido Accesible */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-white">
              Características de Accesibilidad Implementadas
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    <strong>WCAG 2.1.1</strong> - Funcionalidad de Teclado
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Toda la interfaz es navegable mediante teclado sin necesidad de ratón.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    <strong>WCAG 1.4.4</strong> - Cambio de Tamaño de Texto
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    El texto puede escalarse hasta el 200% sin pérdida de contenido o funcionalidad.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    <strong>WCAG 2.3.3</strong> - Animaciones desde Interacciones
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Se proporciona un control para reducir/desactivar animaciones (prefers-reduced-motion).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    <strong>WCAG 1.4.3</strong> - Contraste Mínimo
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Se garantiza un contraste de al menos 4.5:1 en textos y 3:1 en componentes de interfaz.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    <strong>WCAG 2.4.7</strong> - Foco Visible
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Los elementos interactivos muestran un indicador visual claro al recibir el foco.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    <strong>Ancho de Lectura Configurable</strong>
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Se permite limitar el ancho de columnas de texto para ayudar con dislexia y concentración.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Contenido No Accesible */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-white">
              Contenido No Accesible
            </h2>
            <div className="p-6 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                    Excepciones conocidas:
                  </p>
                  <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 dark:text-amber-400 mt-1">•</span>
                      <span>
                        <strong>Imágenes de noticias RSS:</strong> Algunas imágenes provenientes de fuentes externas
                        pueden carecer de texto alternativo descriptivo.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 dark:text-amber-400 mt-1">•</span>
                      <span>
                        <strong>Contenido de terceros:</strong> Los artículos enlazados desde fuentes externas pueden
                        no cumplir con los estándares de accesibilidad.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 dark:text-amber-400 mt-1">•</span>
                      <span>
                        <strong>Gráficos dinámicos:</strong> Los gráficos de análisis de sesgo pueden tener contraste
                        insuficiente en algunos estados.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-4">
                Estamos trabajando activamente para solucionar estas limitaciones en próximas actualizaciones.
              </p>
            </div>
          </section>

          {/* Preparación de la Declaración */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-white">
              Preparación de la Declaración
            </h2>
            <div className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-start gap-3 mb-4">
                <Calendar className="h-5 w-5 text-zinc-600 dark:text-zinc-400 shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    Esta declaración fue preparada el <strong>{fechaActual}</strong>.
                  </p>
                </div>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-3">
                <strong>Método empleado:</strong> Autoevaluación llevada a cabo por el equipo de desarrollo siguiendo
                la metodología de evaluación WCAG-EM 1.0 y las Pautas de Accesibilidad para el Contenido Web (WCAG) 2.1.
              </p>
            </div>
          </section>

          {/* Observaciones y Contacto */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-white">
              Observaciones y Contacto
            </h2>
            <div className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-zinc-600 dark:text-zinc-400 shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <p className="text-zinc-700 dark:text-zinc-300 mb-3">
                    Si encuentra alguna barrera de accesibilidad en el sitio web, puede reportarla a través de:
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-white">Email:</span>
                      <a
                        href="mailto:accesibilidad@veritynews.com"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        accesibilidad@veritynews.com
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-white">Formulario:</span>
                      <Link
                        href="/contacto"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Formulario de contacto
                      </Link>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-4">
                    Nos comprometemos a responder en un plazo máximo de <strong>20 días hábiles</strong> y a tomar las
                    medidas necesarias para solucionar los problemas reportados.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Procedimiento de Aplicación */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-white">
              Procedimiento de Aplicación
            </h2>
            <div className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                Si, tras enviar su solicitud de accesibilidad a través de los medios mencionados, no está satisfecho
                con la respuesta, puede dirigirse a la{' '}
                <a
                  href="https://www.inclusion.gob.es/oberaxe/es/index.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Dirección General de Derechos de las Personas con Discapacidad
                </a>{' '}
                del Ministerio de Derechos Sociales y Agenda 2030, conforme a lo establecido en el artículo 25 del
                Real Decreto 1112/2018.
              </p>
            </div>
          </section>

          {/* Información Adicional */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-white">
              Información Adicional
            </h2>
            <div className="space-y-3">
              <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                  Normas Aplicadas
                </h3>
                <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
                  <li>• Real Decreto 1112/2018, de 7 de septiembre</li>
                  <li>• Ley 11/2023, de 8 de mayo</li>
                  <li>• UNE-EN 301549:2022 (Requisitos de accesibilidad para productos TIC)</li>
                  <li>• WCAG 2.1 Nivel AA (Web Content Accessibility Guidelines)</li>
                </ul>
              </div>

              <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                  Ajustes de Accesibilidad
                </h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-2">
                  Puede personalizar su experiencia de navegación en la{' '}
                  <Link href="/settings" className="text-blue-600 dark:text-blue-400 hover:underline">
                    página de Ajustes
                  </Link>
                  , donde encontrará opciones para:
                </p>
                <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
                  <li>• Ajustar el tamaño de fuente (4 niveles)</li>
                  <li>• Reducir animaciones y transiciones</li>
                  <li>• Limitar el ancho de lectura (ayuda con dislexia)</li>
                  <li>• Cambiar tema (claro/oscuro/sistema)</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
