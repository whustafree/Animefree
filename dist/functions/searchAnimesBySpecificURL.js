"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchAnimesBySpecificURL = searchAnimesBySpecificURL;
const cloudscraper_1 = __importDefault(require("cloudscraper"));
const constants_1 = require("../constants");
const utils_1 = require("../utils");
async function searchAnimesBySpecificURL(url) {
    if (!url || (typeof url) !== "string")
        // CORREGIDO: Quitamos el segundo argumento
        throw new TypeError(`Parámetro url debe ser una string no vacía, pasaste: ${url}`);
    try {
        constants_1.CloudscraperOptions.uri = url;
        const specificData = (await (0, cloudscraper_1.default)(constants_1.CloudscraperOptions));
        return (0, utils_1.executeSearch)(specificData);
    }
    catch {
        return null;
    }
}
