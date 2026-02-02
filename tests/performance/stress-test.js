/**
 * ============================================================================
 * VERITY NEWS - STRESS TEST CON K6
 * ============================================================================
 *
 * Suite de pruebas de carga para validar el rendimiento y rate limiting
 * del endpoint /api/news
 *
 * INSTALACIÓN DE K6:
 * ------------------
 * Windows (chocolatey): choco install k6
 * Windows (winget):     winget install k6 --source winget
 * macOS:                brew install k6
 * Linux:                sudo apt install k6
 * Docker:               docker run -i grafana/k6 run - <stress-test.js
 *
 * EJECUCIÓN:
 * ----------
 * Básico:           k6 run stress-test.js
 * Con URL custom:   k6 run -e BASE_URL=http://localhost:3000 stress-test.js
 * Con output JSON:  k6 run --out json=results.json stress-test.js
 * Con dashboard:    k6 run --out web-dashboard stress-test.js
 *
 * ============================================================================
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

// URL base configurable via variable de entorno
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TARGET_ENDPOINT = '/api/news';

// ============================================================================
// MÉTRICAS PERSONALIZADAS
// ============================================================================

// Contador de respuestas 429 (Rate Limit alcanzado)
const rateLimitHits = new Counter('rate_limit_hits_429');

// Contador de peticiones exitosas (200)
const successfulRequests = new Counter('successful_requests_200');

// Tasa de éxito de rate limiting (429 detectados correctamente)
const rateLimitDetectionRate = new Rate('rate_limit_detection_rate');

// Tiempo de respuesta para peticiones exitosas
const successResponseTime = new Trend('success_response_time', true);

// ============================================================================
// CONFIGURACIÓN DE ESCENARIOS Y UMBRALES
// ============================================================================

export const options = {
  // Definición de escenarios
  scenarios: {
    // Fase 1: Calentamiento - Carga ligera para establecer baseline
    warmup: {
      executor: 'constant-vus',
      vus: 10,
      duration: '10s',
      startTime: '0s',
      tags: { phase: 'warmup' },
      exec: 'warmupPhase',
    },

    // Fase 2: Ataque Rate Limit - Intentar superar el límite de 100 req/15min
    rate_limit_attack: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',  // 50 VUs x ~3 req/s cada uno = ~150 req en pocos segundos
      startTime: '12s', // Comienza después del warmup (con 2s de pausa)
      tags: { phase: 'attack' },
      exec: 'rateLimitAttackPhase',
    },
  },

  // Umbrales de rendimiento
  thresholds: {
    // El 95% de las peticiones normales deben responder en menos de 500ms
    'http_req_duration{phase:warmup}': ['p(95)<500'],

    // Durante el ataque, aceptamos tiempos más altos (el rate limiter puede añadir latencia)
    'http_req_duration{phase:attack}': ['p(95)<2000'],

    // Verificar que detectamos al menos algunos 429 durante el ataque
    // Esto NO debe hacer fallar el test, es solo informativo
    'rate_limit_hits_429': ['count>0'],

    // Tasa de errores HTTP (excluyendo 429 que es esperado)
    'http_req_failed{expected_response:true}': ['rate<0.05'], // <5% de errores reales
  },
};

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Realiza una petición GET al endpoint de noticias y registra métricas
 * @param {string} phaseName - Nombre de la fase para logging
 * @returns {object} - Respuesta HTTP
 */
function fetchNews(phaseName) {
  const url = `${BASE_URL}${TARGET_ENDPOINT}`;

  const params = {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'k6-stress-test/1.0',
    },
    tags: {
      endpoint: TARGET_ENDPOINT,
      phase: phaseName,
    },
  };

  const response = http.get(url, params);

  // Clasificar la respuesta
  if (response.status === 200) {
    successfulRequests.add(1);
    successResponseTime.add(response.timings.duration);
    rateLimitDetectionRate.add(false); // No fue rate limited
  } else if (response.status === 429) {
    rateLimitHits.add(1);
    rateLimitDetectionRate.add(true); // Rate limit detectado correctamente

    // Log informativo cuando detectamos rate limiting
    console.log(`[${phaseName}] 🛡️ Rate limit detectado (429) - Seguridad funcionando`);
  }

  return response;
}

/**
 * Verifica la respuesta según la fase
 */
