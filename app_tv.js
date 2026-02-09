// ==========================================
// WHUSTAF TV - MOTOR INMERSIVO
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
    // Service Worker Update
    if (window.location.protocol !== 'file:' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.update()));
    }
    
    // Iniciar
    loadView('home');
    cargarHome();
    
    // Escuchar el input de búsqueda en tiempo real (opcional) o enter
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if(e.key === 'Enter') ejecutarBusqueda();
    });
};

// --- NAVEGACIÓN VISTAS ---
window.loadView = (id) => {
    // Ocultar todas
    document.getElementById('view-home').style.display = 'none';
    document.getElementById('view-search').style.display = 'none';
    document.getElementById('view-favs').style.display = 'none';
    
    // Desactivar botones nav
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    // Activar seleccionada
    document.getElementById(`nav-${id}`).classList.add('active');
    
    if(id === 'home') {
        document.getElementById('view-home').style.display = 'block';
        setTimeout(() => {
            // Intentar enfocar la primera tarjeta
            const first = document.querySelector('#row-latest .card');
            if(first) first.focus();
        }, 100);
    } 
    else if(id === 'search') {
        document.getElementById('view-search').style.display = 'flex'; // flex para layout
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
    
    if (data) {
        // Precargar el Hero con el primer item
        updateHero(data[0]);
        
        data.forEach(item => {
            const card = createCard(item, 'latest');
            row.appendChild(card);
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
            const card = createCard(item, 'search');
            grid.appendChild(card);
        });
        // Enfocar primer resultado
        setTimeout(() => { if(grid.firstChild) grid.firstChild.focus(); }, 100);
    } else {
        grid.innerHTML = '<p>No se encontraron resultados</p>';
    }
}

// --- CREACIÓN DE TARJETAS (INTELIGENTES) ---
function createCard(item, context) {
    const card = document.createElement('div');
    card.className = 'card';
    card.tabIndex = 0; // Hace que sea seleccionable con el control remoto
    card.style.backgroundImage = `url('${item.cover}')`;
    
    // DATA PARA EL HERO (Se guarda en el elemento DOM)
    card.dataset.title = item.title;
    card.dataset.cover = item.cover;
    // Si es episodio, mostrar número. Si es serie, mostrar tipo.
    card.dataset.desc = context === 'latest' ? `Episodio ${item.number} - Nuevo` : (item.synopsis || "Anime");
    
    // EVENTO FOCO: Cuando pasas por encima con el control
    card.onfocus = () => {
        updateHero({
            title: card.dataset.title,
            cover: card.dataset.cover,
            desc: card.dataset.desc
        });
    };
    
    // EVENTO CLICK: Abrir detalles
    card.onclick = () => {
        let slug = item.animeSlug || item.slug || item.id;
        // Limpieza de slug crítica
        slug = slug.replace(/-episodio-\d+$/, '').replace(/-\d+$/, '');
        openDetails(slug);
    };
    
    // Tecla Enter
    card.onkeydown = (e) => { if(e.key === 'Enter') card.click(); };
    
    return card;
}

// --- ACTUALIZAR FONDO Y TITULO (HERO) ---
function updateHero(info) {
    if(!info) return;
    document.getElementById('app-background').style.backgroundImage = `url('${info.cover}')`;
    document.getElementById('meta-title').innerText = info.title;
    
    // Si tenemos descripcion real (del dataset), la usamos. Si no, un placeholder.
    // Nota: La API lista no da sinopsis, solo titulo e imagen.
    // Solo al entrar al detalle tenemos sinopsis completa.
    const desc = info.desc || (info.number ? `Episodio ${info.number}` : "Anime");
    document.getElementById('meta-desc').innerText = desc;
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
        
        // Botones
        const btnPlay = document.getElementById('btn-play');
        const btnFav = document.getElementById('btn-fav');
        
        // Logica Play (Episodio 1 o el ultimo visto)
        btnPlay.onclick = () => {
            if(info.episodes && info.episodes.length > 0) {
                // Ordenar por numero
                info.episodes.sort((a,b) => parseFloat(a.number) - parseFloat(b.number));
                playEpisode(info.episodes[0].slug);
            }
        };
        
        btnFav.innerText = isFav(info.slug) ? "💔 Quitar" : "❤️ Añadir";
        btnFav.onclick = () => toggleFav(info);
        
        // Episodios
        const grid = document.getElementById('mod-episodes');
        if(info.episodes) {
            info.episodes.sort((a,b) => parseFloat(a.number) - parseFloat(b.number));
            info.episodes.forEach(ep => {
                const btn = document.createElement('button');
                btn.className = 'ep-btn';
                btn.innerText = ep.number;
                btn.onclick = () => playEpisode(ep.slug);
                grid.appendChild(btn);
            });
        }
        
        setTimeout(() => btnPlay.focus(), 100);
    }
}

window.closeModal = () => {
    document.getElementById('modal-detail').style.display = 'none';
    // Devolver foco al home (o donde estaba)
    const active = document.querySelector('.nav-btn.active');
    if(active && active.id === 'nav-home') {
        const first = document.querySelector('#row-latest .card');
        if(first) first.focus();
    }
};

// --- REPRODUCTOR ---
async function playEpisode(slug) {
    document.getElementById('player-overlay').style.display = 'block';
    const container = document.getElementById('player-container');
    container.innerHTML = '<h2 style="color:white; text-align:center; padding-top:20%;">Cargando Servidores...</h2>';
    
    const data = await fetchData(`/anime/episode/${slug}`);
    
    if(data && data.servers) {
        const url = data.servers[0].embed || data.servers[0].url;
        container.innerHTML = `<iframe src="${url}" style="width:100%;height:100%;border:none;" allowfullscreen></iframe>`;
        setTimeout(() => document.querySelector('.close-player').focus(), 500);
    } else {
        container.innerHTML = '<h2 style="color:white; text-align:center;">Error: No video</h2>';
    }
}

window.closePlayer = () => {
    document.getElementById('player-overlay').style.display = 'none';
    document.getElementById('player-container').innerHTML = '';
};

// --- FAVORITOS & LOCAL ---
function renderRowFavs() {
    const list = JSON.parse(localStorage.getItem('favorites')||'[]');
    const row = document.getElementById('row-favs');
    row.innerHTML = '';
    list.forEach(item => {
        const card = createCard(item, 'fav');
        row.appendChild(card);
    });
}

function renderFavsPage() {
    const list = JSON.parse(localStorage.getItem('favorites')||'[]');
    const grid = document.getElementById('favs-grid');
    grid.innerHTML = '';
    if(list.length === 0) grid.innerHTML = '<p>No tienes favoritos</p>';
    list.forEach(item => {
        const card = createCard(item, 'fav');
        grid.appendChild(card);
    });
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