// ==========================================
// WHUSTAF TV - RENDIMIENTO OPTIMIZADO
// ==========================================

const API_BASE = "https://animeflv.ahmedrangel.com/api";
const PROXIES = [ 
    (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://thingproxy.freeboard.io/fetch/${u}`
];

// --- NETWORKING ---
async function fetchData(endpoint) {
    const cleanEndpoint = endpoint.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const wrap of PROXIES) {
        try {
            const resp = await fetch(wrap(API_BASE + cleanEndpoint));
            if (!resp.ok) continue;
            let data = JSON.parse(await resp.text());
            if (data.contents) data = JSON.parse(data.contents);
            return data.success ? data.data : data;
        } catch (e) {}
    }
    return null;
}

let currentAnime = null;

window.onload = () => {
    if (window.location.protocol !== 'file:' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.update()));
    }
    
    loadView('home');
    cargarHome();
    
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if(e.key === 'Enter') ejecutarBusqueda();
    });
};

// --- NAVEGACIÓN ---
window.loadView = (id) => {
    document.getElementById('view-home').style.display = 'none';
    document.getElementById('view-search').style.display = 'none';
    document.getElementById('view-favs').style.display = 'none';
    
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`nav-${id}`).classList.add('active');
    
    if(id === 'home') {
        document.getElementById('view-home').style.display = 'block';
        setTimeout(() => {
            const first = document.querySelector('#row-latest .card');
            if(first) first.focus();
        }, 100);
    } 
    else if(id === 'search') {
        document.getElementById('view-search').style.display = 'flex';
        document.getElementById('search-input').focus();
    }
    else if(id === 'favs') {
        document.getElementById('view-favs').style.display = 'flex';
        renderFavsPage();
    }
};

// --- HOME ---
async function cargarHome() {
    const row = document.getElementById('row-latest');
    row.innerHTML = '<div class="loader"></div>';
    
    const data = await fetchData('/list/latest-episodes');
    row.innerHTML = '';
    
    if (data && data.length > 0) {
        updateHero(data[0]);
        data.forEach(item => {
            row.appendChild(createCard(item, 'latest'));
        });
        renderRowFavs();
    }
}

// --- BUSCADOR ---
async function ejecutarBusqueda() {
    const q = document.getElementById('search-input').value;
    const grid = document.getElementById('search-results');
    grid.innerHTML = '<div class="loader"></div>';
    
    const data = await fetchData(`/search?query=${encodeURIComponent(q)}`);
    grid.innerHTML = '';
    
    const results = data?.media || data?.animes || data || [];
    
    if(results.length > 0) {
        results.forEach(item => {
            grid.appendChild(createCard(item, 'search'));
        });
        setTimeout(() => { if(grid.firstChild) grid.firstChild.focus(); }, 100);
    } else {
        grid.innerHTML = '<p>No se encontraron resultados</p>';
    }
}

// --- TARJETAS ---
function createCard(item, context) {
    const card = document.createElement('div');
    card.className = 'card';
    card.tabIndex = 0;
    card.style.backgroundImage = `url('${item.cover}')`;
    
    card.dataset.title = item.title;
    card.dataset.cover = item.cover;
    card.dataset.desc = context === 'latest' ? `Episodio ${item.number}` : "Anime";
    
    card.onfocus = () => {
        updateHero({
            title: card.dataset.title,
            cover: card.dataset.cover,
            desc: card.dataset.desc
        });
    };
    
    card.onclick = () => {
        let slug = item.animeSlug || item.slug || item.id;
        slug = slug.replace(/-episodio-\d+$/, '').replace(/-\d+$/, '');
        openDetails(slug);
    };
    
    card.onkeydown = (e) => { if(e.key === 'Enter') card.click(); };
    
    return card;
}

function updateHero(info) {
    if(!info) return;
    document.getElementById('app-background').style.backgroundImage = `url('${info.cover}')`;
    document.getElementById('meta-title').innerText = info.title;
    document.getElementById('meta-desc').innerText = info.desc;
}

