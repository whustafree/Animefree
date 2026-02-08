const API_BASE = "https://animeflv.ahmedrangel.com/api";
// CAMBIO IMPORTANTE: Nuevo orden de proxies para evitar el Error 403
const PROXIES = [ 
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u) => `https://thingproxy.freeboard.io/fetch/${u}`
];

let currentAnimeData = null;
let currentEpisodeIndex = -1;
let searchPage = 1; let currentQuery = ""; let hasMoreResults = true; let isLoadingMore = false;

window.onload = () => {
    // SEGURO DE NAVEGACIÓN: Evita salir al selector con el gesto "Atrás"
    history.pushState({ page: 'home' }, "", ""); 

    cargarEstrenos(); 
    renderHistorial(); 
    renderFavorites();
    renderGeneros(); // ¡Géneros reactivados!
    
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
};

// --- GESTIÓN INTELIGENTE DEL BOTÓN ATRÁS ---
window.onpopstate = (event) => {
    // Si hay modales abiertos, ciérralos y quédate en la página
    if (document.getElementById('player-modal').style.display === 'flex') {
        cerrarReproductor(false); // false = no usar history.back() automático
        return;
    }
    if (document.getElementById('details-modal').style.display === 'block') {
        cerrarDetalles(false);
        return;
    }
    // Si no estamos en Home, volver a Home
    if (!document.getElementById('tab-home').classList.contains('active')) {
        cambiarTab('home');
        return;
    }
    // Si estamos en Home y limpios, permitimos salir (o re-bloqueamos si prefieres)
    // history.pushState({ page: 'home' }, "", ""); // Descomentar para "atrapar" al usuario
};

// --- FETCH ROBUSTO ---
async function fetchData(endpoint) {
    if (endpoint.includes('undefined')) return null;
    for (const wrap of PROXIES) {
        try {
            const resp = await fetch(wrap(API_BASE + endpoint));
            if (!resp.ok) continue;
            let data = JSON.parse(await resp.text());
            if (data.contents) data = JSON.parse(data.contents); // Fix para AllOrigins
            return data.success ? data.data : data; // A veces la API devuelve directo
        } catch (e) { console.error("Proxy error:", e); }
    }
    return null;
}

// --- LÓGICA PRINCIPAL ---
async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    const data = await fetchData('/list/latest-episodes');
    if (data) {
        grid.innerHTML = '';
        data.forEach(item => crearTarjeta(item, grid, 'latest'));
    }
}

// --- GÉNEROS ---
function renderGeneros() {
    const container = document.getElementById('genre-list');
    if(!container) return;
    container.innerHTML = '';
    const genres = ["Acción", "Aventuras", "Comedia", "Drama", "Ecchi", "Escolares", "Fantasía", "Harem", "Magia", "Mecha", "Militar", "Misterio", "Música", "Deportes", "Romance", "Ciencia Ficción", "Seinen", "Shoujo", "Shounen", "Sobrenatural", "Suspenso", "Terror", "Vampiros", "Yaoi", "Yuri", "Isekai"];
    
    genres.forEach(g => {
        const btn = document.createElement('button');
        btn.className = 'genre-chip';
        btn.innerText = g;
        btn.onclick = () => {
            document.getElementById('inp').value = g;
            buscar();
        };
        container.appendChild(btn);
    });
}

// --- BUSCADOR ---
async function buscar() {
    const q = document.getElementById('inp').value;
    if (!q) return;
    searchPage = 1; currentQuery = q; hasMoreResults = true;
    const grid = document.getElementById('grid-search');
    grid.innerHTML = '<div class="loader">Buscando...</div>';
    await cargarMasResultados(true);
}

async function cargarMasResultados(limpiar) {
    if (isLoadingMore || !hasMoreResults) return; isLoadingMore = true;
    const grid = document.getElementById('grid-search');
    // Mapeo simple de géneros para la API
    const genreMap = { "Acción": "accion", "Terror": "terror" }; // (Se puede expandir)
    let queryParam = genreMap[currentQuery] ? `genre[]=${genreMap[currentQuery]}` : `query=${encodeURIComponent(currentQuery)}`;
    
    // Detectar si es búsqueda por texto o género
    let endpoint = currentQuery in genreMap 
        ? `/search?${queryParam}&page=${searchPage}` // Esto depende de la API exacta, asumimos query standard
        : `/search?query=${encodeURIComponent(currentQuery)}&page=${searchPage}`;

    // Fix: La API de Ahmed a veces usa /search/by-url para géneros, usamos texto simple por ahora para robustez
    const data = await fetchData(`/search?query=${encodeURIComponent(currentQuery)}&page=${searchPage}`);
    
    if (limpiar) grid.innerHTML = '';
    if (data && data.media && data.media.length > 0) {
        data.media.forEach(item => crearTarjeta(item, grid, 'search'));
        searchPage++; hasMoreResults = data.hasNextPage;
    } else { hasMoreResults = false; if(limpiar) grid.innerHTML = '<p>Sin resultados</p>'; }
    isLoadingMore = false;
}

