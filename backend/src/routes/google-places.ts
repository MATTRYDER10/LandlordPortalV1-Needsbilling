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
            fields: "name,formatted_address,address_components"
        };
        const searchQuery = new URLSearchParams(searchParams).toString();
        const details = await fetch(`${GOOGLE_PLACES_DETAILS_API}?${searchQuery}`);
        if (!details.ok) throw new Error(details.statusText);
        const parsedRes = await details.json() as DetailsResponse;
        if (!parsedRes.result) throw new Error("No result found");
        return res.status(200).json(parsedRes.result);
    }
    catch (e: unknown) {
        console.warn("Error while finding details:", e);
        return res.status(500).json({ error: (e as Error)?.message || "Internal server error" });
    }
});

export default router;