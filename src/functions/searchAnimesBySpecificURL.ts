import cloudscraper from "cloudscraper";
import { CloudscraperOptions } from "../constants";
import { type SearchAnimeResults } from "../types";
import { executeSearch } from "../utils";

export async function searchAnimesBySpecificURL(url: string): Promise<SearchAnimeResults | null> {

    if (!url || (typeof url) !== "string")
        // CORREGIDO: Quitamos el segundo argumento
        throw new TypeError(`Parámetro url debe ser una string no vacía, pasaste: ${url}`);

    try {
        CloudscraperOptions.uri = url;

        const specificData = (await cloudscraper(CloudscraperOptions)) as string;

        return executeSearch(specificData)
    }
    catch {
        return null;
    }
}