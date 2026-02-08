const API_BASE = "https://animeflv.ahmedrangel.com/api";
const PROXIES = [ 
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`
];

let currentAnimeData = null;
let currentEpisodeIndex = -1;
let searchPage = 1; 
let currentQuery = ""; 
let hasMoreResults = true; 
let isLoadingMore = false;

window.onload = () => {
    if (window.location.protocol !== 'file:') {
        if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    history.replaceState({ page: 'home' }, ""); 
    cargarEstrenos(); 
    renderHistorial(); 
    renderFavorites();
    renderGeneros();
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
};

async function fetchData(endpoint) {
    // NORMALIZACIÓN: Quita tildes para evitar errores 403/404 en proxies
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
            } catch (e) {
                console.error("Respuesta no es JSON válido (Proxy Error)");
                continue;
            }
        } catch (e) { console.error("Fallo de red en proxy"); }
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
    const genres = ["Acción", "Aventuras", "Comedia", "Drama", "Ecchi", "Fantasía", "Romance", "Shounen", "Terror", "Isekai"];
    container.innerHTML = genres.map(g => `<button class="genre-chip" onclick="buscarPorGenero('${g}')">${g}</button>`).join('');
}

window.buscarPorGenero = (genero) => {
    document.getElementById('inp').value = genero;
    buscar();
};

async function buscar() {
    const q = document.getElementById('inp').value;
    if (!q) return;
    searchPage = 1; currentQuery = q; hasMoreResults = true;
    document.getElementById('grid-search').innerHTML = '<div class="loader"></div>';
    await cargarMasResultados(true);
}

async function cargarMasResultados(limpiar) {
    if (isLoadingMore || !hasMoreResults) return; 
    isLoadingMore = true;
    const data = await fetchData(`/search?query=${encodeURIComponent(currentQuery)}&page=${searchPage}`);
    const grid = document.getElementById('grid-search');
    if (limpiar) grid.innerHTML = '';
    if (data && data.media && data.media.length > 0) {
        data.media.forEach(item => crearTarjeta(item, grid, 'search'));
        searchPage++; hasMoreResults = data.hasNextPage;
    } else { hasMoreResults = false; if(limpiar) grid.innerHTML = '<p>Sin resultados</p>'; }
    isLoadingMore = false;
}

function crearTarjeta(item, container, ctx) {
    const card = document.createElement('div'); 
    card.className = 'anime-card';
    const meta = ctx === 'latest' ? `Ep ${item.number}` : (item.type || 'Anime');
    card.innerHTML = `<img src="${item.cover}"><div class="info"><span class="title">${item.title}</span><div class="meta">${meta}</div></div>`;
    
    card.onclick = () => {
        let slug = item.animeSlug || item.slug;
        // LIMPIEZA DE SLUG: Evita error 404 en detalles
        slug = slug.replace(/-episodio-\d+$/, '').replace(/-\d+$/, '');
        cargarDetalles(slug);
    };
    container.appendChild(card);
}

async function cargarDetalles(slug) {
    document.getElementById('details-modal').style.display = 'block';
    if(history.state?.modal !== 'details') history.pushState({ modal: 'details' }, "");
    
    const info = await fetchData(`/anime/${slug}`);
    if (info) {
        currentAnimeData = info;
        if(info.episodes) info.episodes.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
        document.getElementById('det-title').innerText = info.title;
        document.getElementById('det-img').src = info.cover;
        document.getElementById('det-synopsis').innerText = info.synopsis || "Sin sinopsis.";
        document.getElementById('backdrop-img').style.backgroundImage = `url('${info.cover}')`;
        
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
        btnNext.style.display = (currentAnimeData.episodes[currentEpisodeIndex + 1]) ? 'block' : 'none';
        btnNext.onclick = () => prepararVideo(currentEpisodeIndex + 1);
    }
}

window.setSource = (url) => {
    document.getElementById('video-wrapper').innerHTML = `<iframe src="${url}" allowfullscreen></iframe>`;
};

// FUNCIÓN: Volver a la lista de capítulos
window.volverALista = () => {
    document.getElementById('player-modal').style.display = 'none';
    document.getElementById('video-wrapper').innerHTML = '';
    if(history.state?.modal === 'player') history.back();
};

function cerrarDetalles(back = true) {
    document.getElementById('details-modal').style.display = 'none';
    if(back) history.back();
}

function cerrarReproductor(back = true) {
    document.getElementById('player-modal').style.display = 'none';
    document.getElementById('video-wrapper').innerHTML = '';
    if(back) history.back();
}

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
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const isFav = favs.some(f => f.slug === currentAnimeData.slug);
    document.getElementById('btn-fav').innerText = isFav ? '❤️ En Favoritos' : '🤍 Añadir Favorito';
}

function cambiarTab(id) {
    document.querySelectorAll('.tab-content, .nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${id}`).classList.add('active');
    document.getElementById(`nav-${id}`).classList.add('active');
    if(id === 'favorites') renderFavorites();
    if(id === 'history') renderHistorial();
}

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
window.toggleSettings = () => alert("Whustaf Web v1.6\nLimpieza de Slugs y Proxies activa.");