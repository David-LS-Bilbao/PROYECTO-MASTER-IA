# Sprint 25: AI Prompt Improvements

**Fecha**: 2026-02-09
**Objetivo**: Implementar mejoras críticas en los prompts de IA para reducir alucinaciones y mejorar la calidad de análisis basados en evidencias.

---

## 🎯 Contexto

Los prompts de IA actuales (v4) presentaban dos problemas principales:
1. **Análisis de artículos**: Scores de confiabilidad poco rigurosos, permitiendo puntuaciones altas sin evidencia de fuentes verificables
2. **Chat RAG**: Tendencia a usar conocimiento general para "rellenar huecos" cuando el contexto no contenía información suficiente

---

## 📋 Mejoras Implementadas

### 1. Evidence-Based Scoring (Análisis de Artículos)

**Archivo**: `backend/src/infrastructure/external/prompts/analysis.prompt.ts`

#### Cambios:

1. **Restricción Global Añadida**:
   ```
   ANALIZA SOLO EL TEXTO PROPORCIONADO.
   NO AÑADAS INFORMACIÓN EXTERNA NI ASUMAS CONTEXTO NO ESCRITO.
   Actúa como un auditor de desinformación estricto.
   ```

2. **Internal Reasoning Refactorizado** (Max 300 chars):
   - ❓ ¿Cita fuentes verificables (nombres, estudios, enlaces)?
   - ❓ ¿Usa lenguaje emocional/subjetivo?
   - ❓ ¿Hay datos fácticos o solo opiniones?

3. **ReliabilityScore con Reglas Estrictas** (0-100):
   - **< 40**: Clickbait, opinión sin datos, lenguaje incendiario, falta de fuentes
   - **40-60**: Noticia estándar sin citas externas claras
   - **60-80**: Cita fuentes genéricas ("según expertos")
   - **> 80**: SOLO si tiene citas directas a organismos oficiales, estudios científicos o enlaces verificables

4. **BiasScore Justificado**:
   - Ahora requiere justificación explícita en `analysis.explanation` basándose en selección de hechos y adjetivos

#### Resultados de Verificación:

Script de testing: `backend/scripts/verify-analysis-rules.ts`

| Test Case            | Score | Expected | Status     |
|----------------------|-------|----------|------------|
| Opinion/Low Quality  | 20    | < 50     | ✅ PASS    |
| Fact/High Quality    | 95    | > 80     | ✅ PASS    |

**Reasoning Opinion (Score 20)**:
> No cita fuentes verificables (nombres, estudios, enlaces). Usa lenguaje altamente emocional y subjetivo ("desastre", "nos arruinan", "harta", "mentiras"). Contiene solo opiniones y generalizaciones ("Todo el mundo lo sabe"), sin datos fácticos ni pruebas.

**Reasoning Fact (Score 95)**:
> Cita fuentes oficiales verificables (INE, Agencia EFE) y un informe específico (mensual del INE). Usa lenguaje objetivo y neutro, sin adjetivos emocionales ni juicios de valor. Presenta datos fácticos (porcentajes) y atribuye las causas directamente al organismo oficial.

---

### 2. Zero Hallucination Strategy (Chat RAG)

**Archivo**: `backend/src/infrastructure/external/prompts/rag-chat.prompt.ts`

**Versión**: v4 → **v5 (Zero Hallucination Strategy)**

#### Cambios:

1. **Output Length Aumentado**:
   - Límite: 120 palabras → **150 palabras**
   - Razón: Permite explicaciones matizadas cuando no hay datos suficientes

2. **System Persona Añadido**:
   ```
   Actúa como un Analista de Inteligencia riguroso.
   Tu única fuente de verdad es el contexto proporcionado.
   ```

3. **Regla #3 Reemplazada - Incertidumbre Radical**:

   **Antes (Silencio Positivo)**:
   - "Si pregunta irrelevante → responde SOLO: 'No hay información en este artículo...'"

   **Ahora (Incertidumbre Radical)**:
   - "Si la respuesta no se puede derivar EXPLÍCITA y EXCLUSIVAMENTE de los fragmentos de contexto proporcionados (context), responde: 'El contexto disponible no contiene datos suficientes para responder a esta pregunta específica.' **NO uses tu conocimiento general para rellenar huecos.**"

