// --- SISTEMA DE DEPURACIÓN (DEBUGGER) ---
// Esto debe ir AL PRINCIPIO del archivo para capturar todo
let isDebugActive = false;
let logBuffer = [];

// Interceptamos la consola normal para guardarla en nuestra consola visual
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

function logToVisualConsole(msg, type) {
    // Guardar en memoria siempre (por si se activa después)
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] [${type}] ${msg}`;
    logBuffer.push(logEntry);
    if (logBuffer.length > 200) logBuffer.shift(); // Guardar solo ultimos 200

    if (!isDebugActive) return;

    const consoleDiv = document.getElementById('console-logs');
    if (consoleDiv) {
        const line = document.createElement('div');
        line.className = `log-line log-${type.toLowerCase()}`;
        line.textContent = logEntry;
        consoleDiv.appendChild(line);
        consoleDiv.scrollTop = consoleDiv.scrollHeight; // Auto-scroll al final
    }
}

// Sobrescribimos las funciones de la consola
console.log = (...args) => {
    originalLog(...args);
    logToVisualConsole(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' '), 'INFO');
};
console.warn = (...args) => {
    originalWarn(...args);
    logToVisualConsole(args.join(' '), 'WARN');
};
console.error = (...args) => {
    originalError(...args);
    logToVisualConsole(args.join(' '), 'ERROR');
};

// Capturar errores globales (pantallazos de la muerte)
window.onerror = function(msg, url, line, col, error) {
    console.error(`ERROR CRÍTICO: ${msg}\nEn: ${url}:${line}:${col}`);
    return false;
};

// --- FUNCIONES DE LA UI DE DEBUG ---
window.toggleSettings = () => {
    const modal = document.getElementById('settings-modal');
    modal.style.display = (modal.style.display === 'block') ? 'none' : 'block';
};

window.toggleDebugMode = () => {
    const consoleDiv = document.getElementById('debug-console');
    const chk = document.getElementById('chk-debug');
    
    isDebugActive = !isDebugActive;
    
    if (isDebugActive) {
        consoleDiv.style.display = 'flex';
        if(chk) chk.checked = true;
        console.log("=== MODO DEPURACIÓN ACTIVADO ===");
        console.log("Navegador: " + navigator.userAgent);
        // Volcar logs pasados
        const body = document.getElementById('console-logs');
        body.innerHTML = '';
        logBuffer.forEach(log => {
            const type = log.includes('[ERROR]') ? 'error' : 'info';
            const line = document.createElement('div');
            line.className = `log-line log-${type}`;
            line.textContent = log;
            body.appendChild(line);
        });
    } else {
        consoleDiv.style.display = 'none';
        if(chk) chk.checked = false;
    }
};

window.copiarLogs = () => {
    const text = logBuffer.join('\n');
    navigator.clipboard.writeText(text)
        .then(() => alert("✅ Logs copiados. Ahora pégalos en el chat."))
        .catch(err => alert("❌ Error al copiar: " + err));
};

window.limpiarLogs = () => {
    logBuffer = [];
    document.getElementById('console-logs').innerHTML = '';
    console.log("--- Logs limpiados ---");
};

window.borrarCaches = async () => {
    if('caches' in window){
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        alert("Caché borrada. La página se recargará.");
        window.location.reload(true);
    }
};

// ==========================================
// CÓDIGO DE LA APLICACIÓN
// ==========================================

const API_BASE = "https://animeflv.ahmedrangel.com/api";

const PROXIES = [
    (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`, 
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://thingproxy.freeboard.io/fetch/${u}`
];

let currentAnimeData = null;
let currentEpisodeIndex = -1;
let searchPage = 1; 
let currentQuery = ""; 
let currentGenre = ""; 
let hasMoreResults = true; 
let isLoadingMore = false;

const GENRE_MAP = {
    "Acción": "accion", "Aventura": "aventura", "Comedia": "comedia", "Drama": "drama", 
    "Ecchi": "ecchi", "Fantasía": "fantasia", "Romance": "romance", "Shounen": "shounen", 
    "Terror": "terror", "Isekai": "isekai", "Sobrenatural": "sobrenatural", "Escolares": "escolares",
    "Misterio": "misterio", "Psicológico": "psicologico", "Ciencia Ficción": "ciencia-ficcion",
    "Seinen": "seinen", "Shoujo": "shoujo", "Recuentos de la vida": "recuentos-de-la-vida",
    "Deportes": "deportes", "Música": "musica", "Mecha": "mecha", "Artes Marciales": "artes-marciales"
};

window.onload = () => {
    // Intento de actualización de SW
    if (window.location.protocol !== 'file:' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.update()));
    }

    history.replaceState({ page: 'home' }, "", ""); 
    
    console.log("Iniciando aplicación...");
    cargarEstrenos(); 
    renderHistorial(); 
    renderFavorites();
    renderGeneros();
    cargarMasResultados(true); 
};

