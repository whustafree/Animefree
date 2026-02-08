// ==========================================
// INTEGRACIÓN: API ANIMEFLV (Ahmed Rangel)
// ==========================================

const API_BASE = "https://animeflv.ahmedrangel.com/api";

// Consola de depuración (Mantenemos tu herramienta)
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
// SISTEMA DE CONEXIÓN (Directo + Proxies)
// ==========================================

const PROXIES = [
    (url) => url, // 1. Intento directo (Más rápido)
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, // 2. Respaldo
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}` // 3. Emergencia
];

async function fetchData(endpoint) {
    const targetUrl = `${API_BASE}${endpoint}`;
    
    for (const wrapProxy of PROXIES) {
        try {
            const finalUrl = wrapProxy(targetUrl);
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 8000);

            const resp = await fetch(finalUrl, { signal: controller.signal });
            clearTimeout(id);

            if (!resp.ok) continue;

            const text = await resp.text();
            let data;
            
            try {
                data = JSON.parse(text);
                if(data.contents) data = JSON.parse(data.contents); // AllOrigins fix
            } catch(e) { continue; }

            if (data.success) {
                return data.data;
            }
        } catch (e) { }
    }
    log(`Error conectando a: ${endpoint}`, 'error');
    return null;
}

// ==========================================
// 1. INICIO (Últimos Episodios)
// ==========================================

async function init() {
    log("Conectando a API Ahmed Rangel...");
    const grid = document.getElementById('grid');
    if(grid) grid.innerHTML = '<div class="loader">Cargando últimos episodios...</div>';

    const data = await fetchData('/list/latest-episodes');
    
    if (data) {
        renderGrid(data, 'episode'); // 'episode' indica que al hacer click vamos directo al video
        log("Cartelera actualizada.", 'success');
    } else {
        if(grid) grid.innerHTML = '<div style="text-align:center;">Error de conexión.</div>';
    }
}

// ==========================================
// 2. BÚSQUEDA (Por Anime)
// ==========================================

async function buscar() {
    const q = document.getElementById('inp').value;
    if (!q) return;
    
    log(`Buscando: ${q}`);
    const grid = document.getElementById('grid');
    grid.innerHTML = '<div class="loader">Buscando en AnimeFLV...</div>';

    const data = await fetchData(`/search?query=${encodeURIComponent(q)}`);
    
    if (data && data.media) {
        renderGrid(data.media, 'anime'); // 'anime' indica que al hacer click vamos a detalles
    } else {
        grid.innerHTML = '<div style="text-align:center;">Sin resultados.</div>';
    }
}

// Renderizado inteligente (Sirve para Episodios y Animes)
function renderGrid(list, type) {
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    
    list.forEach(item => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        
        // La API devuelve 'cover' para la imagen
        const img = item.cover || 'https://via.placeholder.com/150';
        const title = item.title;
        // Si es episodio, mostramos número. Si es anime, mostramos tipo/rating
        const subtitle = item.number ? `Episodio ${item.number}` : (item.type || 'Anime');
        
        card.innerHTML = `
            <img src="${img}" loading="lazy">
            <div class="info">
                <strong>${title}</strong><br>
                <small>${subtitle}</small>
            </div>
        `;
        
        // Lógica de click según el tipo
        if (type === 'episode') {
            // Si es un episodio de la home, vamos directo a verlo
            card.onclick = () => cargarVideo(item.slug, item.title);
        } else {
            // Si es una búsqueda de anime, vamos a ver sus capítulos
            card.onclick = () => cargarDetallesAnime(item.slug);
        }
        
        grid.appendChild(card);
    });
}

// ==========================================
// 3. DETALLES DEL ANIME
// ==========================================

async function cargarDetallesAnime(slug) {
    const modal = document.getElementById('modal');
    modal.style.display = 'flex';
    document.getElementById('mTitle').innerText = "Cargando info...";
    document.getElementById('mEps').innerHTML = '<div class="loader">Obteniendo episodios...</div>';
    document.getElementById('mLinks').innerHTML = '';

    const info = await fetchData(`/anime/${slug}`);
    
    if (info) {
        document.getElementById('mTitle').innerText = info.title;
        const list = document.getElementById('mEps');
        list.innerHTML = '';
        
        // Mostrar episodios
        if (info.episodes && info.episodes.length > 0) {
            info.episodes.forEach(ep => {
                const btn = document.createElement('div');
                btn.className = 'ep-btn';
                btn.innerText = ep.number;
                // El slug del episodio ya viene listo en esta API
                btn.onclick = () => cargarVideo(ep.slug, `Episodio ${ep.number}`);
                list.appendChild(btn);
            });
            log(`Cargados ${info.episodes.length} capítulos.`, 'success');
        } else {
            list.innerHTML = 'No hay episodios listados.';
        }
    }
}

// ==========================================
// 4. REPRODUCTOR DE VIDEO
// ==========================================

async function cargarVideo(episodeSlug, titleContext) {
    // Si estamos en la home, abrimos el modal primero
    const modal = document.getElementById('modal');
    if (modal.style.display !== 'flex') {
        modal.style.display = 'flex';
        document.getElementById('mTitle').innerText = titleContext;
        document.getElementById('mEps').innerHTML = ''; // Limpiamos lista de caps si venimos de home
    }

    const linksDiv = document.getElementById('mLinks');
    linksDiv.innerHTML = '<div class="loader">Extrayendo servidores...</div>';
    
    log(`Obteniendo video: ${episodeSlug}`);
    const data = await fetchData(`/anime/episode/${episodeSlug}`);

    linksDiv.innerHTML = '';
    
    if (data && data.servers) {
        data.servers.forEach(server => {
            const btn = document.createElement('button');
            btn.className = 'link-btn'; // Usamos la clase del CSS
            btn.innerText = `▶ Ver en ${server.name}`;
            
            // Preferimos la URL de 'embed' o 'url', según lo que traiga
            const videoUrl = server.embed || server.url || server.code;
            
            btn.onclick = () => window.location.href = videoUrl;
            linksDiv.appendChild(btn);
        });
        log("Servidores listos.", 'success');
    } else {
        linksDiv.innerHTML = '<div style="text-align:center;">No hay servidores disponibles.</div>';
    }
}

function cerrarModal() { document.getElementById('modal').style.display = 'none'; }
window.onload = init;