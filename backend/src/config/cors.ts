const developmentOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]

type CorsConfig = {
  nodeEnv?: string
  corsOrigins?: string
}

export function getAllowedOrigins(config: CorsConfig = {}): string[] {
  if (config.nodeEnv !== 'production') {
    return developmentOrigins
  }

  return (config.corsOrigins ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
}

export function getCorsOrigin(config: CorsConfig = {}) {
  const allowedOrigins = getAllowedOrigins(config)

  return (origin?: string): boolean => {
    if (!origin) {
      return true
    }

    if (config.nodeEnv === 'production' && allowedOrigins.length === 0) {
      return true
    }

    return allowedOrigins.includes(origin)
  }
}
