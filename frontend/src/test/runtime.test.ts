import { describe, it, expect } from 'vitest'

import {
  getApiBaseUrl,
  getSocketServerUrl,
} from '../config/runtime'

describe('runtime config', () => {
  it('uses a relative API base URL so dev proxy and production share one config', () => {
    expect(getApiBaseUrl()).toBe('/api')
  })

  it('uses the current app origin for socket connections', () => {
    expect(getSocketServerUrl()).toBe(window.location.origin)
  })
})