window.onpopstate = (event) => {
    const player = document.getElementById('player-modal');
    const details = document.getElementById('details-modal');
    if (player.style.display === 'flex') {
        player.style.display = 'none';
        document.getElementById('video-wrapper').innerHTML = ''; 
        return;
    }
    if (details.style.display === 'block') {
        details.style.display = 'none';
        return;
    }
};

async function fetchData(endpoint) {
    const cleanEndpoint = endpoint.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    console.log(`[NETWORK] Solicitando: ${cleanEndpoint}`); // LOG DE RED

    for (const wrap of PROXIES) {
        try {
            const url = wrap(API_BASE + cleanEndpoint);
            // console.log(`[PROXY] Probando: ${url}`); 
            const resp = await fetch(url);
            if (!resp.ok) {
                console.warn(`[PROXY FAIL] ${resp.status} en ${url}`);
                continue;
            }
            
            const text = await resp.text();
            try {
                let data = JSON.parse(text);
                if (data.contents) data = JSON.parse(data.contents);
                console.log(`[SUCCESS] Datos recibidos de: ${cleanEndpoint}`);
                return data.success ? data.data : data;
            } catch (e) { 
                console.error("[JSON ERROR] Respuesta no válida", text.substring(0, 50));
                continue; 
            }
        } catch (e) { 
            console.error(`[FETCH ERROR] ${e.message}`); 
        }
    }
    console.error("[FATAL] Todos los proxies fallaron para: " + endpoint);
    return null;
}

// ... RESTO DE FUNCIONES (cargarEstrenos, renderGeneros, etc.) IGUAL QUE ANTES ...
// Solo me aseguro de pegar las funciones corregidas aquí para que el archivo esté completo.

async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    if (!grid) return;
    grid.innerHTML = '<div class="loader"></div>';
    const data = await fetchData('/list/latest-episodes');
    if (data) {
        grid.innerHTML = '';
        data.forEach(item => crearTarjeta(item, grid, 'latest'));
    } else {
        grid.innerHTML = '<p>Error cargando estrenos. Revisa la consola.</p>';
    }
}

function renderGeneros() {
    const container = document.getElementById('genre-list');
    if(!container) return;
    const genres = Object.keys(GENRE_MAP);
    container.innerHTML = genres.map(g => `<button class="genre-chip" onclick="buscarPorGenero('${g}')">${g}</button>`).join('');
}

window.buscarPorGenero = (genero) => {
    currentGenre = GENRE_MAP[genero] || "";
    currentQuery = ""; 
    document.getElementById('inp').value = genero;
    console.log(`[BUSQUEDA] Genero seleccionado: ${genero} (${currentGenre})`);
    searchPage = 1;
    hasMoreResults = true;
    cargarMasResultados(true);
};

async function buscar() {
    const q = document.getElementById('inp').value;
    currentQuery = q;
    currentGenre = ""; 
    console.log(`[BUSQUEDA] Texto: ${q}`);
    searchPage = 1;
    hasMoreResults = true;
    cargarMasResultados(true);
}

async function cargarMasResultados(limpiar) {
    if (isLoadingMore || !hasMoreResults) return; 
    isLoadingMore = true;
    
    const grid = document.getElementById('grid-search');
    if (limpiar) grid.innerHTML = '<div class="loader"></div>';

    let endpoint = "";
    if (currentGenre) {
        endpoint = `/browse?genre[]=${currentGenre}&page=${searchPage}&order=added`;
    } else if (currentQuery) {
        endpoint = `/search?query=${encodeURIComponent(currentQuery)}&page=${searchPage}`;
    } else {
        endpoint = `/browse?page=${searchPage}&order=added`;
    }

    const data = await fetchData(endpoint);
    
    if (limpiar) grid.innerHTML = '';
    
    const results = data?.media || data?.animes || data || [];
    
    if (results.length > 0) {
        results.forEach(item => crearTarjeta(item, grid, 'search'));
        searchPage++;
        hasMoreResults = results.length >= 20; 
    } else {
        hasMoreResults = false;
        if(limpiar) grid.innerHTML = '<p>No se encontraron resultados.</p>';
    }
    isLoadingMore = false;
}

function crearTarjeta(item, container, ctx) {
    const card = document.createElement('div'); 
    card.className = 'anime-card';
    const meta = ctx === 'latest' ? `Ep ${item.number}` : (item.type || 'Anime');
    card.innerHTML = `<img src="${item.cover}"><div class="info"><span class="title">${item.title}</span><div class="meta">${meta}</div></div>`;
    
    card.onclick = () => {
        let slug = item.animeSlug || item.slug || item.id;
        if (!slug) return;
        slug = slug.replace(/-episodio-\d+$/, '').replace(/-\d+$/, '');
        cargarDetalles(slug);
    };
    container.appendChild(card);
}

