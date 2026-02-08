const API_BASE = "https://animeflv.ahmedrangel.com/api";
const PROXIES = [ 
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u) => `https://thingproxy.freeboard.io/fetch/${u}`
];

let currentAnimeData = null;
let currentEpisodeIndex = -1;
let searchPage = 1; let currentQuery = ""; let hasMoreResults = true; let isLoadingMore = false;

window.onload = () => {
    history.pushState({ page: 'home' }, "", ""); 
    cargarEstrenos(); 
    renderHistorial(); 
    renderFavorites();
    renderGeneros();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
};

window.onpopstate = (event) => {
    if (document.getElementById('player-modal').style.display === 'flex') {
        cerrarReproductor(false);
        return;
    }
    if (document.getElementById('details-modal').style.display === 'block') {
        cerrarDetalles(false);
        return;
    }
    if (!document.getElementById('tab-home').classList.contains('active')) {
        cambiarTab('home');
        return;
    }
};

async function fetchData(endpoint) {
    if (endpoint.includes('undefined')) return null;
    for (const wrap of PROXIES) {
        try {
            const resp = await fetch(wrap(API_BASE + endpoint));
            if (!resp.ok) continue;
            let text = await resp.text();
            let data = JSON.parse(text);
            if (data.contents) data = JSON.parse(data.contents);
            return data.success ? data.data : data;
        } catch (e) { console.error("Proxy error:", e); }
    }
    return null;
}

async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    const data = await fetchData('/list/latest-episodes');
    if (data) {
        grid.innerHTML = '';
        data.forEach(item => crearTarjeta(item, grid, 'latest'));
    }
}

function renderGeneros() {
    const container = document.getElementById('genre-list');
    if(!container) return;
    container.innerHTML = '';
    const genres = ["Acción", "Aventuras", "Comedia", "Drama", "Ecchi", "Escolares", "Fantasía", "Harem", "Magia", "Mecha", "Militar", "Misterio", "Música", "Deportes", "Romance", "Ciencia Ficción", "Seinen", "Shoujo", "Shounen", "Sobrenatural", "Suspenso", "Terror", "Vampiros", "Yaoi", "Yuri", "Isekai"];
    genres.forEach(g => {
        const btn = document.createElement('button');
        btn.className = 'genre-chip';
        btn.innerText = g;
        btn.onclick = () => { document.getElementById('inp').value = g; buscar(); };
        container.appendChild(btn);
    });
}

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
    const data = await fetchData(`/search?query=${encodeURIComponent(currentQuery)}&page=${searchPage}`);
    if (limpiar) grid.innerHTML = '';
    if (data && data.media && data.media.length > 0) {
        data.media.forEach(item => crearTarjeta(item, grid, 'search'));
        searchPage++; hasMoreResults = data.hasNextPage;
    } else { hasMoreResults = false; if(limpiar) grid.innerHTML = '<p>Sin resultados</p>'; }
    isLoadingMore = false;
}

function crearTarjeta(item, container, ctx) {
    const card = document.createElement('div'); card.className = 'anime-card';
    const img = item.cover || 'https://via.placeholder.com/150';
    const meta = ctx === 'latest' ? `Ep ${item.number}` : (item.type || 'Anime');
    card.innerHTML = `<img src="${img}"><div class="info"><span class="title">${item.title}</span><div class="meta">${meta}</div></div>`;
    
    card.onclick = () => {
        let finalSlug = item.animeSlug || item.slug;
        // Limpieza de slug para evitar el error 404 en detalles
        if (finalSlug.includes('-episodio-')) {
            finalSlug = finalSlug.split('-episodio-')[0];
        } else if (ctx === 'latest' && /\d+$/.test(finalSlug)) {
             // Si el slug termina en número y es un estreno, quitamos el número del ep
             finalSlug = finalSlug.split('-').slice(0, -1).join('-');
        }
        cargarDetalles(finalSlug);
    };
    container.appendChild(card);
}

async function cargarDetalles(slug) {
    if(!slug) return;
    document.getElementById('details-modal').style.display = 'block';
    history.pushState({ modal: 'details' }, "", "");
    const info = await fetchData(`/anime/${slug}`);
    if (info) {
        currentAnimeData = info;
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
        actualizarBotonFav();
        // Guardar en historial
        let hist = JSON.parse(localStorage.getItem('animeHistory') || '[]');
        hist = hist.filter(h => h.slug !== info.slug);
        hist.unshift({ slug: info.slug, title: info.title, cover: info.cover });
        localStorage.setItem('animeHistory', JSON.stringify(hist.slice(0, 20)));
    }
}

async function playVideo(slug, number) {
    document.getElementById('player-modal').style.display = 'flex';
    document.getElementById('player-title').innerText = `Episodio ${number}`;
    document.getElementById('video-wrapper').innerHTML = '<div class="loader">Cargando servidores...</div>';
    const data = await fetchData(`/anime/episode/${slug}`);
    if (data && data.servers) {
        const sList = document.getElementById('server-list'); sList.innerHTML = '';
        data.servers.forEach(srv => {
            const b = document.createElement('button'); b.innerText = srv.name;
            b.onclick = () => document.getElementById('video-wrapper').innerHTML = `<iframe src="${srv.embed || srv.url}" allowfullscreen></iframe>`;
            sList.appendChild(b);
        });
        if(sList.firstChild) sList.firstChild.click();
        
        const btnNext = document.getElementById('btn-next-ep');
        if (currentAnimeData && currentAnimeData.episodes[currentEpisodeIndex + 1]) {
            btnNext.style.display = 'block';
            btnNext.onclick = () => {
                currentEpisodeIndex++;
                const nextEp = currentAnimeData.episodes[currentEpisodeIndex];
                playVideo(nextEp.slug, nextEp.number);
            };
        } else { btnNext.style.display = 'none'; }
    }
}

function cerrarDetalles(useBack = true) {
    document.getElementById('details-modal').style.display = 'none';
    if(useBack) history.back();
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
    if(id === 'favorites') renderFavorites();
    if(id === 'history') renderHistorial();
}

function renderFavorites() {
    const grid = document.getElementById('grid-favorites');
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    grid.innerHTML = favs.length ? '' : '<p>No tienes favoritos</p>';
    favs.forEach(item => crearTarjeta(item, grid, 'fav'));
}
function renderHistorial() {
    const grid = document.getElementById('grid-history');
    const hist = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    grid.innerHTML = hist.length ? '' : '<p>Historial vacío</p>';
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
    actualizarBotonFav();
}
function actualizarBotonFav() {
    const btn = document.getElementById('btn-fav');
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const isFav = favs.some(f => f.slug === currentAnimeData.slug);
    btn.innerText = isFav ? '❤️ En Favoritos' : '🤍 Añadir Favorito';
}