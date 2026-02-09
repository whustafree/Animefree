// ==========================================
// WHUSTAF WEB - VERSIÓN TEMPORADA (BOTÓN LOAD MORE)
// ==========================================

const API_BASE = "https://animeflv.ahmedrangel.com/api";

const PROXIES = [
    (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`, 
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://thingproxy.freeboard.io/fetch/${u}`
];

// VARIABLES
let currentAnimeData = null;
let currentEpisodeIndex = -1;
let searchPage = 1; 
let currentQuery = ""; 
let currentStatus = ""; 
let hasMoreResults = true; 
let isLoadingMore = false;

// INICIO
window.onload = () => {
    if (window.location.protocol !== 'file:' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.update()));
    }
    history.replaceState({ page: 'home' }, "", ""); 
    
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

// FETCH CON PROXIES
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
        } catch (e) { console.warn("Proxy fail"); }
    }
    return null;
}

// ESTRENOS
async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    if (!grid) return;
    const data = await fetchData('/list/latest-episodes');
    if (data) {
        grid.innerHTML = '';
        data.forEach(item => crearTarjeta(item, grid, 'latest'));
    }
}

// --- FUNCIÓN PRINCIPAL: CARGAR TEMPORADA ---
window.cargarTemporada = () => {
    document.getElementById('inp').value = "";
    currentQuery = "";
    currentStatus = "1"; // Filtro: EN EMISIÓN
    searchPage = 1;
    hasMoreResults = true;
    
    // Cambiar visualmente a búsqueda
    cambiarTab('search');
    
    // Limpiar grid y mostrar loader
    const grid = document.getElementById('grid-search');
    grid.innerHTML = '<div class="loader"></div>';
    
    cargarMasResultados(false); // false porque ya limpiamos manualmente
};

// BÚSQUEDA NORMAL
async function buscar() {
    const q = document.getElementById('inp').value;
    if (!q) { alert("Escribe algo..."); return; }
    currentQuery = q;
    currentStatus = "";
    searchPage = 1;
    hasMoreResults = true;
    
    const grid = document.getElementById('grid-search');
    grid.innerHTML = '<div class="loader"></div>';
    
    cargarMasResultados(false);
}

// --- CARGA DE RESULTADOS (LOGICA MEJORADA) ---
async function cargarMasResultados(fromScroll = false) {
    if (isLoadingMore || !hasMoreResults) return; 
    
    // Si no hay nada configurado, salir
    if (!currentQuery && !currentStatus) return;

    isLoadingMore = true;
    const grid = document.getElementById('grid-search');
    
    // Quitar el botón "Cargar Más" viejo si existe
    const oldBtn = document.getElementById('btn-load-more');
    if(oldBtn) oldBtn.remove();
    
    // Si es scroll infinito, mostrar mini loader abajo
    if(fromScroll) {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'scroll-loader';
        loadingDiv.className = 'loader';
        loadingDiv.style.width = '30px';
        loadingDiv.style.height = '30px';
        grid.parentNode.appendChild(loadingDiv);
    }

    let endpoint = "";
    // URL según filtro
    if (currentStatus === "1") {
        endpoint = `/search?status=1&order=added&page=${searchPage}`;
    } else {
        endpoint = `/search?query=${encodeURIComponent(currentQuery)}&page=${searchPage}`;
    }

    const data = await fetchData(endpoint);
    
    // Quitar loaders
    if(!fromScroll) grid.innerHTML = ''; 
    const scrollLoader = document.getElementById('scroll-loader');
    if(scrollLoader) scrollLoader.remove();
    
    const results = data?.media || data?.animes || data || [];
    
    if (results.length > 0) {
        results.forEach(item => crearTarjeta(item, grid, 'search'));
        searchPage++;
        
        // Si recibimos 20 o más, asumimos que hay página siguiente
        if (results.length >= 20) {
            hasMoreResults = true;
            // AGREGAR BOTÓN "CARGAR MÁS" AL FINAL
            agregarBotonCargarMas(grid);
        } else {
            hasMoreResults = false;
            // Mensaje de fin
            const fin = document.createElement('p');
            fin.style.gridColumn = '1 / -1';
            fin.style.textAlign = 'center';
            fin.style.color = '#666';
            fin.style.padding = '20px';
            fin.innerText = "Has llegado al final de la lista.";
            grid.appendChild(fin);
        }
    } else {
        hasMoreResults = false;
        if(!fromScroll && searchPage === 1) grid.innerHTML = '<p style="text-align:center; margin-top:20px;">No se encontraron resultados.</p>';
    }
    isLoadingMore = false;
}

function agregarBotonCargarMas(container) {
    // Creamos un botón que ocupa todo el ancho abajo
    const btnContainer = document.createElement('div');
    btnContainer.id = 'btn-load-more-container';
    btnContainer.style.gridColumn = '1 / -1'; // Ocupar toda la fila
    btnContainer.style.textAlign = 'center';
    btnContainer.style.padding = '20px';
    
    const btn = document.createElement('button');
    btn.id = 'btn-load-more';
    btn.className = 'load-more-btn';
    btn.innerText = '⬇ Cargar Más Animes';
    btn.onclick = () => {
        btnContainer.remove(); // Se quita al hacer click
        cargarMasResultados(true);
    };
    
    btnContainer.appendChild(btn);
    container.appendChild(btnContainer);
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

// DETALLES
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

window.setSource = (url) => { document.getElementById('video-wrapper').innerHTML = `<iframe src="${url}" allowfullscreen></iframe>`; };
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
window.borrarCaches = async () => { if('caches' in window) { (await caches.keys()).forEach(k => caches.delete(k)); window.location.reload(true); }};
window.toggleSettings = () => document.getElementById('settings-modal').style.display = (document.getElementById('settings-modal').style.display === 'block' ? 'none' : 'block');

// Scroll infinito (Como respaldo)
window.onscroll = () => {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
        if(document.getElementById('tab-search').classList.contains('active')) {
            // Solo cargamos si NO hay botón manual (para no duplicar llamadas)
            if(!document.getElementById('btn-load-more')) {
                cargarMasResultados(true);
            }
        }
    }
};