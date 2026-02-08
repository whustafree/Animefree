// LISTA DE SERVIDORES (Mirrors de la API)
// Si uno se cae, el sistema probará el siguiente automáticamente.
const API_MIRRORS = [
    "https://animetize-api.vercel.app/anime/animeflv",
    "https://consumet-api-clone.vercel.app/anime/animeflv",
    "https://api.consumet.org/anime/animeflv",
    "https://consumet-jade.vercel.app/anime/animeflv"
];

// LISTA DE PROXIES (Para saltar bloqueos CORS)
const PROXIES = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://thingproxy.freeboard.io/fetch/${url}`
];

// Función maestra para obtener datos (Intento múltiple)
async function fetchData(endpoint) {
    // 1. Probamos cada servidor de la lista
    for (const baseUrl of API_MIRRORS) {
        const targetUrl = `${baseUrl}/${endpoint}`;
        
        // 2. Para cada servidor, probamos rotando proxies
        for (const wrapProxy of PROXIES) {
            try {
                const finalUrl = wrapProxy(targetUrl);
                console.log(`Probando conexión: ${new URL(baseUrl).hostname} vía proxy...`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 seg límite

                const response = await fetch(finalUrl, { 
                    signal: controller.signal,
                    referrerPolicy: "no-referrer" // Importante para privacidad
                });
                
                clearTimeout(timeoutId);

                if (!response.ok) continue;

                const textData = await response.text();
                let data;

                // Intentamos parsear el JSON (A veces el proxy lo envuelve)
                try {
                    const json = JSON.parse(textData);
                    data = json.contents ? JSON.parse(json.contents) : json;
                } catch(e) {
                    data = JSON.parse(textData); // Intento directo
                }

                // Verificamos si la data sirve
                if (data.results || data.episodes || data.sources) {
                    console.log("¡Conexión Exitosa!");
                    return data;
                }

            } catch (e) {
                console.warn(`Fallo ${baseUrl}:`, e.message);
                // Si falla, el bucle continúa con el siguiente proxy/servidor
            }
        }
    }
    
    // Si llegamos aquí, todo falló
    document.getElementById('animeGrid').innerHTML = 
        '<div style="text-align:center; padding:20px; color:#ff5555;">⚠️ Error: Todos los servidores están ocupados.<br>Intenta de nuevo en 1 minuto.</div>';
    return null;
}

// --- LÓGICA DE LA INTERFAZ (Igual que antes) ---

window.onload = () => cargarInicio();

async function cargarInicio() {
    const grid = document.getElementById('animeGrid');
    grid.innerHTML = '<div class="loader" style="grid-column: 1/-1; text-align:center;">Buscando servidor activo...</div>';
    
    const data = await fetchData("recent-episodes");
    if (data && data.results) renderGrid(data.results);
}

async function buscarAnime() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    const grid = document.getElementById('animeGrid');
    grid.innerHTML = '<div class="loader" style="grid-column: 1/-1; text-align:center;">Buscando...</div>';
    
    const data = await fetchData(query);
    if (data && data.results) renderGrid(data.results);
    else if (grid.innerHTML.includes("loader")) grid.innerHTML = '<div style="padding:20px; text-align:center;">Sin resultados.</div>';
}

function renderGrid(list) {
    const grid = document.getElementById('animeGrid');
    grid.innerHTML = '';
    
    list.forEach(anime => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        // Proxy de imágenes Weserv
        const img = `https://images.weserv.nl/?url=${encodeURIComponent(anime.image)}`;
        
        card.innerHTML = `
            <img src="${img}" loading="lazy" onerror="this.src='https://via.placeholder.com/150'">
            <div class="info">${anime.title}</div>
        `;
        card.onclick = () => abrirDetalles(anime.id, anime.title);
        grid.appendChild(card);
    });
}

async function abrirDetalles(id, title) {
    const modal = document.getElementById('animeModal');
    modal.style.display = 'flex';
    document.getElementById('modalTitle').innerText = title;
    
    const list = document.getElementById('modalEpisodes');
    list.innerHTML = 'Cargando info...';
    document.getElementById('modalLinks').innerHTML = '';

    const data = await fetchData(`info?id=${id}`);
    
    if (data && data.episodes) {
        list.innerHTML = '';
        data.episodes.reverse().forEach(ep => {
            const btn = document.createElement('div');
            btn.className = 'ep-btn';
            btn.innerText = ep.number;
            btn.onclick = () => cargarLinks(ep.id);
            list.appendChild(btn);
        });
    }
}

async function cargarLinks(epId) {
    const linksDiv = document.getElementById('modalLinks');
    linksDiv.innerHTML = '<div style="text-align:center;">Buscando video...</div>';
    
    const data = await fetchData(`watch?episodeId=${epId}`);
    linksDiv.innerHTML = '';

    if (data && data.sources) {
        data.sources.forEach(src => {
            const btn = document.createElement('a');
            btn.className = 'link-btn';
            btn.innerText = `▶ Ver en ${src.quality}`;
            btn.href = src.url;
            linksDiv.appendChild(btn);
        });
    } else {
        linksDiv.innerHTML = 'No se encontraron videos.';
    }
}

function cerrarModal() {
    document.getElementById('animeModal').style.display = 'none';
}