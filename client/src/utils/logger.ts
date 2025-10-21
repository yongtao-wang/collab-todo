// client/src/utils/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const isDev = process.env.NODE_ENV !== 'production'

function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').split('.')[0]
}

function log(module: string, level: LogLevel, ...args: unknown[]) {
  const timestamp = getTimestamp()
  const prefix = `[${timestamp}][${level.toUpperCase()}][${module}]`

  if (isDev) {
    console[level === 'debug' ? 'log' : level](prefix, ...args)
  } else {
    if (level === 'warn' || level === 'error') {
      console[level](prefix, ...args)
    }
  }
}

export function createLogger(module: string) {
  return {
    debug: (...args: unknown[]) => log(module, 'debug', ...args),
    info: (...args: unknown[]) => log(module, 'info', ...args),
    warn: (...args: unknown[]) => log(module, 'warn', ...args),
    error: (...args: unknown[]) => log(module, 'error', ...args),
  }
}
