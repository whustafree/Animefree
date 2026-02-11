import { CloudscraperOptions } from "../constants";
import { load } from "cheerio";
import cloudscraper from "cloudscraper";
import type { AnimeData, AnimeGenre, AnimeStatus, AnimeType } from "../types";

export async function getAnimeInfo(animeId: string): Promise<AnimeData | null> {

    if (!animeId || (typeof animeId !== "string")) {
        throw new TypeError(`El parámetro animeId debe ser una string no vacía.`);
    }

    try {
        CloudscraperOptions.uri = 'https://www3.animeflv.net/anime/' + animeId;

        const animeData = (await cloudscraper(CloudscraperOptions)) as string;
        const $ = load(animeData);

        const animeInfo: AnimeData = {
            title: $('h1.Title').text() || $('body > div.Wrapper > div > div > div.Ficha.fchlt > div.Container > h1').text(),
            alternative_titles: [],
            status: ($('span.fa-tv').next().text() || "Finalizado") as AnimeStatus,
            rating: $('#votes_prmd').text() || "0",
            type: ($('span.Type').text() || "Anime") as AnimeType,
            cover: 'https://animeflv.net' + ($('div.AnimeCover img').attr('src') || ""),
            synopsis: $('div.Description p').text(),
            genres: $('nav.Nvgnrs a').map((i, el) => $(el).text()).get() as AnimeGenre[],
            episodes: [],
            url: CloudscraperOptions.uri
        };

        // --- CORRECCIÓN CLAVE: Búsqueda dinámica de episodios ---
        const scripts = $('script');
        let episodesScript = "";
        
        scripts.each((i, el) => {
            const content = $(el).html();
            // Buscamos el script que contiene la variable "episodes ="
            if (content && content.includes('var episodes =')) {
                episodesScript = content;
            }
        });

        if (episodesScript) {
            const match = episodesScript.match(/episodes = (\[\[.*?\]\]);/);
            if (match && match[1]) {
                const episodesList = JSON.parse(match[1]);
                // AnimeFLV guarda los episodios al revés (del ultimo al primero)
                // episodesList.length nos da la cantidad total
                for (let i = 0; i < episodesList.length; i++) {
                    const epNum = episodesList[i][0]; // El número del episodio
                    animeInfo.episodes.push({
                        number: epNum,
                        url: 'https://www3.animeflv.net/ver/' + animeId + '-' + epNum
                    });
                }
            }
        }
        // --------------------------------------------------------
        
        $('span.TxtAlt').each((i, el) => {
            animeInfo.alternative_titles.push($(el).text());
        });

        return animeInfo;
    } catch (err) {
        console.error("Error en getAnimeInfo:", err);
        return null;
    }
}