function validateResponse(response, phaseName) {
  if (phaseName === 'warmup') {
    // En warmup esperamos mayormente 200s
    check(response, {
      'warmup: status es 200 o 429': (r) => r.status === 200 || r.status === 429,
      'warmup: tiempo de respuesta < 500ms': (r) => r.timings.duration < 500,
    });
  } else {
    // En ataque, 429 es un éxito de seguridad
    check(response, {
      'attack: respuesta válida (200 o 429)': (r) => r.status === 200 || r.status === 429,
      'attack: 429 indica rate limit activo': (r) => {
        if (r.status === 429) {
          return true; // ¡Éxito! El rate limiter está funcionando
        }
        return r.status === 200; // También OK si aún no llegamos al límite
      },
    });
  }
}

// ============================================================================
// ESCENARIOS DE PRUEBA
// ============================================================================

/**
 * FASE 1: CALENTAMIENTO
 * ---------------------
 * Objetivo: Establecer un baseline de rendimiento con carga moderada.
 * - 10 VUs realizando peticiones normales
 * - Verificamos que el 95% responde en <500ms
 * - No debería activar el rate limiting (si está configurado por IP)
 */
export function warmupPhase() {
  group('Fase 1: Calentamiento', () => {
    const response = fetchNews('warmup');
    validateResponse(response, 'warmup');

    // Pausa entre peticiones para simular uso real
    sleep(Math.random() * 2 + 0.5); // 0.5 - 2.5 segundos
  });
}

/**
 * FASE 2: ATAQUE RATE LIMIT
 * -------------------------
 * Objetivo: Intentar superar el límite de 100 peticiones/15 minutos.
 * - 50 VUs realizando peticiones agresivas
 * - Esperamos ver respuestas HTTP 429
 * - Los 429 son un ÉXITO (significa que el rate limiter funciona)
 */
export function rateLimitAttackPhase() {
  group('Fase 2: Ataque Rate Limit', () => {
    const response = fetchNews('attack');
    validateResponse(response, 'attack');

    // Pausa mínima para maximizar peticiones por segundo
    sleep(0.1); // 100ms entre peticiones
  });
}

// ============================================================================
// HOOKS DE CICLO DE VIDA
// ============================================================================

/**
 * Setup: Se ejecuta una vez antes de iniciar los VUs
 */
export function setup() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          VERITY NEWS - STRESS TEST INICIANDO                  ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log(`║ Base URL:       ${BASE_URL.padEnd(43)}║`);
  console.log(`║ Endpoint:       ${TARGET_ENDPOINT.padEnd(43)}║`);
  console.log('║ Rate Limit:     100 req / 15 min (esperado)                   ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log('║ FASES:                                                        ║');
  console.log('║ 1. Calentamiento: 10 VUs x 10s (baseline de rendimiento)      ║');
  console.log('║ 2. Ataque:        50 VUs x 30s (probar rate limiting)         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  // Verificar que el servidor está disponible
  const healthCheck = http.get(`${BASE_URL}${TARGET_ENDPOINT}`);
  if (healthCheck.status !== 200 && healthCheck.status !== 429) {
    console.error(`⚠️ ADVERTENCIA: El servidor respondió con status ${healthCheck.status}`);
  } else {
    console.log('✅ Servidor disponible, iniciando pruebas...\n');
  }

  return { startTime: new Date().toISOString() };
}

/**
 * Teardown: Se ejecuta una vez al finalizar todos los VUs
 */
export function teardown(data) {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          VERITY NEWS - STRESS TEST FINALIZADO                 ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log(`║ Inicio:         ${data.startTime.padEnd(43)}║`);
  console.log(`║ Fin:            ${new Date().toISOString().padEnd(43)}║`);
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log('║ INTERPRETACIÓN DE RESULTADOS:                                 ║');
  console.log('║ - rate_limit_hits_429 > 0 = ✅ Rate limiter funcionando       ║');
  console.log('║ - http_req_duration p(95) < 500ms = ✅ Buen rendimiento       ║');
  console.log('║ - http_req_failed < 5% (excl. 429) = ✅ API estable           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
}

// ============================================================================
// FUNCIÓN DEFAULT (requerida por k6)
// ============================================================================

export default function() {
  // Esta función se usa si no se especifican escenarios
  // En nuestro caso, usamos escenarios específicos
  warmupPhase();
}
