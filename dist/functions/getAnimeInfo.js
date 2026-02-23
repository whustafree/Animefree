"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnimeInfo = getAnimeInfo;
const constants_1 = require("../constants");
const cheerio_1 = require("cheerio");
const cloudscraper_1 = __importDefault(require("cloudscraper"));
async function getAnimeInfo(animeId) {
    if (!animeId || (typeof animeId !== "string")) {
        throw new TypeError(`El parámetro animeId debe ser una string no vacía.`);
    }
    try {
        constants_1.CloudscraperOptions.uri = 'https://www3.animeflv.net/anime/' + animeId;
        const animeData = (await (0, cloudscraper_1.default)(constants_1.CloudscraperOptions));
        const $ = (0, cheerio_1.load)(animeData);
        // Selectores mejorados y a prueba de fallos
        const animeInfo = {
            title: $('h1.Title').text() || $('div.Container h1').text() || "Sin Título",
            alternative_titles: [],
            // Estado: Busca el icono del reloj (fa-clock-o) y toma el texto siguiente
            status: ($('span.fa-clock-o').next().text() || $('span.fa-tv').next().text() || "Finalizado"),
            rating: $('#votes_prmd').text() || "0",
            // Tipo: Busca el span con clase Type
            type: ($('span.Type').text() || "Anime"),
            cover: 'https://animeflv.net' + ($('div.AnimeCover img').attr('src') || ""),
            synopsis: $('div.Description p').text() || "Sin sinopsis.",
            genres: $('nav.Nvgnrs a').map((i, el) => $(el).text()).get(),
            episodes: [],
            url: constants_1.CloudscraperOptions.uri
        };
        // --- Extracción de episodios (Detecta var episodes = ...) ---
        const scripts = $('script');
        let episodesScript = "";
        scripts.each((i, el) => {
            const content = $(el).html();
            if (content && content.includes('var episodes =')) {
                episodesScript = content;
            }
        });
        if (episodesScript) {
            const match = episodesScript.match(/episodes = (\[\[.*?\]\]);/);
            if (match && match[1]) {
                const episodesList = JSON.parse(match[1]);
                // AnimeFLV guarda: [NumeroEpisodio, ID_Video]
                for (let i = 0; i < episodesList.length; i++) {
                    const epNum = episodesList[i][0];
                    animeInfo.episodes.push({
                        number: epNum,
                        url: 'https://www3.animeflv.net/ver/' + animeId + '-' + epNum
                    });
                }
            }
        }
        $('span.TxtAlt').each((i, el) => {
            animeInfo.alternative_titles.push($(el).text());
        });
        return animeInfo;
    }
    catch (err) {
        console.error("Error en getAnimeInfo:", err);
        return null;
    }
}
