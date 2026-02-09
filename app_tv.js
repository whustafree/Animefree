// ==========================================
// WHUSTAF TV - VERSIÓN FINAL CON DEBUG
// ==========================================

// --- 1. SISTEMA DE DEPURACIÓN EN PANTALLA ---
let isDebugActive = false;
let logBuffer = [];
const originalLog = console.log, originalError = console.error, originalWarn = console.warn;

function logToVisualConsole(msg, type) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] [${type}] ${msg}`;
    logBuffer.push(logEntry);
    if(logBuffer.length > 50) logBuffer.shift(); // Menos buffer en TV para memoria
    if (!isDebugActive) return;
    
    const consoleDiv = document.getElementById('console-logs');
    if (consoleDiv) {
        const line = document.createElement('div');
        line.className = `log-${type.toLowerCase()}`;
        line.textContent = logEntry;
        consoleDiv.appendChild(line);
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
    }
}
console.log = (...args) => { originalLog(...args); logToVisualConsole(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' '), 'INFO'); };
console.error = (...args) => { originalError(...args); logToVisualConsole(args.join(' '), 'ERROR'); };
window.onerror = (msg, url, line) => { console.error(`CRASH: ${msg} (${line})`); return false; };

window.toggleDebugMode = () => {
    isDebugActive = !isDebugActive;
    document.getElementById('debug-console').style.display = isDebugActive ? 'flex' : 'none';
    if(isDebugActive) console.log("--- CONSOLA TV ACTIVADA ---");
};
window.limpiarLogs = () => { logBuffer = []; document.getElementById('console-logs').innerHTML = ''; };


// ==========================================
// --- 2. LÓGICA TV ---
// ==========================================

const API_BASE = "https://animeflv.ahmedrangel.com/api";

const PROXIES = [ 
    (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://thingproxy.freeboard.io/fetch/${u}`
];

async function fetchData(endpoint) {
    // Normalización vital para evitar errores 404
    const cleanEndpoint = endpoint.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    console.log(`[NET] ${cleanEndpoint}`);

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
    console.error("Fallaron todos los proxies");
    return null;
}

let currentTVAnime = null;

window.onload = () => {
    // Actualizar SW
    if (window.location.protocol !== 'file:' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.update()));
    }

    tvTab('home');
    tvCargarInicio();
    
    setTimeout(() => {
        const home = document.getElementById('tv-home');
        if(home) home.focus();
    }, 1000);
};

function tvTab(id) {
    document.querySelectorAll('.tv-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.tv-link').forEach(l => l.classList.remove('active'));
    
    const view = document.getElementById(`view-${id}`);
    const btn = document.getElementById(`tv-${id}`); // Asegúrate de que los IDs coincidan en HTML
    
    if(view) view.classList.add('active');
    if(btn) btn.classList.add('active'); // Opcional si usas IDs en los botones
    
    if(id === 'search') setTimeout(() => document.getElementById('tv-search-input').focus(), 300);
    if(id === 'favorites') renderGridLocal('favorites', 'tv-favorites-grid');
    if(id === 'history') renderGridLocal('animeHistory', 'tv-history-grid');
}

// INICIO
async function tvCargarInicio() {
    const data = await fetchData('/list/latest-episodes');
    
    if (data && data.length > 0) {
        const hero = data[0];
        document.getElementById('hero-title').innerText = hero.title;
        document.getElementById('hero-desc').innerText = `Episodio ${hero.number}`;
        document.getElementById('hero-bg').style.backgroundImage = `url('${hero.cover}')`;
        
        document.getElementById('hero-play').onclick = () => {
            // FIX: Limpiar slug para obtener la serie, no el episodio
            let s = hero.animeSlug || hero.slug;
            s = s.replace(/-episodio-\d+$/, '').replace(/-\d+$/, '');
            tvOpenDetails(s);
        };

        const row = document.getElementById('row-latest');
        row.innerHTML = '';
        
        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'anime-card focusable';
            card.tabIndex = 0;
            card.innerHTML = `<img src="${item.cover}"><div class="info">${item.title}</div>`;
            
            card.onclick = () => {
                // FIX: Limpieza de slug aquí también
                let s = item.animeSlug || item.slug;
                s = s.replace(/-episodio-\d+$/, '').replace(/-\d+$/, '');
                tvOpenDetails(s);
            };
            
            card.onkeydown = (e) => { if (e.key === 'Enter') card.click(); };
            row.appendChild(card);
        });

        renderRowLocal('favorites', 'row-favs');
    }
}

// BUSCADOR
async function tvBuscar() {
    const q = document.getElementById('tv-search-input').value;
    if(!q) return;

    const grid = document.getElementById('tv-search-results');
    grid.innerHTML = '<p style="color:white;padding:20px;">Cargando...</p>';
    
    const data = await fetchData(`/search?query=${encodeURIComponent(q)}`);
    grid.innerHTML = '';
    
    const results = data?.media || data?.animes || data || [];

    if (results.length > 0) {
        results.forEach(item => {
            const card = document.createElement('div'); 
            card.className = 'anime-card focusable'; 
            card.tabIndex = 0;
            card.innerHTML = `<img src="${item.cover}"><div class="info">${item.title}</div>`;
            
            card.onclick = () => tvOpenDetails(item.slug || item.id);
            card.onkeydown = (e) => { if (e.key === 'Enter') card.click(); };
            grid.appendChild(card);
        });
    } else {
        grid.innerHTML = '<p style="color:#aaa;padding:20px;">Sin resultados</p>';
    }
}

