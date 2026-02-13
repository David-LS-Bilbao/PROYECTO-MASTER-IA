# Scoring vNext (OSINT Alignment)

## Objetivo
Evitar confundir sesgo con veracidad y alinear la salida del analizador IA con un marco OSINT centrado en evidencia interna del texto.

## Cambios de contrato
- `biasRaw` se mantiene en rango `-10..+10`.
- `biasScoreNormalized` se define como `abs(biasRaw)/10` para UI.
- `reliabilityScore` se redefine como fiabilidad basada en evidencia interna del texto (no verdad factual externa).
- Nuevo `traceabilityScore` (`0..100`).
- Nuevo `factualityStatus`:
  - `no_determinable`
  - `plausible_but_unverified`
- Nuevo `evidence_needed: string[]`.
- Nuevo `should_escalate: boolean`.

## Escala de reliabilityScore
- `0-29`: clickbait/propaganda sin atribuciones.
- `30-49`: claims fuertes sin soporte, vaguedades.
- `50-69`: noticia estándar con soporte parcial.
- `70-84`: buena trazabilidad interna.
- `85-100`: excelente trazabilidad interna.

## Prompt vNext
- Se separa explícitamente:
  - `ANALISIS TEXTUAL`
  - `VERIFICACION FACTUAL`
- Se prohíbe inferir hechos externos.
- Se exige JSON estricto.
- Se añaden 2 few-shot cortos (clickbait vs artículo bien citado).
- El artículo se delimita con `<ARTICLE>...</ARTICLE>` y se trata como dato no confiable.

## Coste IA
- Prompt principal (`ANALYSIS_PROMPT_VNEXT`) incluye few-shot para estabilizar scoring.
- Se añade variante `ANALYSIS_PROMPT_LOW_COST` para reducir tokens cuando se prioriza coste.
- El sistema mantiene caché global de análisis (`article.isAnalyzed`) para evitar llamadas repetidas.

## Seguridad de prompt-injection
- Se elimina la sanitización agresiva que reemplazaba `{}`.
- Nuevo enfoque:
  - conservar el texto original del artículo (incluidas llaves).
  - neutralizar patrones típicos de inyección (`ignore previous instructions`, etc.).
  - escapar etiquetas `<ARTICLE>` si aparecen dentro del contenido.

## Compatibilidad
- Se conserva `biasScore` como alias legacy (normalizado 0..1).
- En caché legacy, el caso de uso normaliza análisis para completar campos vNext con defaults seguros.
