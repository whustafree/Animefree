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

            const data = await response.json();
            
            // Validación de respuesta (AllOrigins a veces devuelve string)
            const finalData = data.contents ? JSON.parse(data.contents) : data;
            
            if (finalData.results || finalData.episodes || finalData.sources) {
                return finalData;
            }
        } catch (e) {
            console.warn(`Fallo en ${source}:`, e);
        }
    }
    alert("Error de red: No se pudo conectar a los servidores.");
    return null;
}

// INICIALIZACIÓN
window.onload = () => cargarInicio();

async function cargarInicio() {
    const grid = document.getElementById('animeGrid');
    grid.innerHTML = '<div class="loader" style="grid-column: 1/-1; text-align:center;">Cargando estrenos...</div>';
    
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
    else grid.innerHTML = '<div style="padding:20px; text-align:center; grid-column: 1/-1;">No se encontraron resultados.</div>';
}

function renderGrid(list) {
    const grid = document.getElementById('animeGrid');
    grid.innerHTML = '';
    
    list.forEach(anime => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        // Proxy de imágenes para evitar cuadros grises
        const img = `https://images.weserv.nl/?url=${encodeURIComponent(anime.image)}`;
        
        card.innerHTML = `
            <img src="${img}" loading="lazy" onerror="this.src='https://via.placeholder.com/150'">
            <div class="info">${anime.title}</div>
        `;
        card.onclick = () => abrirDetalles(anime.id, anime.title);
        grid.appendChild(card);
    });
}

// MODAL Y EPISODIOS
async function abrirDetalles(id, title) {
    const modal = document.getElementById('animeModal');
    const epList = document.getElementById('modalEpisodes');
    
    modal.style.display = 'flex';
    document.getElementById('modalTitle').innerText = title;
    epList.innerHTML = 'Cargando episodios...';
    document.getElementById('modalLinks').innerHTML = '';

    const data = await fetchData(`info?id=${id}`);
    
    if (data && data.episodes) {
        epList.innerHTML = '';
        data.episodes.reverse().forEach(ep => { // Invertimos para que el 1 salga primero o último según gusto
            const btn = document.createElement('div');
            btn.className = 'ep-btn';
            btn.innerText = ep.number;
            btn.onclick = () => cargarLinks(ep.id);
            epList.appendChild(btn);
        });
    }
}

async function cargarLinks(epId) {
    const linksDiv = document.getElementById('modalLinks');
    linksDiv.innerHTML = '<div style="text-align:center; padding:10px;">Obteniendo servidor...</div>';
    
    const data = await fetchData(`watch?episodeId=${epId}`);
    linksDiv.innerHTML = '';

    if (data && data.sources) {
        data.sources.forEach(src => {
            const btn = document.createElement('a');
            btn.className = 'link-btn';
            btn.innerText = `▶ Reproducir (${src.quality})`;
            btn.href = src.url; // Abrir directo en reproductor del cel
            linksDiv.appendChild(btn);
        });
    } else {
        linksDiv.innerHTML = '<div style="text-align:center; color:#ff5555;">No hay enlaces disponibles.</div>';
    }
}

function cerrarModal() {
    document.getElementById('animeModal').style.display = 'none';
}