type LogMethod = (context: Record<string, unknown> | undefined, message: string) => void;

function shouldLog(): boolean {
  return process.env.NODE_ENV !== 'test';
}

function buildLoggerMethod(level: 'info' | 'warn' | 'error', module: string): LogMethod {
  return (context, message) => {
    if (!shouldLog()) {
      return;
    }

    const payload = context ? ` ${JSON.stringify(context)}` : '';
    const line = `[${level.toUpperCase()}][${module}] ${message}${payload}`;

    if (level === 'error') {
      console.error(line);
      return;
    }

    if (level === 'warn') {
      console.warn(line);
      return;
    }

    console.log(line);
  };
}

export function createModuleLogger(module: string): {
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
} {
  return {
    info: buildLoggerMethod('info', module),
    warn: buildLoggerMethod('warn', module),
    error: buildLoggerMethod('error', module),
  };
}
