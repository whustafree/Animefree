import express from 'express';
import cors from 'cors';
import path from 'path'; // NUEVO: Para encontrar la carpeta public
import cloudscraper from 'cloudscraper';
import { load } from 'cheerio';
import { getLatest, getAnimeInfo, searchAnime } from './index';

const app = express();
app.use(cors());

// --- NUEVO: Servir la página web ---
// Le decimos que la carpeta '../public' tiene los archivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../public')));

const PORT = process.env.PORT || 3000;

// ================= API ROUTES =================

app.get('/api/latest', async (req, res) => {
    try {
        const data = await getLatest();
        const adaptado = data.map((item: any) => ({
            title: item.title,
            number: item.chapter,
            slug: item.url.split('/').pop(),
            cover: item.cover,
            url: item.url
        }));
        res.json({ success: true, data: adaptado });
    } catch (err: any) {
        res.status(500).json({ success: false, message: "Error en estrenos", error: err.message });
    }
});

app.get('/api/anime/:id', async (req, res) => {
    try {
        const data = await getAnimeInfo(req.params.id);
        res.json({ success: true, data: data });
    } catch (err: any) {
        res.status(500).json({ success: false, message: "Error en anime", error: err.message });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q as string;
        const data = await searchAnime(query);
        res.json({ success: true, data: data });
    } catch (err: any) {
        res.status(500).json({ success: false, message: "Error en búsqueda", error: err.message });
    }
});

app.get('/api/episode/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        const url = `https://www3.animeflv.net/ver/${slug}`;
        const html = await cloudscraper({ uri: url });
        const $ = load(html as string);
        
        const scripts = $('script');
        let servers = [];

        scripts.each((i, el) => {
            const content = $(el).html();
            if (content && content.includes('var videos =')) {
                const match = content.match(/var videos = ({.*?});/);
                if (match) {
                    const json = JSON.parse(match[1]);
                    if(json.SUB) servers = json.SUB;
                }
            }
        });

        if(servers.length > 0) {
            const adaptado = servers.map((s: any) => ({
                name: s.server,
                url: s.code,
                embed: s.code 
            }));
            res.json({ success: true, servers: adaptado });
        } else {
            res.status(404).json({ success: false, message: "No se encontraron servidores" });
        }

    } catch (err: any) {
        res.status(500).json({ success: false, message: "Error obteniendo video", error: err.message });
    }
});

// --- IMPORTANTE: Ruta comodín para SPA (Single Page Application) ---
// Si escriben una URL que no existe en la API, mandamos el index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});