// ==========================================
// CONFIGURACIÓN: JIKAN (Catálogo) + PROXIES (Video)
// ==========================================

const JIKAN_API = "https://api.jikan.moe/v4";
const VIDEO_APIS = [
    "https://animetize-api.vercel.app/anime/animeflv",
    "https://consumet-api-clone.vercel.app/anime/animeflv",
    "https://api.consumet.org/anime/animeflv"
];

const consoleDiv = document.getElementById('debug-console');

// --- SISTEMA DE LOGS ---
function log(msg, type = 'info') {
    // Si el div no existe (versiones viejas del HTML), lo creamos al vuelo
    let c = document.getElementById('debug-console');
    if (!c) {
        c = document.createElement('div');
        c.id = 'debug-console';
        c.style.cssText = "position:fixed;bottom:0;left:0;width:100%;height:100px;background:#000;color:#0f0;overflow-y:auto;z-index:9999;font-size:10px;padding:5px;";
        document.body.appendChild(c);
    }
    
    const d = document.createElement('div');
    d.style.borderBottom = "1px solid #333";
    if (type === 'error') d.style.color = '#ff5555';
    else if (type === 'success') d.style.color = '#55ff55';
    else d.style.color = '#00d4ff';
    
    d.innerText = `> ${msg}`;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
}

// ==========================================
// 1. CARGA DE CATÁLOGO CON JIKAN (Estable)
// ==========================================

async function init() {
    log("Cargando Jikan API (Cartelera)...");
    const grid = document.getElementById('grid');
    if(grid) grid.innerHTML = '<div class="loader">Cargando temporada actual...</div>';

    try {
        // Pedimos los animes de temporada ("Now")
        const response = await fetch(`${JIKAN_API}/seasons/now?limit=20`);
        const data = await response.json();
        
        if (data && data.data) {
            renderGrid(data.data);
            log("Cartelera cargada con éxito.", 'success');
        }
    } catch (e) {
        log(`Error Jikan: ${e.message}`, 'error');
        document.getElementById('grid').innerHTML = '<div style="text-align:center;">Error cargando Jikan.</div>';
    }
}

async function buscar() {
    const q = document.getElementById('inp').value;
    if (!q) return;
    
    log(`Buscando en Jikan: ${q}`);
    try {
        const response = await fetch(`${JIKAN_API}/anime?q=${encodeURIComponent(q)}&limit=12`);
        const data = await response.json();
        if (data && data.data) renderGrid(data.data);
    } catch (e) { log("Error en búsqueda", 'error'); }
}

function renderGrid(list) {
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    
    list.forEach(anime => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        // Jikan nos da imágenes de alta calidad
        const img = anime.images.jpg.image_url;
        
        card.innerHTML = `
            <img src="${img}" loading="lazy">
            <div>${anime.title}</div>
        `;
        // Al hacer clic, pasamos el TÍTULO para buscar el video
        card.onclick = () => prepararVideo(anime.title);
        grid.appendChild(card);
    });
}

// ==========================================
// 2. BUSCADOR DE VIDEO (El puente difícil)
// ==========================================

async function prepararVideo(titulo) {
    const modal = document.getElementById('modal');
    modal.style.display = 'flex';
    document.getElementById('mTitle').innerText = `Buscando: ${titulo}`;
    document.getElementById('mEps').innerHTML = 'Conectando a servidores de video...';
    document.getElementById('mLinks').innerHTML = '';

    log(`Buscando videos para: ${titulo}...`, 'warn');

    // Usamos la lógica de proxies antigua SOLO para encontrar este anime específico
    const animeData = await encontrarAnimeEnServidores(titulo);
    
    if (animeData) {
        log("Anime encontrado en servidores de video.", 'success');
        mostrarEpisodios(animeData);
    } else {
        log("No se encontró video streaming.", 'error');
        document.getElementById('mEps').innerHTML = 
            '<div style="text-align:center; padding:20px;">Este anime está en Jikan pero no en los servidores de video actuales.<br><br>Intenta buscarlo con otro nombre.</div>';
    }
}

async function encontrarAnimeEnServidores(query) {
    // Probamos cada servidor de video
    for (const server of VIDEO_APIS) {
        const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(`${server}/${query}`)}`;
        try {
            const resp = await fetch(url);
            const data = await resp.json();
            
            // Si hay resultados y al menos uno coincide
            let results = data.results || (data.contents ? JSON.parse(data.contents).results : []);
            
            if (results && results.length > 0) {
                // Obtenemos la info completa del primer resultado
                const primerId = results[0].id;
                return await infoCompletaAnime(server, primerId);
            }
        } catch (e) { console.log("Fallo servidor " + server); }
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
    
    // Mostramos episodios (del sistema de video, no de Jikan)
    if (data.episodes) {
        data.episodes.reverse().forEach(ep => {
            const btn = document.createElement('div');
            btn.className = 'ep-btn';
            btn.innerText = ep.number;
            btn.onclick = () => cargarLinkVideo(data.id, ep.id); // Usamos ID del sistema de video
            list.appendChild(btn);
        });
    }
}

async function cargarLinkVideo(animeId, epId) {
    document.getElementById('mLinks').innerHTML = 'Extrayendo video...';
    
    // Usamos el primer servidor de la lista por defecto
    const server = VIDEO_APIS[0]; 
    const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(`${server}/watch?episodeId=${epId}`)}`;

    try {
        const resp = await fetch(url);
        const json = await resp.json();
        const data = json.contents ? JSON.parse(json.contents) : json;

        const linksDiv = document.getElementById('mLinks');
        linksDiv.innerHTML = '';

        if (data.sources) {
            data.sources.forEach(src => {
                const btn = document.createElement('button');
                btn.innerText = `▶ Ver ${src.quality}`;
                btn.style.cssText = "display:block;width:100%;margin:5px 0;padding:10px;background:#ff4500;color:white;border:none;border-radius:5px;";
                btn.onclick = () => window.location.href = src.url;
                linksDiv.appendChild(btn);
            });
        }
    } catch (e) {
        document.getElementById('mLinks').innerText = 'Error obteniendo video.';
    }
}

function cerrarModal() { document.getElementById('modal').style.display = 'none'; }
window.onload = init;