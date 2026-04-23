import { describe, expect, it } from 'vitest'
import { getCorsOrigin } from './cors'

describe('getCorsOrigin', () => {
  it('allows configured production origins and requests without an Origin header', () => {
    const origin = getCorsOrigin({
      nodeEnv: 'production',
      corsOrigins: 'https://example.com, http://1.2.3.4',
    })

    expect(origin('https://example.com')).toBe(true)
    expect(origin('http://1.2.3.4')).toBe(true)
    expect(origin(undefined)).toBe(true)
    expect(origin('https://evil.example')).toBe(false)
  })

  it('allows local development origins by default', () => {
    const origin = getCorsOrigin({ nodeEnv: 'development' })

    expect(origin('http://localhost:5173')).toBe(true)
    expect(origin('http://127.0.0.1:3000')).toBe(true)
    expect(origin('http://192.168.1.10:5173')).toBe(false)
  })
})