// --- DETALLES ---
async function openDetails(slug) {
    const modal = document.getElementById('modal-detail');
    modal.style.display = 'flex';
    document.getElementById('mod-title').innerText = "Cargando...";
    document.getElementById('mod-episodes').innerHTML = '';
    
    const info = await fetchData(`/anime/${slug}`);
    
    if(info) {
        currentAnime = info;
        document.getElementById('mod-img').src = info.cover;
        document.getElementById('mod-title').innerText = info.title;
        document.getElementById('mod-desc').innerText = (info.synopsis || "Sin descripción").substring(0, 400) + '...';
        
        const btnPlay = document.getElementById('btn-play');
        const btnFav = document.getElementById('btn-fav');
        
        btnPlay.onclick = () => {
            if(info.episodes && info.episodes.length > 0) {
                info.episodes.sort((a,b) => parseFloat(a.number) - parseFloat(b.number));
                prepararEpisodio(info.episodes[0].slug); // CAMBIO: Ir a selector
            }
        };
        
        btnFav.innerText = isFav(info.slug) ? "💔 Quitar" : "❤️ Añadir";
        btnFav.onclick = () => toggleFav(info);
        
        const grid = document.getElementById('mod-episodes');
        if(info.episodes) {
            info.episodes.sort((a,b) => parseFloat(a.number) - parseFloat(b.number));
            info.episodes.forEach(ep => {
                const btn = document.createElement('button');
                btn.className = 'ep-btn';
                btn.innerText = ep.number;
                btn.onclick = () => prepararEpisodio(ep.slug);
                grid.appendChild(btn);
            });
        }
        
        setTimeout(() => btnPlay.focus(), 100);
    }
}

window.closeModal = () => {
    document.getElementById('modal-detail').style.display = 'none';
    const active = document.querySelector('.nav-btn.active');
    if(active && active.id === 'nav-home') {
        const first = document.querySelector('#row-latest .card');
        if(first) first.focus();
    }
};

// --- REPRODUCTOR OPTIMIZADO (SELECTOR DE SERVIDORES) ---
async function prepararEpisodio(slug) {
    document.getElementById('player-overlay').style.display = 'flex';
    document.getElementById('server-selector').style.display = 'flex'; // Mostrar selector
    document.getElementById('player-container').innerHTML = ''; // Limpiar video anterior
    
    const list = document.getElementById('server-list');
    list.innerHTML = '<h3 style="color:white;">Buscando enlaces...</h3>';
    
    const data = await fetchData(`/anime/episode/${slug}`);
    
    list.innerHTML = '';
    
    if(data && data.servers) {
        data.servers.forEach(srv => {
            const btn = document.createElement('button');
            btn.className = 'server-btn';
            btn.innerText = srv.name; // Ej: Mega, YourUpload
            btn.onclick = () => reproducirVideo(srv.embed || srv.url);
            list.appendChild(btn);
        });
        
        // Enfocar el primer servidor
        if(list.firstChild) list.firstChild.focus();
        
    } else {
        list.innerHTML = '<p>No se encontraron servidores :(</p>';
    }
}

function reproducirVideo(url) {
    // 1. Ocultar selector
    document.getElementById('server-selector').style.display = 'none';
    
    // 2. OPTIMIZACIÓN DE RENDIMIENTO: OCULTAR FONDO PESADO
    document.getElementById('app-background').style.opacity = '0';
    document.getElementById('main-ui').style.display = 'none'; // Ocultar interfaz detrás
    
    // 3. Cargar iframe
    const container = document.getElementById('player-container');
    container.innerHTML = `<iframe src="${url}" style="width:100%;height:100%;border:none;" allowfullscreen></iframe>`;
    
    // 4. Enfocar botón salir
    setTimeout(() => document.querySelector('.close-player').focus(), 1000);
}

window.closePlayer = () => {
    document.getElementById('player-overlay').style.display = 'none';
    document.getElementById('player-container').innerHTML = '';
    
    // RESTAURAR INTERFAZ
    document.getElementById('app-background').style.opacity = '0.35';
    document.getElementById('main-ui').style.display = 'flex';
    
    // Volver foco
    const btnPlay = document.getElementById('btn-play');
    if(btnPlay) btnPlay.focus();
};

// --- FAVORITOS ---
function renderRowFavs() {
    const list = JSON.parse(localStorage.getItem('favorites')||'[]');
    const row = document.getElementById('row-favs');
    row.innerHTML = '';
    list.forEach(item => row.appendChild(createCard(item, 'fav')));
}

function renderFavsPage() {
    const list = JSON.parse(localStorage.getItem('favorites')||'[]');
    const grid = document.getElementById('favs-grid');
    grid.innerHTML = '';
    if(list.length === 0) grid.innerHTML = '<p>No tienes favoritos</p>';
    list.forEach(item => grid.appendChild(createCard(item, 'fav')));
    setTimeout(() => { if(grid.firstChild) grid.firstChild.focus(); }, 100);
}

function isFav(slug) { return JSON.parse(localStorage.getItem('favorites')||'[]').some(i=>i.slug===slug); }
function toggleFav(anime) {
    let list = JSON.parse(localStorage.getItem('favorites')||'[]');
    if(isFav(anime.slug)) list = list.filter(i=>i.slug!==anime.slug);
    else list.push({slug:anime.slug, title:anime.title, cover:anime.cover});
    localStorage.setItem('favorites', JSON.stringify(list));
    document.getElementById('btn-fav').innerText = isFav(anime.slug) ? "💔 Quitar" : "❤️ Añadir";
    renderRowFavs();
}

window.borrarCaches = async () => {
    if('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        window.location.reload(true);
    }
};