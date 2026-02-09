// ==========================================
// WHUSTAF TV - VERSIÓN ESTABLE (MOTOR WEB)
// ==========================================

const API_BASE = "https://animeflv.ahmedrangel.com/api";

// 1. LOS MISMOS PROXIES POTENTES DE LA WEB
const PROXIES = [ 
    (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://thingproxy.freeboard.io/fetch/${u}`
];

// 2. FUNCIÓN DE CARGA INTELIGENTE (IGUAL QUE WEB)
async function fetchData(endpoint) {
    // Normalizamos para evitar errores de tildes
    const cleanEndpoint = endpoint.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    console.log(`[TV NET] Fetching: ${cleanEndpoint}`);

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
        } catch (e) { console.warn("Proxy TV fail"); }
    }
    console.error("Todos los proxies TV fallaron");
    return null;
}

// VARIABLES GLOBALES TV
let currentTVAnime = null;

window.onload = () => {
    // Intentar actualizar service worker
    if (window.location.protocol !== 'file:' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.update()));
    }

    tvTab('home');
    tvCargarInicio();
    
    // Foco inicial al botón Home
    setTimeout(() => {
        const homeBtn = document.getElementById('tv-home');
        if(homeBtn) homeBtn.focus();
    }, 1000);
};

// NAVEGACIÓN POR PESTAÑAS
function tvTab(id) {
    document.querySelectorAll('.tv-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.tv-link').forEach(l => l.classList.remove('active'));
    
    const view = document.getElementById(`view-${id}`);
    const btn = document.getElementById(`tv-${id}`);
    
    if(view) view.classList.add('active');
    if(btn) btn.classList.add('active');
    
    // Acciones especiales por pestaña
    if(id === 'search') {
        setTimeout(() => document.getElementById('tv-search-input').focus(), 300);
    }
    if(id === 'favorites') renderGridLocal('favorites', 'tv-favorites-grid');
    if(id === 'history') renderGridLocal('animeHistory', 'tv-history-grid');
}

// CARGAR INICIO (ESTRENOS)
async function tvCargarInicio() {
    console.log("Cargando inicio TV...");
    const data = await fetchData('/list/latest-episodes');
    
    if (data && data.length > 0) {
        // Hero (Anime destacado - Usamos el primero)
        const hero = data[0];
        document.getElementById('hero-title').innerText = hero.title;
        document.getElementById('hero-desc').innerText = `Episodio ${hero.number} - Recién agregado`;
        document.getElementById('hero-bg').style.backgroundImage = `url('${hero.cover}')`;
        
        // Botón reproducir del Hero
        const playBtn = document.getElementById('hero-play');
        playBtn.onclick = () => {
            let s = hero.animeSlug || hero.slug;
            if(s.includes('-episodio-')) s = s.split('-episodio-')[0]; // Ir a la serie
            tvOpenDetails(s);
        };

        // Fila de Estrenos
        const row = document.getElementById('row-latest');
        row.innerHTML = '';
        
        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'anime-card focusable';
            card.tabIndex = 0; // Para que el control remoto lo detecte
            card.innerHTML = `<img src="${item.cover}"><div class="info">${item.title}</div>`;
            
            card.onclick = () => {
                let s = item.animeSlug || item.slug;
                if(s.includes('-episodio-')) s = s.split('-episodio-')[0];
                tvOpenDetails(s);
            };
            
            // Soporte tecla ENTER del control
            card.onkeydown = (e) => { 
                if (e.key === 'Enter') card.click(); 
            };
            
            row.appendChild(card);
        });

        // Cargar favoritos en la fila de abajo
        renderRowLocal('favorites', 'row-favs');
    }
}

// BUSCADOR (FIXED: Solo Texto)
async function tvBuscar() {
    const q = document.getElementById('tv-search-input').value;
    if(!q) return;

    const grid = document.getElementById('tv-search-results');
    grid.innerHTML = '<p style="color:white; padding:20px;">Buscando...</p>';
    
    // Usamos el endpoint CORRECTO que arreglamos en la web (/search?query=)
    const data = await fetchData(`/search?query=${encodeURIComponent(q)}`);
    
    grid.innerHTML = '';
    
    // Normalizar respuesta (puede ser data.media o array directo)
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
        
        // Enfocar el primer resultado
        setTimeout(() => {
            const first = grid.querySelector('.focusable');
            if(first) first.focus();
        }, 300);
        
    } else {
        grid.innerHTML = '<p style="color:#aaa; padding:20px;">Sin resultados</p>';
    }
}