4. **Regla #4 Añadida - Trazabilidad Forzada**:
   ```
   TRAZABILIDAD: Cada afirmación debe estar respaldada por una cita
   al final de la frase en formato [x]. Si una frase no puede ser citada, elimínala.
   ```

5. **Regla de Formato Movida** (ahora #5):
   - Formato: bullets si >2 puntos, **negrita** cifras clave

#### Resultados de Verificación:

Script de testing: `backend/scripts/verify-rag-rules.ts`

| Test Case                       | Refused | Expected      | Status     |
|---------------------------------|---------|---------------|------------|
| Answerable (Context Available) | NO      | Should answer | ✅ PASS    |
| The Trap (External Knowledge)  | YES     | Should refuse | ✅ PASS    |

**Test 1 - Context Available**:
- **Pregunta**: "¿Dónde se fundó Verity News?"
- **Contexto**: "Verity News es una startup fundada en 2026 en Bilbao..."
- **Respuesta**: "Verity News fue fundada en Bilbao [1]."
- **Comportamiento**: ✅ Respondió correctamente con citación

**Test 2 - The Trap** (⚠️ Crítico):
- **Pregunta**: "¿Quién ganó el Mundial de Fútbol de 2010?"
- **Contexto**: (No contiene información sobre el Mundial)
- **TRAP**: El modelo SABE que España ganó, pero NO está en el contexto
- **Respuesta**: "El contexto disponible no contiene datos suficientes para responder a esta pregunta específica."
- **Comportamiento**: ✅ Se negó correctamente a usar conocimiento externo

---

### 3. Safe Web Searching (Grounding Chat)

**Archivo**: `backend/src/infrastructure/external/prompts/grounding-chat.prompt.ts`

**Versión**: v1 → **v2 (System Persona para búsquedas web seguras)**

#### Cambios:

**System Persona Añadido** (al inicio del prompt):
```
SYSTEM: Eres un asistente de noticias veraz y escéptico.
Al usar información de Google Search, prioriza fuentes oficiales
(gobierno, instituciones) y medios de comunicación reputados.
Si encuentras información contradictoria, expón ambas versiones
citando el origen. Ignora blogs personales no verificables o
foros de opinión. Tu tono es periodístico y neutral.
```

#### Objetivo:

Cuando el chat usa Google Search Grounding (búsqueda en tiempo real), el modelo ahora:
- ✅ **Prioriza fuentes oficiales** (gobierno, instituciones)
- ✅ **Valora medios reputados** sobre blogs personales
- ✅ **Expone versiones contradictorias** citando orígenes
- ✅ **Mantiene tono periodístico neutral**
- ❌ **Ignora foros de opinión** no verificables

---

## 🧪 Testing

### Scripts de Verificación

#### 1. Evidence-Based Scoring

**Ubicación**: `backend/scripts/verify-analysis-rules.ts`

**Uso**:
```bash
npx tsx backend/scripts/verify-analysis-rules.ts
```

**Funcionalidad**:
- Prueba el prompt de análisis con 2 casos de prueba predefinidos
- Valida que los scores cumplan con las nuevas reglas estrictas
- Muestra reasoning detallado para cada caso

**Resultados**: ✅ 2/2 tests pasados (Opinion: 20, Fact: 95)

#### 2. Zero Hallucination Strategy

**Ubicación**: `backend/scripts/verify-rag-rules.ts` **(NUEVO)**

**Uso**:
```bash
npx tsx backend/scripts/verify-rag-rules.ts
```

**Funcionalidad**:
- Prueba la regla de "Incertidumbre Radical"
- Verifica que el modelo se niega a usar conocimiento externo
- Valida que responde correctamente cuando hay contexto disponible

**Resultados**: ✅ 2/2 tests pasados (Context: OK, Trap: Refused)

---

## 🎯 Impacto Esperado

### Análisis de Artículos (Evidence-Based Scoring):
- ✅ Penaliza correctamente opiniones sin fuentes (Score: 20)
- ✅ Recompensa artículos con fuentes oficiales verificables (Score: 95)
- ✅ El `internal_reasoning` muestra claramente el proceso de evaluación
- ✅ Reduce significativamente la asignación de scores altos a contenido no verificado

### Chat RAG (Zero Hallucination):
- ❌ **No puede alucinar** respuestas usando conocimiento general
- ✅ **Admite ignorancia** cuando el contexto no tiene la información
- 📌 **Cada frase debe estar citada** o será eliminada
- 🔍 **Trazabilidad total** de cada afirmación al fragmento de contexto original

### Grounding Chat (Safe Web Searching):
- ✅ **Prioriza fuentes oficiales** (gobierno, instituciones) en búsquedas web
- ✅ **Valora medios reputados** sobre blogs personales
- ⚖️ **Expone versiones contradictorias** citando orígenes
- 📰 **Tono periodístico neutral** en todas las respuestas
- ❌ **Ignora foros de opinión** no verificables

---

## 📁 Archivos Modificados

### Backend
- `backend/src/infrastructure/external/prompts/analysis.prompt.ts` - Evidence-Based Scoring (v5)
- `backend/src/infrastructure/external/prompts/rag-chat.prompt.ts` - Zero Hallucination Strategy (v5)
- `backend/src/infrastructure/external/prompts/grounding-chat.prompt.ts` - Safe Web Searching (v2)

### Testing
- `backend/scripts/verify-analysis-rules.ts` (NUEVO) - Script de verificación Analysis
- `backend/scripts/verify-rag-rules.ts` (NUEVO) - Script de verificación RAG

---

## 📚 Documentación Relacionada

- **MEMORY.md**: Actualizado con reglas de Evidence-Based Scoring y Zero Hallucination
- **Sprint-17-COST_OPTIMIZATION.md**: Contexto sobre optimización de prompts anteriores
- **analysis.prompt.ts CHANGELOG**: Versión v4 → v5 (Evidence-Based Scoring)
- **rag-chat.prompt.ts CHANGELOG**: Versión v4 → v5 (Zero Hallucination Strategy)
- **grounding-chat.prompt.ts CHANGELOG**: Versión v1 → v2 (Safe Web Searching)

---

## 🚀 Próximos Pasos

1. **Monitoreo de Scores**: Observar distribución de `reliabilityScore` en artículos reales
2. **A/B Testing**: Comparar calidad de respuestas RAG (v4 vs v5)
3. **Ajuste de Umbrales**: Si es necesario, refinar rangos de scores basándose en datos reales
4. **Documentación Usuario**: Añadir explicación de scores en frontend

---

## ✅ Checklist de Implementación

- [x] Actualizar `analysis.prompt.ts` con Evidence-Based Scoring
- [x] Actualizar `rag-chat.prompt.ts` con Zero Hallucination Strategy
- [x] Actualizar `grounding-chat.prompt.ts` con Safe Web Searching
- [x] Crear script de verificación `verify-analysis-rules.ts`
- [x] Crear script de verificación `verify-rag-rules.ts`
- [x] Ejecutar tests y validar resultados (4/4 tests PASS)
- [x] Actualizar MEMORY.md con nuevas reglas
- [x] Documentar cambios en Sprint-25

---

## 📊 Métricas de Éxito

**KPIs a monitorizar**:
1. **Distribución de reliabilityScore**: % de artículos en cada rango (< 40, 40-60, 60-80, > 80)
2. **Tasa de "No sé" en Chat RAG**: % de respuestas que admiten falta de información
3. **Citaciones por Respuesta**: Promedio de citas [x] en respuestas RAG
4. **Feedback de Usuarios**: Confianza percibida en análisis y respuestas de chat

---

**Estado**: ✅ Completado
**Revisión**: Pendiente validación con datos reales en producción