async function cargarDetalles(slug) {
    console.log(`[DETALLES] Abriendo: ${slug}`);
    const modal = document.getElementById('details-modal');
    modal.style.display = 'block';
    if(history.state?.modal !== 'details') history.pushState({ modal: 'details' }, "");
    
    const info = await fetchData(`/anime/${slug}`);
    if (info) {
        currentAnimeData = info;
        if(info.episodes) info.episodes.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
        
        document.getElementById('det-title').innerText = info.title;
        document.getElementById('det-img').src = info.cover;
        document.getElementById('det-synopsis').innerText = (info.synopsis || "Sin descripción.").substring(0, 300) + '...';
        document.getElementById('backdrop-img').style.backgroundImage = `url('${info.cover}')`;
        document.getElementById('det-genres').innerText = (info.genres || []).join(', ');

        const grid = document.getElementById('det-episodes'); 
        grid.innerHTML = info.episodes.map((ep, i) => 
            `<div class="ep-card" onclick="prepararVideo(${i})">${ep.number}</div>`
        ).join('');

        document.getElementById('btn-play-latest').onclick = () => prepararVideo(0);
        
        actualizarBotonFav();
        guardarHistorial(info);
    } else {
        console.error("No se pudo cargar la info del anime");
    }
}

window.prepararVideo = (index) => {
    if (!currentAnimeData || !currentAnimeData.episodes[index]) return;
    currentEpisodeIndex = index;
    const ep = currentAnimeData.episodes[index];
    playVideo(ep.slug, ep.number);
};

async function playVideo(slug, number) {
    console.log(`[PLAYER] Cargando episodio ${number} (${slug})`);
    const modal = document.getElementById('player-modal');
    modal.style.display = 'flex';
    
    if(history.state?.modal !== 'player') history.pushState({ modal: 'player' }, "");
    
    document.getElementById('player-title').innerText = `Episodio ${number}`;
    document.getElementById('video-wrapper').innerHTML = '<div class="loader"></div>';
    
    const data = await fetchData(`/anime/episode/${slug}`);
    
    if (data && data.servers) {
        const sList = document.getElementById('server-list'); 
        sList.innerHTML = data.servers.map(srv => 
            `<button onclick="setSource('${srv.embed || srv.url}')">${srv.name}</button>`
        ).join('');
        setSource(data.servers[0].embed || data.servers[0].url);
        
        const btnNext = document.getElementById('btn-next-ep');
        if (currentAnimeData.episodes[currentEpisodeIndex + 1]) {
            btnNext.style.display = 'block';
            btnNext.onclick = () => prepararVideo(currentEpisodeIndex + 1);
        } else {
            btnNext.style.display = 'none';
        }
    } else {
         console.error("No servers found");
         document.getElementById('video-wrapper').innerHTML = '<p style="color:white;text-align:center;">No hay servidores disponibles.</p>';
    }
}

window.setSource = (url) => {
    console.log(`[PLAYER] Fuente establecida: ${url}`);
    document.getElementById('video-wrapper').innerHTML = `<iframe src="${url}" allowfullscreen></iframe>`;
};

window.volverALista = () => { history.back(); };
window.cerrarDetalles = () => { history.back(); };
window.cerrarReproductor = () => { history.back(); };

// --- Favoritos y UI extras ---
function guardarHistorial(anime) {
    let hist = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    hist = hist.filter(h => h.slug !== anime.slug);
    hist.unshift({ slug: anime.slug, title: anime.title, cover: anime.cover });
    localStorage.setItem('animeHistory', JSON.stringify(hist.slice(0, 20)));
}

function toggleFavorite() {
    let favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const isFav = favs.some(f => f.slug === currentAnimeData.slug);
    if(isFav) favs = favs.filter(f => f.slug !== currentAnimeData.slug);
    else favs.push({ slug: currentAnimeData.slug, title: currentAnimeData.title, cover: currentAnimeData.cover });
    localStorage.setItem('favorites', JSON.stringify(favs));
    actualizarBotonFav();
}

function actualizarBotonFav() {
    if (!currentAnimeData) return;
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const isFav = favs.some(f => f.slug === currentAnimeData.slug);
    const btn = document.getElementById('btn-fav');
    if(btn) btn.innerText = isFav ? '❤️ En Favoritos' : '🤍 Añadir Favorito';
}

window.cambiarTab = (id) => {
    document.querySelectorAll('.tab-content, .nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${id}`).classList.add('active');
    document.getElementById(`nav-${id}`).classList.add('active');
    if(id === 'favorites') renderFavorites();
    if(id === 'history') renderHistorial();
};

function renderFavorites() {
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const grid = document.getElementById('grid-favorites');
    grid.innerHTML = favs.length ? '' : '<p>Sin favoritos</p>';
    favs.forEach(f => crearTarjeta(f, grid, 'fav'));
}

function renderHistorial() {
    const hist = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    const grid = document.getElementById('grid-history');
    grid.innerHTML = hist.length ? '' : '<p>Historial vacío</p>';
    hist.forEach(h => crearTarjeta(h, grid, 'hist'));
}

window.borrarHistorial = () => { localStorage.removeItem('animeHistory'); renderHistorial(); };

window.onscroll = () => {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
        if(document.getElementById('tab-search').classList.contains('active')) {
            cargarMasResultados(false);
        }
    }
};