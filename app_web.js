const API_BASE = "https://animeflv.ahmedrangel.com/api";

// Lista de Proxies actualizada (Priorizando CodeTabs y AllOrigins)
const PROXIES = [
    (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`, 
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://thingproxy.freeboard.io/fetch/${u}`
];

// Variables Globales
let currentAnimeData = null;
let currentEpisodeIndex = -1;
let searchPage = 1; 
let currentQuery = ""; 
let currentGenre = ""; 
let hasMoreResults = true; 
let isLoadingMore = false;

// Mapa de Géneros EXACTO (Corregido para coincidir con la API)
const GENRE_MAP = {
    "Acción": "accion",
    "Aventura": "aventura",         // Corregido: Singular
    "Comedia": "comedia",
    "Drama": "drama",
    "Ecchi": "ecchi",
    "Fantasía": "fantasia",
    "Romance": "romance",
    "Shounen": "shounen",
    "Terror": "terror",
    "Isekai": "isekai",
    "Sobrenatural": "sobrenatural",
    "Escolares": "escolares",
    "Misterio": "misterio",
    "Psicológico": "psicologico",
    "Ciencia Ficción": "ciencia-ficcion",
    "Seinen": "seinen",
    "Shoujo": "shoujo",
    "Recuentos de la vida": "recuentos-de-la-vida",
    "Deportes": "deportes",
    "Música": "musica",
    "Mecha": "mecha",
    "Artes Marciales": "artes-marciales"
};

// --- INICIO ---
window.onload = () => {
    // Evitar errores de Service Worker en local
    if (window.location.protocol !== 'file:') {
        // Intentamos actualizar el SW si existe
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) {
                    registration.update();
                }
            });
        }
    }
    
    history.replaceState({ page: 'home' }, "", ""); 

    cargarEstrenos(); 
    renderHistorial(); 
    renderFavorites();
    renderGeneros(); // <--- Esta función usa el GENRE_MAP de arriba
    
    cargarMasResultados(true); 
};

// --- CONTROL MAESTRO DE NAVEGACIÓN (BOTÓN ATRÁS) ---
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

// --- CONEXIÓN API ---
async function fetchData(endpoint) {
    const cleanEndpoint = endpoint.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

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
        } catch (e) { console.warn("Proxy falló..."); }
    }
    return null; 
}

// --- ESTRENOS ---
async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    if (!grid) return;
    const data = await fetchData('/list/latest-episodes');
    if (data) {
        grid.innerHTML = '';
        data.forEach(item => crearTarjeta(item, grid, 'latest'));
    }
}

// --- GÉNEROS Y BÚSQUEDA (AQUÍ ESTÁ LA MAGIA) ---
function renderGeneros() {
    const container = document.getElementById('genre-list');
    if(!container) return;
    
    // AQUÍ SE GENERA LA LISTA DESDE EL MAPA NUEVO
    const genres = Object.keys(GENRE_MAP);
    
    container.innerHTML = genres.map(g => `<button class="genre-chip" onclick="buscarPorGenero('${g}')">${g}</button>`).join('');
}

window.buscarPorGenero = (genero) => {
    // Usamos el valor del mapa (ej: "aventura") no la llave ("Aventura")
    currentGenre = GENRE_MAP[genero] || "";
    currentQuery = ""; 
    document.getElementById('inp').value = genero;
    searchPage = 1;
    hasMoreResults = true;
    cargarMasResultados(true);
};

async function buscar() {
    const q = document.getElementById('inp').value;
    currentQuery = q;
    currentGenre = ""; 
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

// --- TARJETAS ---
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

// --- DETALLES ---
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
    }
}

// --- REPRODUCTOR ---
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
         document.getElementById('video-wrapper').innerHTML = '<p style="color:white;text-align:center;padding:20px;">No se encontraron servidores.</p>';
    }
}

window.setSource = (url) => {
    document.getElementById('video-wrapper').innerHTML = `<iframe src="${url}" allowfullscreen></iframe>`;
};

// --- CIERRE Y NAVEGACIÓN ---
window.volverALista = () => { history.back(); };
window.cerrarDetalles = () => { history.back(); };
window.cerrarReproductor = () => { history.back(); };

// --- PERSISTENCIA ---
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
window.toggleSettings = () => alert("Whustaf Web v2.1\nGéneros Corregidos.");

window.onscroll = () => {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
        if(document.getElementById('tab-search').classList.contains('active')) {
            cargarMasResultados(false);
        }
    }
};