// DETALLES (AQUÍ ESTABA EL ERROR)
async function tvOpenDetails(slug) {
    console.log(`Abriendo detalles: ${slug}`);
    
    // Resetear vista previa
    document.getElementById('tv-det-title').innerText = "Cargando...";
    document.getElementById('tv-episodes-list').innerHTML = '';
    document.getElementById('tv-details-modal').style.display = 'flex';
    
    const info = await fetchData(`/anime/${slug}`);
    
    if (info) {
        currentTVAnime = info;
        
        // FIX: Verificar si info.episodes existe antes de usar forEach
        if (info.episodes && Array.isArray(info.episodes)) {
            info.episodes.sort((a,b)=>parseFloat(a.number)-parseFloat(b.number));
        } else {
            console.error("No episodes found for this anime");
            // Puedes mostrar un mensaje en la UI si quieres
        }
        
        document.getElementById('tv-det-img').src = info.cover;
        document.getElementById('tv-det-title').innerText = info.title;
        document.getElementById('tv-det-desc').innerText = (info.synopsis || "").substring(0,300)+'...';
        
        const btnPlay = document.getElementById('tv-btn-play');
        const btnFav = document.getElementById('tv-btn-fav');
        
        btnPlay.onclick = () => {
            if(info.episodes && info.episodes[0]) tvPlay(info.episodes[0].slug);
        };
        
        btnFav.onclick = () => tvToggleFav(info);
        btnFav.innerText = tvIsFav(info.slug) ? "💔 Quitar" : "❤️ Favorito";

        const list = document.getElementById('tv-episodes-list'); 
        
        // Generar botones de episodios con seguridad
        if (info.episodes) {
            info.episodes.forEach(ep => {
                const btn = document.createElement('button'); 
                btn.className = 'tv-ep-btn focusable'; 
                btn.tabIndex = 0;
                btn.innerText = `Ep ${ep.number}`;
                btn.onclick = () => tvPlay(ep.slug);
                btn.onkeydown = (e) => { if (e.key === 'Enter') btn.click(); };
                list.appendChild(btn);
            });
        }

        tvAddToHistory(info);
        setTimeout(() => btnPlay.focus(), 200);
    } else {
        console.error("Error cargando info del anime");
        document.getElementById('tv-det-title').innerText = "Error de Carga";
    }
}

// PLAYER
async function tvPlay(slug) {
    const player = document.getElementById('tv-player');
    const container = document.getElementById('tv-video-container');
    player.style.display = 'block';
    container.innerHTML = '<h2 style="color:white;text-align:center;padding-top:20%;">Cargando...</h2>';
    
    const data = await fetchData(`/anime/episode/${slug}`);
    
    if(data && data.servers) {
        const url = data.servers[0].embed || data.servers[0].url;
        container.innerHTML = `<iframe src="${url}" style="width:100%;height:100%;border:none;" allowfullscreen></iframe>`;
        setTimeout(() => document.querySelector('.tv-close-player').focus(), 500);
    } else {
        container.innerHTML = '<h2 style="color:white;text-align:center;">No hay video disponible</h2>';
    }
}

// UTILIDADES
function closeTvDetails() { document.getElementById('tv-details-modal').style.display = 'none'; document.getElementById('tv-home').focus(); }
function closeTvPlayer() { document.getElementById('tv-player').style.display = 'none'; document.getElementById('tv-video-container').innerHTML=''; }

function renderRowLocal(key, id) {
    const list = JSON.parse(localStorage.getItem(key)||'[]');
    const c = document.getElementById(id); 
    if(!c) return;
    c.innerHTML = list.length ? '' : '<p style="margin-left:20px;color:#666">Vacío</p>';
    list.forEach(i => {
        const card = document.createElement('div'); card.className='anime-card focusable'; card.tabIndex=0;
        card.innerHTML=`<img src="${i.cover}"><div class="info">${i.title}</div>`;
        card.onclick=()=>tvOpenDetails(i.slug);
        card.onkeydown=(e)=>{if(e.key==='Enter')card.click()};
        c.appendChild(card);
    });
}
function renderGridLocal(key, id) { renderRowLocal(key, id); }

function tvIsFav(slug) { return JSON.parse(localStorage.getItem('favorites')||'[]').some(i => i.slug === slug); }
function tvToggleFav(anime) {
    let list = JSON.parse(localStorage.getItem('favorites')||'[]');
    if(tvIsFav(anime.slug)) list = list.filter(i => i.slug !== anime.slug);
    else list.push({ slug: anime.slug, title: anime.title, cover: anime.cover });
    localStorage.setItem('favorites', JSON.stringify(list));
    document.getElementById('tv-btn-fav').innerText = tvIsFav(anime.slug) ? "💔 Quitar" : "❤️ Favorito";
    renderRowLocal('favorites', 'row-favs');
    renderGridLocal('favorites', 'tv-favorites-grid');
}
function tvAddToHistory(anime) {
    let list = JSON.parse(localStorage.getItem('animeHistory')||'[]');
    list = list.filter(i => i.slug !== anime.slug);
    list.unshift({ slug: anime.slug, title: anime.title, cover: anime.cover });
    localStorage.setItem('animeHistory', JSON.stringify(list.slice(0, 20)));
}

// BORRAR CACHÉ
window.borrarCaches = async () => {
    if('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        alert("Caché borrada.");
        window.location.reload(true);
    }
};