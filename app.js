// CONFIGURACIÓN DE APIS (Prioridad: Animetize -> Consumet Proxy)
const API_SOURCES = [
    "https://animetize-api.vercel.app/anime/animeflv/",
    "https://api.consumet.org/anime/animeflv/" 
];

// Función maestra para obtener datos
async function fetchData(endpoint) {
    for (const source of API_SOURCES) {
        try {
            let url = source + endpoint;
            
            // Si es la API oficial, usamos proxy para evitar bloqueo
            if (source.includes("consumet.org")) {
                url = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            }

            const controller = new AbortController();
            setTimeout(() => controller.abort(), 8000); // 8 segundos timeout

            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) continue;

            const data =