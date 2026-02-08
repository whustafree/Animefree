// ==========================================
// CONFIGURACIÓN: JIKAN + VIDEO FINDER
// ==========================================

const JIKAN_API = "https://api.jikan.moe/v4";
const VIDEO_APIS = [
    "https://animetize-api.vercel.app/anime/animeflv",
    "https://consumet-api-clone.vercel.app/anime/animeflv",
    "https://api.consumet.org/anime/animeflv"
];

// Log System
const consoleDiv = document.getElementById('debug-console');
function log(msg, type = 'info') {
    if(!consoleDiv) return;
    const d = document.createElement('div');
    d.style.borderBottom = "1px solid #333";
    if (type === 'error') d.style.color = '#ff5555';
    else if (type === 'success') d.style.color = '#55ff55';
    else d.style.color = '#00d4ff';
    d.innerText = `> ${msg}`;
    consoleDiv.appendChild(d);
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

// ==========================================
// 1. CARGA DE CATÁLOGO (JIKAN)
// ==========================================

async function init() {
    log("Iniciando Jikan...");
    const grid = document.getElementById('grid');
    if(grid) grid.innerHTML = '<div class="loader">Cargando temporada...</div>';

    try {
        const response = await fetch(`${JIKAN_API}/seasons/now?limit=20`);
        const data = await response.json();
        
        if (data && data.data) {
            renderGrid(data.data);
            log("Cartelera lista.", 'success');
        }
    } catch (e) {
        log(`Error Jikan: ${e.message}`, 'error');
        if(grid) grid.innerHTML = '<div style="text-align:center; padding:20px;">Error de conexión con Jikan API.</div>';
    }
}

async function buscar() {
    const q = document.getElementById('inp').value;
    if (!q) return;
    
    log(`Buscando: ${q}`);
    const grid = document.getElementById('grid');
    grid.innerHTML = '<div class="loader">Buscando...</div>';

    try {
        const response = await fetch(`${JIKAN_API}/anime?q=${encodeURIComponent(q)}&limit=12`);
        const data = await response.json();
        if (data && data.data) renderGrid(data.data);
    } catch (e) { log("Error búsqueda", 'error'); }
}

function renderGrid(list) {
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    
    list.forEach(anime => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        const img = anime.images.jpg.image_url;
        
        card.innerHTML = `
            <img src="${img}" loading="lazy">
            <div class="info">${anime.title}</div>
        `;
        // Pasamos el título para buscar el video
        card.onclick = () => prepararVideo(anime.title);
        grid.appendChild(card);
    });
}

// ==========================================
// 2. BUSCADOR DE VIDEO (VIDEO LINKER)
// ==========================================

async function prepararVideo(titulo) {
    const modal = document.getElementById('modal');
    modal.style.display = 'flex';
    document.getElementById('mTitle').innerText = titulo; // Título temporal
    document.getElementById('mEps').innerHTML = '<div style="text-align:center; padding:20px;">Conectando a servidores de video...</div>';
    document.getElementById('mLinks').innerHTML = '';

    log(`Buscando video para: ${titulo}...`, 'warn');

    // Buscamos en los servidores de video usando el título de Jikan
    const animeData = await encontrarAnimeEnServidores(titulo);
    
    if (animeData) {
        log("¡Video encontrado!", 'success');
        document.getElementById('mTitle').innerText = animeData.title; // Ponemos el título real del servidor
        mostrarEpisodios(animeData);
    } else {
        log("No hay stream disponible.", 'error');
        document.getElementById('mEps').innerHTML = 
            '<div style="text-align:center; padding:20px;">Este anime está en la base de datos pero no tiene videos disponibles en los servidores gratuitos actualmente.</div>';
    }
}

async function encontrarAnimeEnServidores(query) {
    // Limpiamos el título para mejorar la búsqueda (quitamos (TV), 2nd Season, etc)
    const cleanQuery = query.replace(/\(TV\)|\(Movie\)|Season|Part \d/gi, "").trim();

    for (const server of VIDEO_APIS) {
        // Usamos proxy AllOrigins para buscar
        const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(`${server}/${cleanQuery}`)}`;
        try {
            const resp = await fetch(url);
            const data = await resp.json();
            
            let results = data.results || (data.contents ? JSON.parse(data.contents).results : []);
            
            if (results && results.length > 0) {
                // Si encontramos algo, pedimos la info completa del primer resultado
                return await infoCompletaAnime(server, results[0].id);
            }
        } catch (e) { console.log("Skip server"); }
    }
    return null;
}

async function infoCompletaAnime(serverBase, animeId) {
    const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(`${serverBase}/info?id=${animeId}`)}`;
    try {
        const r = await fetch(url);
        const d = await r.json();
        return d.contents ? JSON.parse(d.contents) : d;
    } catch (e) { return null; }
}

function mostrarEpisodios(data) {
    const list = document.getElementById('mEps');
    list.innerHTML = '';
    
    if (data.episodes) {
        // Invertimos para mostrar últimos caps primero o no, a gusto
        data.episodes.forEach(ep => {
            const btn = document.createElement('div');
            btn.className = 'ep-btn';
            btn.innerText = ep.number;
            btn.onclick = () => cargarLinkVideo(data.id, ep.id);
            list.appendChild(btn);
        });
    }
}

async function cargarLinkVideo(animeId, epId) {
    document.getElementById('mLinks').innerHTML = '<div style="text-align:center;">Extrayendo video...</div>';
    
    const server = VIDEO_APIS[0]; // Usamos el primero por defecto
    const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(`${server}/watch?episodeId=${epId}`)}`;

    try {
        const resp = await fetch(url);
        const json = await resp.json();
        const data = json.contents ? JSON.parse(json.contents) : json;

        const linksDiv = document.getElementById('mLinks');
        linksDiv.innerHTML = '';

        if (data.sources) {
            data.sources.forEach(src => {
                const btn = document.createElement('a');
                btn.className = 'link-btn';
                btn.innerText = `▶ Ver ${src.quality}`;
                btn.href = src.url;
                linksDiv.appendChild(btn);
            });
        } else {
            linksDiv.innerHTML = 'Sin enlaces.';
        }
    } catch (e) {
        document.getElementById('mLinks').innerText = 'Error de video.';
    }
}

function cerrarModal() { document.getElementById('modal').style.display = 'none'; }
window.onload = init;