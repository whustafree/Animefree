import express from 'express';
import cors from 'cors';
import { getLatest, getAnimeInfo, searchAnime } from './index'; // Importa las funciones de mixdevcode

const app = express();
app.use(cors()); // Permite que cualquiera (tu web) se conecte

const PORT = process.env.PORT || 3000;

// RUTA 1: Estrenos (Lo que usará tu Home)
app.get('/api/latest', async (req, res) => {
    try {
        const data = await getLatest();
        // Transformamos los datos para que tu web los entienda fácil
        const adaptado = data.map((item: any) => ({
            title: item.title,
            number: item.episode,
            slug: item.id,
            cover: item.image,
            type: item.type
        }));
        res.json({ success: true, data: adaptado });
    } catch (err: any) {
        res.status(500).json({ success: false, message: "Error buscando estrenos", error: err.message });
    }
});

// RUTA 2: Detalles del Anime
app.get('/api/anime/:id', async (req, res) => {
    try {
        const data = await getAnimeInfo(req.params.id);
        res.json({ success: true, data: data });
    } catch (err: any) {
        res.status(500).json({ success: false, message: "Error buscando anime", error: err.message });
    }
});

// RUTA 3: Búsqueda
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