// ==========================================
// WHUSTAF WEB - VERSIÓN TEMPORADA (APP_WEB.JS)
// ==========================================

// --- DEPURACIÓN ---
let isDebugActive = false;
let logBuffer = [];
const originalLog = console.log, originalError = console.error, originalWarn = console.warn;
function logToVisualConsole(msg, type) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] [${type}] ${msg}`;
    logBuffer.push(logEntry);
    if(logBuffer.length > 200) logBuffer.shift();
    if (!isDebugActive) return;
    const consoleDiv = document.getElementById('console-logs');
    if (consoleDiv) {
        const line = document.createElement('div');
        line.className = `log-line log-${type.toLowerCase()}`;
        line.textContent = logEntry;
        consoleDiv.appendChild(line);
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
    }
}
console.log = (...args) => { originalLog(...args); logToVisualConsole(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' '), 'INFO'); };
console.error = (...args) => { originalError(...args); logToVisualConsole(args.join(' '), 'ERROR'); };
window.onerror = (msg, url, line) => { console.error(`CRASH: ${msg} (${line})`); return false; };

// --- UI HELPERS ---
window.toggleSettings = () => document.getElementById('settings-modal').style.display = (document.getElementById('settings-modal').style.display === 'block' ? 'none' : 'block');
window.toggleDebugMode = () => {
    isDebugActive = !isDebugActive;
    const div = document.getElementById('debug-console');
    const chk = document.getElementById('chk-debug');
    div.style.display = isDebugActive ? 'flex' : 'none';
    if(chk) chk.checked = isDebugActive;
    if(isDebugActive) console.log("--- MODO DEBUG ACTIVADO ---");
};
window.copiarLogs = () => navigator.clipboard.writeText(logBuffer.join('\n')).then(() => alert("Copiado"));
window.limpiarLogs = () => { logBuffer = []; document.getElementById('console-logs').innerHTML = ''; };
window.borrarCaches = async () => { if('caches' in window) { (await caches.keys()).forEach(k => caches.delete(k)); window.location.reload(true); }};


// ==========================================
// --- LÓGICA PRINCIPAL ---
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
let currentStatus = ""; // NUEVO: Variable para el estado (1 = En emisión)
let hasMoreResults = true; 
let isLoadingMore = false;

window.onload = () => {
    if (window.location.protocol !== 'file:' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.update()));
    }
    history.replaceState({ page: 'home' }, "", ""); 
    
    console.log("Iniciando App con Filtro de Temporada...");
    cargarEstrenos(); 
    renderHistorial(); 
    renderFavorites();
};

window.onpopstate = () => {
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
    console.log(`[NET] Fetch: ${cleanEndpoint}`);

    for (const wrap of PROXIES) {
        try {
            const resp = await fetch(wrap(API_BASE + cleanEndpoint));
            if (!resp.ok) continue;
            
            const text = await resp.text();
            try {
                let data = JSON.parse(text);
                if (data.contents) data = JSON.parse(data.contents);
                return data.success ? data.data : data;
            } catch (e) { continue; }
        } catch (e) { console.warn("Proxy fail"); }
    }
    console.error("Todos los proxies fallaron");
    return null;
}

// --- ESTRENOS (HOME) ---
async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    if (!grid) return;
    const data = await fetchData('/list/latest-episodes');
    if (data) {
        grid.innerHTML = '';
        data.forEach(item => crearTarjeta(item, grid, 'latest'));
    }
}

// --- NUEVA FUNCIÓN: CARGAR TODA LA TEMPORADA ---
window.cargarTemporada = () => {
    // Reseteamos todo
    document.getElementById('inp').value = ""; // Limpiar texto
    currentQuery = "";
    currentStatus = "1"; // 1 = EN EMISIÓN (Activos)
    searchPage = 1;
    hasMoreResults = true;
    
    const grid = document.getElementById('grid-search');
    grid.innerHTML = '<div class="loader"></div>';
    
    // Cambiamos visualmente a la pestaña de búsqueda
    cambiarTab('search');
    
    console.log("[TEMPORADA] Cargando animes en emisión...");
    cargarMasResultados(true);
};

// --- BÚSQUEDA (TEXTO) ---
async function buscar() {
    const q = document.getElementById('inp').value;
    if (!q) {
        alert("Escribe algo para buscar");
        return;
    }
    currentQuery = q;
    currentStatus = ""; // Quitamos el filtro de estado si buscamos por nombre
    searchPage = 1;
    hasMoreResults = true;
    
    const grid = document.getElementById('grid-search');
    grid.innerHTML = '<div class="loader"></div>';
    
    cargarMasResultados(true);
}

// --- CARGAR RESULTADOS (MODIFICADO PARA STATUS) ---
async function cargarMasResultados(limpiar) {
    if (isLoadingMore || !hasMoreResults) return; 
    
    // Si no hay query y no hay status, no cargamos nada (pantalla limpia)
    if (!currentQuery && !currentStatus) {
        isLoadingMore = false;
        return;
    }

    isLoadingMore = true;
    const grid = document.getElementById('grid-search');
    
    let endpoint = "";

    // LÓGICA DE URL
    if (currentStatus === "1") {
        // Buscar animes EN EMISIÓN (Temporada)
        endpoint = `/search?status=1&order=added&page=${searchPage}`;
    } else {
        // Buscar por NOMBRE
        endpoint = `/search?query=${encodeURIComponent(currentQuery)}&page=${searchPage}`;
    }

    const data = await fetchData(endpoint);
    
    if (limpiar) grid.innerHTML = '';
    
    const results = data?.media || data?.animes || data || [];
    console.log(`[SEARCH] Resultados: ${results.length}`);
    
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

// --- DETALLES Y PLAYER ---
async function cargarDetalles(slug) {
    const modal = document.getElementById('details-modal');
    modal.style.display = 'block';
    if(history.state?.modal !== 'details') history.pushState({ modal: 'details' }, "");
    
    const info = await fetchData(`/anime/${slug}`);
    if (info) {
        currentAnimeData = info;
        if(info.episodes) info.episodes.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
        
        document.getElementById('det-title').innerText = info.title;
        document.getElementById('det-img').src = info.cover;
        document.getElementById('det-synopsis').innerText = (info.synopsis || "").substring(0, 300) + '...';
        document.getElementById('backdrop-img').style.backgroundImage = `url('${info.cover}')`;
        document.getElementById('det-genres').innerText = (info.genres || []).join(', ');

        const grid = document.getElementById('det-episodes'); 
        grid.innerHTML = info.episodes.map((ep, i) => 
            `<div class="ep-card" onclick="prepararVideo(${i})">${ep.number}</div>`
        ).join('');

        document.getElementById('btn-play-latest').onclick = () => prepararVideo(0);
        actualizarBotonFav();
        guardarHistorial(info);
    }
}

window.prepararVideo = (index) => {
    if (!currentAnimeData || !currentAnimeData.episodes[index]) return;
    currentEpisodeIndex = index;
    const ep = currentAnimeData.episodes[index];
    playVideo(ep.slug, ep.number);
};

async function playVideo(slug, number) {
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
         document.getElementById('video-wrapper').innerHTML = '<p style="color:white;padding:20px;">Sin servidores.</p>';
    }
}

window.setSource = (url) => {
    document.getElementById('video-wrapper').innerHTML = `<iframe src="${url}" allowfullscreen></iframe>`;
};

window.volverALista = () => { history.back(); };
window.cerrarDetalles = () => { history.back(); };
window.cerrarReproductor = () => { history.back(); };

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