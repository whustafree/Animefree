// src/server.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import { getLatest, getAnimeInfo, searchAnime } from './index';

const app = express();
app.use(cors());

// ==========================================
// 1. RUTAS DE LA API (Deben ir primero)
// ==========================================
app.get('/api/latest', async (req, res) => {
    try {
        const data = await getLatest();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo animes' });
    }
});

app.get('/api/search/:query', async (req, res) => {
    try {
        const data = await searchAnime(req.params.query);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error en la búsqueda' });
    }
});

app.get('/api/anime/:id', async (req, res) => {
    try {
        const data = await getAnimeInfo(req.params.id);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo info' });
    }
});

// ==========================================
// 2. SERVIR LA WEB (Debe ir al final)
// ==========================================
app.use(express.static(path.join(__dirname, '../public')));
// ... o si usas Vite, podrías comentar temporalmente la línea app.use(express.static...) 
// mientras desarrollas, ya que Vite levanta su propio servidor frontend.