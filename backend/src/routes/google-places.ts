import { Router } from 'express'

interface Predictions {
    description :string;
    place_id :string;
    reference :string;
};

interface AutocompleteResponse {
    predictions :Predictions[];
    status :string;
};

interface DetailsResult {
    address_components :{long_name:string,short_name:string,types:string[]}[];
    formatted_address :string;
    name :string;
    geometry?: {
        location: {
            lat: number;
            lng: number;
        }
    }
}

interface DetailsResponse {
    result :DetailsResult;
    status :string;
};

const GOOGLE_PLACES_API = "https://maps.googleapis.com/maps/api/place/autocomplete/json";
const GOOGLE_PLACES_DETAILS_API = "https://maps.googleapis.com/maps/api/place/details/json";
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const router = Router();

router.get('/autocomplete', async (req, res) => {
    const  input  = req.query?.input as string;
    if (!input) {
        return res.status(400).json({ error: 'Input is required' });
    }

    try {
        if (!GOOGLE_API_KEY) throw new Error("Google api key not found in env!");
        const searchParams = {
            key: GOOGLE_API_KEY,
            input,
            radius: "500",
            components: "country:gb"
        };
        const searchQuery = new URLSearchParams(searchParams).toString();

        const predictions = await fetch(`${GOOGLE_PLACES_API}?${searchQuery}`);
        if (!predictions.ok) throw new Error(predictions.statusText);

        const parsedRes = await predictions.json() as AutocompleteResponse;
        const places = parsedRes?.predictions;
        if (!Array.isArray(places) || !places.length) throw new Error(parsedRes?.status || "No place found related to the search");
        return res.status(200).json(places);
    }
    catch (e: unknown) {
        console.warn("Error while finding places:", e);
        return res.status(500).json({ error: (e as Error)?.message || "Internal server error" });
    }
});

// Helper function to check if postcode is complete (has both outward and inward parts)
const isFullUKPostcode = (postcode: string): boolean => {
    if (!postcode) return false;
    // Full UK postcode has format like "BS49 4FH" - outward code + space + inward code (3 chars)
    const fullPostcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s+\d[A-Z]{2}$/i;
    return fullPostcodeRegex.test(postcode.trim());
};

// Helper to get full postcode from postcodes.io using coordinates
const getFullPostcodeFromCoords = async (lat: number, lng: number): Promise<string | null> => {
    try {
        const response = await fetch(`https://api.postcodes.io/postcodes?lon=${lng}&lat=${lat}&limit=1`);
        if (!response.ok) return null;
        const data = await response.json() as { result: Array<{ postcode: string }> | null };
        return data.result?.[0]?.postcode || null;
    } catch {
        return null;
    }
};

router.get('/details', async (req, res) => {
    const place_id = req.query?.place_id as string;
    if (!place_id) {
        return res.status(400).json({ error: 'Place ID is required' });
    }
    try {
        if (!GOOGLE_API_KEY) throw new Error("Google api key not found in env!");
        const searchParams = {
            key: GOOGLE_API_KEY,
            place_id,
            fields: "name,formatted_address,address_components,geometry"
        };
        const searchQuery = new URLSearchParams(searchParams).toString();
        const details = await fetch(`${GOOGLE_PLACES_DETAILS_API}?${searchQuery}`);
        if (!details.ok) throw new Error(details.statusText);
        const parsedRes = await details.json() as DetailsResponse;
        if (!parsedRes.result) throw new Error("No result found");

        // Check if we have a full postcode
        const postcodeComponent = parsedRes.result.address_components.find(
            c => c.types.includes('postal_code')
        );
        const hasFullPostcode = postcodeComponent && isFullUKPostcode(postcodeComponent.long_name);

        // If we only have a partial postcode and have coordinates, lookup full postcode
        if (!hasFullPostcode && parsedRes.result.geometry?.location) {
            const { lat, lng } = parsedRes.result.geometry.location;
            const fullPostcode = await getFullPostcodeFromCoords(lat, lng);

            if (fullPostcode) {
                // Update the postal_code component with full postcode
                const existingIndex = parsedRes.result.address_components.findIndex(
                    c => c.types.includes('postal_code') || c.types.includes('postal_code_prefix')
                );

                if (existingIndex >= 0) {
                    parsedRes.result.address_components[existingIndex] = {
                        long_name: fullPostcode,
                        short_name: fullPostcode,
                        types: ['postal_code']
                    };
                } else {
                    parsedRes.result.address_components.push({
                        long_name: fullPostcode,
                        short_name: fullPostcode,
                        types: ['postal_code']
                    });
                }

                // Also update formatted_address if it contains partial postcode
                const partialPostcode = postcodeComponent?.long_name;
                if (partialPostcode && parsedRes.result.formatted_address.includes(partialPostcode)) {
                    parsedRes.result.formatted_address = parsedRes.result.formatted_address.replace(
                        partialPostcode,
                        fullPostcode
                    );
                }
            }
        }

        return res.status(200).json(parsedRes.result);
    }
    catch (e: unknown) {
        console.warn("Error while finding details:", e);
        return res.status(500).json({ error: (e as Error)?.message || "Internal server error" });
    }
});

export default router;