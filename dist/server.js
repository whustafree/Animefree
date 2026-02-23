"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path")); // NUEVO: Para encontrar la carpeta public
const cloudscraper_1 = __importDefault(require("cloudscraper"));
const cheerio_1 = require("cheerio");
const index_1 = require("./index");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
// --- NUEVO: Servir la página web ---
// Le decimos que la carpeta '../public' tiene los archivos estáticos (HTML, CSS, JS)
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
const PORT = process.env.PORT || 3000;
// ================= API ROUTES =================
app.get('/api/latest', async (req, res) => {
    try {
        const data = await (0, index_1.getLatest)();
        const adaptado = data.map((item) => ({
            title: item.title,
            number: item.chapter,
            slug: item.url.split('/').pop(),
            cover: item.cover,
            url: item.url
        }));
        res.json({ success: true, data: adaptado });
    }
    catch (err) {
        res.status(500).json({ success: false, message: "Error en estrenos", error: err.message });
    }
});
app.get('/api/anime/:id', async (req, res) => {
    try {
        const data = await (0, index_1.getAnimeInfo)(req.params.id);
        res.json({ success: true, data: data });
    }
    catch (err) {
        res.status(500).json({ success: false, message: "Error en anime", error: err.message });
    }
});
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        const data = await (0, index_1.searchAnime)(query);
        res.json({ success: true, data: data });
    }
    catch (err) {
        res.status(500).json({ success: false, message: "Error en búsqueda", error: err.message });
    }
});
app.get('/api/episode/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        const url = `https://www3.animeflv.net/ver/${slug}`;
        const html = await (0, cloudscraper_1.default)({ uri: url });
        const $ = (0, cheerio_1.load)(html);
        const scripts = $('script');
        let servers = [];
        scripts.each((i, el) => {
            const content = $(el).html();
            if (content && content.includes('var videos =')) {
                const match = content.match(/var videos = ({.*?});/);
                if (match) {
                    const json = JSON.parse(match[1]);
                    if (json.SUB)
                        servers = json.SUB;
                }
            }
        });
        if (servers.length > 0) {
            const adaptado = servers.map((s) => ({
                name: s.server,
                url: s.code,
                embed: s.code
            }));
            res.json({ success: true, servers: adaptado });
        }
        else {
            res.status(404).json({ success: false, message: "No se encontraron servidores" });
        }
    }
    catch (err) {
        res.status(500).json({ success: false, message: "Error obteniendo video", error: err.message });
    }
});
// --- IMPORTANTE: Ruta comodín para SPA (Single Page Application) ---
// Si escriben una URL que no existe en la API, mandamos el index.html
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/index.html'));
});
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
