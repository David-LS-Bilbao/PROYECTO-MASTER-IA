'use client';

export interface DeepAnalysisSections {
  known?: string[];
  unknown?: string[];
  quotes?: string[];
  risks?: string[];
}

interface DeepAnalysisPanelProps {
  sections?: DeepAnalysisSections;
}

export function DeepAnalysisPanel({ sections }: DeepAnalysisPanelProps) {
  if (!sections) {
    return null;
  }

  const known = Array.isArray(sections.known) ? sections.known : [];
  const unknown = Array.isArray(sections.unknown) ? sections.unknown : [];
  const quotes = Array.isArray(sections.quotes) ? sections.quotes : [];
  const risks = Array.isArray(sections.risks) ? sections.risks : [];
  const hasAnySection =
    known.length > 0 || unknown.length > 0 || quotes.length > 0 || risks.length > 0;

  if (!hasAnySection) {
    return null;
  }

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-white dark:bg-zinc-800">
      <h4 className="text-sm font-semibold">Analisis profundo</h4>

      {known.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Que sabemos</p>
          <ul className="mt-1 text-xs text-muted-foreground space-y-1">
            {known.map((item, index) => (
              <li key={`known-${index}`} className="flex items-start gap-2">
                <span aria-hidden>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {unknown.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Que no sabemos</p>
          <ul className="mt-1 text-xs text-muted-foreground space-y-1">
            {unknown.map((item, index) => (
              <li key={`unknown-${index}`} className="flex items-start gap-2">
                <span aria-hidden>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {quotes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Citas del articulo</p>
          <ul className="mt-1 text-xs text-muted-foreground space-y-1">
            {quotes.map((item, index) => (
              <li key={`quotes-${index}`} className="italic">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {risks.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Riesgos de interpretacion</p>
          <ul className="mt-1 text-xs text-muted-foreground space-y-1">
            {risks.map((item, index) => (
              <li key={`risks-${index}`} className="flex items-start gap-2">
                <span aria-hidden>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
