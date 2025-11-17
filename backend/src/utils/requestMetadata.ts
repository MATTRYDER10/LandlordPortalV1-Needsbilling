import { Request } from 'express'

export interface NormalizedGeolocationPayload {
  latitude: number
  longitude: number
  accuracy?: number | null
  altitude?: number | null
  altitudeAccuracy?: number | null
  heading?: number | null
  speed?: number | null
  timestamp?: number | string | null
}

export const getClientIpAddress = (req: Request): string | null => {
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim()
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0]
  }

  if (req.socket?.remoteAddress) {
    return req.socket.remoteAddress
  }

  if (typeof req.ip === 'string' && req.ip.length > 0) {
    return req.ip
  }

  return null
}

export const normalizeGeolocationPayload = (payload: any): NormalizedGeolocationPayload | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const latitude = Number(payload.latitude)
  const longitude = Number(payload.longitude)

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null
  }

  const normalized: NormalizedGeolocationPayload = {
    latitude,
    longitude
  }

  const numericFields: Array<keyof NormalizedGeolocationPayload> = [
    'accuracy',
    'altitude',
    'altitudeAccuracy',
    'heading',
    'speed'
  ]

  numericFields.forEach((field) => {
    const value = payload[field]
    if (value !== undefined && value !== null && value !== '') {
      const numericValue = Number(value)
      if (!Number.isNaN(numericValue)) {
        normalized[field] = numericValue
      }
    }
  })

  if (payload.timestamp !== undefined && payload.timestamp !== null && payload.timestamp !== '') {
    normalized.timestamp = payload.timestamp
  }

  return normalized
}