// --- TARJETAS & CLICK ---
function crearTarjeta(item, container, ctx) {
    const card = document.createElement('div'); card.className = 'anime-card';
    const img = item.cover || 'https://via.placeholder.com/150';
    const meta = ctx === 'latest' ? `Ep ${item.number}` : (item.type || 'Anime');
    card.innerHTML = `<img src="${img}"><div class="info"><span class="title">${item.title}</span><div class="meta">${meta}</div></div>`;
    
    card.onclick = () => {
        // FIX CRÍTICO: SLUGS
        // Si viene de búsqueda tiene 'slug', si viene de estrenos tiene 'animeSlug' o un slug con '-episodio-X'
        let finalSlug = item.animeSlug || item.slug;
        if (finalSlug.includes('undefined')) finalSlug = item.slug; // Fallback
        if (finalSlug.includes('-episodio-')) {
            finalSlug = finalSlug.split('-').slice(0, -1).join('-'); // Quitar numero episodio
        }
        cargarDetalles(finalSlug);
    };
    container.appendChild(card);
}

// --- DETALLES ---
async function cargarDetalles(slug) {
    if(!slug) return;
    document.getElementById('details-modal').style.display = 'block';
    // Push state para que el botón atrás cierre esto
    history.pushState({ modal: 'details' }, "", "");

    const info = await fetchData(`/anime/${slug}`);
    if (info) {
        currentAnimeData = info;
        // Ordenar 1, 2, 3
        if(info.episodes) info.episodes.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
        
        document.getElementById('det-title').innerText = info.title;
        document.getElementById('det-img').src = info.cover;
        document.getElementById('det-synopsis').innerText = (info.synopsis || "").substring(0, 300) + '...';
        document.getElementById('backdrop-img').style.backgroundImage = `url('${info.cover}')`;
        document.getElementById('det-genres').innerText = (info.genres || []).join(', ');

        const grid = document.getElementById('det-episodes'); grid.innerHTML = '';
        info.episodes.forEach((ep, i) => {
            const btn = document.createElement('div'); btn.className = 'ep-card'; btn.innerText = ep.number;
            btn.onclick = () => { currentEpisodeIndex = i; playVideo(ep.slug, ep.number); };
            grid.appendChild(btn);
        });
    }
}

async function playVideo(slug, number) {
    document.getElementById('player-modal').style.display = 'flex';
    history.pushState({ modal: 'player' }, "", ""); // Otro estado para el player
    
    document.getElementById('video-wrapper').innerHTML = '<div class="loader">Cargando servidores...</div>';
    const data = await fetchData(`/anime/episode/${slug}`);
    
    if (data && data.servers) {
        const sList = document.getElementById('server-list'); sList.innerHTML = '';
        data.servers.forEach(srv => {
            const b = document.createElement('button'); b.innerText = srv.name;
            b.onclick = () => document.getElementById('video-wrapper').innerHTML = `<iframe src="${srv.embed || srv.url}" allowfullscreen></iframe>`;
            sList.appendChild(b);
        });
        // Click automático en el primero
        if(sList.firstChild) sList.firstChild.click();
    }
}

// --- UTILS ---
function cerrarDetalles(useBack = true) {
    document.getElementById('details-modal').style.display = 'none';
    if(useBack) history.back(); // Eliminar estado del historial
}
function cerrarReproductor(useBack = true) {
    document.getElementById('player-modal').style.display = 'none';
    document.getElementById('video-wrapper').innerHTML = '';
    if(useBack) history.back();
}

function cambiarTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${id}`).classList.add('active');
    document.getElementById(`nav-${id}`).classList.add('active');
    window.scrollTo(0, 0);
    // Renderizar favoritos/historial si es necesario
    if(id === 'favorites') renderFavorites();
    if(id === 'history') renderHistorial();
}

function renderFavorites() { /* Tu lógica de localStorage aquí (igual que antes) */
    const grid = document.getElementById('grid-favorites');
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    grid.innerHTML = '';
    favs.forEach(item => crearTarjeta(item, grid, 'fav'));
}
function renderHistorial() { /* Tu lógica de localStorage aquí */ 
    const grid = document.getElementById('grid-history');
    const hist = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    grid.innerHTML = '';
    hist.forEach(item => crearTarjeta(item, grid, 'hist'));
}
function borrarHistorial() { localStorage.removeItem('animeHistory'); renderHistorial(); }
function toggleFavorite() {
    if(!currentAnimeData) return;
    let favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const idx = favs.findIndex(f => f.slug === currentAnimeData.slug);
    if(idx === -1) favs.push({ slug: currentAnimeData.slug, title: currentAnimeData.title, cover: currentAnimeData.cover });
    else favs.splice(idx, 1);
    localStorage.setItem('favorites', JSON.stringify(favs));
    renderFavorites();
}