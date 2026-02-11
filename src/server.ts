import express from 'express';
import cors from 'cors';
import { getLatest, getAnimeInfo, searchAnime } from './index';

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

app.get('/api/latest', async (req, res) => {
    try {
        const data = await getLatest();
        // OJO: data es de tipo ChapterData[], por eso usamos item.chapter
        const adaptado = data.map((item: any) => ({
            title: item.title,
            number: item.chapter, // CORREGIDO: la librería usa 'chapter'
            slug: item.url.split('/').pop(), // Extraemos el slug de la URL
            cover: item.cover,
            url: item.url
        }));
        res.json({ success: true, data: adaptado });
    } catch (err: any) {
        res.status(500).json({ success: false, message: "Error buscando estrenos", error: err.message });
    }
});

app.get('/api/anime/:id', async (req, res) => {
    try {
        const data = await getAnimeInfo(req.params.id);
        res.json({ success: true, data: data });
    } catch (err: any) {
        res.status(500).json({ success: false, message: "Error buscando anime", error: err.message });
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

app.get('/', (req, res) => {
    res.send('<h1>API Anime Funcionando 🚀</h1>');
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});