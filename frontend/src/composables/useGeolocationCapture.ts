import { onMounted, ref } from 'vue'

export interface GeolocationPayload {
    latitude: number
    longitude: number
    accuracy?: number | null
    altitude?: number | null
    altitudeAccuracy?: number | null
    heading?: number | null
    speed?: number | null
    timestamp?: number | null
}

export const useGeolocationCapture = (
    autoRequest = true,
    options: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
) => {
    const geolocation = ref<GeolocationPayload | null>(null)
    const geolocationError = ref<string | null>(null)
    const isSupported = typeof window !== 'undefined' && 'geolocation' in navigator

    const requestGeolocation = () => {
        if (!isSupported) {
            geolocationError.value = 'Geolocation is not supported on this device.'
            return
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                geolocation.value = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy ?? null,
                    altitude: position.coords.altitude ?? null,
                    altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
                    heading: position.coords.heading ?? null,
                    speed: position.coords.speed ?? null,
                    timestamp: position.timestamp ?? Date.now()
                }
                geolocationError.value = null
            },
            (error) => {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        geolocationError.value = 'Location permission denied by user.'
                        break
                    case error.POSITION_UNAVAILABLE:
                        geolocationError.value = 'Location information is unavailable.'
                        break
                    case error.TIMEOUT:
                        geolocationError.value = 'Location request timed out.'
                        break
                    default:
                        geolocationError.value = 'Unable to retrieve location.'
                }
            },
            options
        )
    }

    if (autoRequest) {
        onMounted(() => requestGeolocation())
    }

    return {
        geolocation,
        geolocationError,
        isGeolocationSupported: isSupported,
        requestGeolocation
    }
}