// DETALLES DEL ANIME
async function tvOpenDetails(slug) {
    // Mostrar modal cargando
    const modal = document.getElementById('tv-details-modal');
    modal.style.display = 'flex';
    document.getElementById('tv-det-title').innerText = "Cargando...";
    
    const info = await fetchData(`/anime/${slug}`);
    
    if (info) {
        currentTVAnime = info;
        // Ordenar episodios
        if(info.episodes) info.episodes.sort((a,b)=>parseFloat(a.number)-parseFloat(b.number));
        
        document.getElementById('tv-det-img').src = info.cover;
        document.getElementById('tv-det-title').innerText = info.title;
        document.getElementById('tv-det-desc').innerText = (info.synopsis || "Sin descripción").substring(0,300)+'...';
        
        // Botones de acción
        const btnPlay = document.getElementById('tv-btn-play');
        const btnFav = document.getElementById('tv-btn-fav');
        
        btnPlay.onclick = () => {
            // Reproducir capitulo 1 por defecto
            if(info.episodes && info.episodes[0]) tvPlay(info.episodes[0].slug);
        };
        
        btnFav.onclick = () => tvToggleFav(info);
        btnFav.innerText = tvIsFav(info.slug) ? "💔 Quitar" : "❤️ Favorito";

        // Lista de Episodios
        const list = document.getElementById('tv-episodes-list'); 
        list.innerHTML = '';
        
        info.episodes.forEach(ep => {
            const btn = document.createElement('button'); 
            btn.className = 'tv-ep-btn focusable'; 
            btn.tabIndex = 0;
            btn.innerText = `Ep ${ep.number}`;
            
            btn.onclick = () => tvPlay(ep.slug);
            // Navegación teclado en lista
            btn.onkeydown = (e) => { if (e.key === 'Enter') btn.click(); };
            
            list.appendChild(btn);
        });
        
        // Guardar historial
        tvAddToHistory(info);

        // Enfocar botón reproducir
        setTimeout(() => btnPlay.focus(), 200);
    }
}

// REPRODUCTOR
async function tvPlay(slug) {
    const player = document.getElementById('tv-player');
    const container = document.getElementById('tv-video-container');
    
    player.style.display = 'block';
    container.innerHTML = '<h2 style="color:white;text-align:center;padding-top:20%;">Cargando video...</h2>';
    
    const data = await fetchData(`/anime/episode/${slug}`);
    
    if(data && data.servers) {
        // Usamos el primer servidor (suele ser el mejor)
        const url = data.servers[0].embed || data.servers[0].url;
        container.innerHTML = `<iframe src="${url}" style="width:100%;height:100%;border:none;" allowfullscreen></iframe>`;
        
        // Enfocar botón cerrar
        setTimeout(() => document.querySelector('.tv-close-player').focus(), 500);
    } else {
        container.innerHTML = '<h2 style="color:white;">Error: No hay servidores</h2>';
    }
}

// UTILIDADES
function closeTvDetails() { 
    document.getElementById('tv-details-modal').style.display = 'none'; 
    document.getElementById('tv-home').focus(); // Volver foco al menú
}

function closeTvPlayer() { 
    document.getElementById('tv-player').style.display = 'none'; 
    document.getElementById('tv-video-container').innerHTML=''; 
}

// GESTIÓN LOCAL (Favoritos e Historial)
function renderRowLocal(key, id) {
    const list = JSON.parse(localStorage.getItem(key)||'[]');
    const c = document.getElementById(id); 
    if(!c) return; 
    
    c.innerHTML = list.length ? '' : '<p style="margin-left:20px; color:#666;">Vacío</p>';
    
    list.forEach(i => {
        const card = document.createElement('div'); 
        card.className='anime-card focusable'; 
        card.tabIndex=0;
        card.innerHTML=`<img src="${i.cover}"><div class="info">${i.title}</div>`;
        card.onclick=()=>tvOpenDetails(i.slug);
        card.onkeydown = (e) => { if (e.key === 'Enter') card.click(); };
        c.appendChild(card);
    });
}
function renderGridLocal(key, id) { renderRowLocal(key, id); }

function tvIsFav(slug) {
    const list = JSON.parse(localStorage.getItem('favorites')||'[]');
    return list.some(i => i.slug === slug);
}

function tvToggleFav(anime) {
    let list = JSON.parse(localStorage.getItem('favorites')||'[]');
    if(tvIsFav(anime.slug)) {
        list = list.filter(i => i.slug !== anime.slug);
    } else {
        list.push({ slug: anime.slug, title: anime.title, cover: anime.cover });
    }
    localStorage.setItem('favorites', JSON.stringify(list));
    
    // Actualizar botón
    document.getElementById('tv-btn-fav').innerText = tvIsFav(anime.slug) ? "💔 Quitar" : "❤️ Favorito";
    // Actualizar listas visuales
    renderRowLocal('favorites', 'row-favs');
    renderGridLocal('favorites', 'tv-favorites-grid');
}

function tvAddToHistory(anime) {
    let list = JSON.parse(localStorage.getItem('animeHistory')||'[]');
    list = list.filter(i => i.slug !== anime.slug);
    list.unshift({ slug: anime.slug, title: anime.title, cover: anime.cover });
    localStorage.setItem('animeHistory', JSON.stringify(list.slice(0, 20)));
}

// 4. NUEVA FUNCIÓN: BORRAR CACHÉ (Para arreglar la TV)
window.borrarCaches = async () => {
    if('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        alert("Caché borrada. La App se reiniciará.");
        window.location.reload(true);
    }
};