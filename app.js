const API_BASE = "https://animeflv.ahmedrangel.com/api";
const PROXIES = [ (u)=>u, (u)=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, (u)=>`https://corsproxy.io/?${encodeURIComponent(u)}` ];

let currentAnimeData = null; 
let currentEpisodeIndex = -1; 
let isTV = false;
let deferredPrompt;

// CONFIG
const GENRE_MAP = { "Acción": "accion", "Aventuras": "aventura", "Comedia": "comedia", "Drama": "drama", "Ecchi": "ecchi", "Escolares": "escolares", "Fantasía": "fantasia", "Harem": "harem", "Magia": "magia", "Mecha": "mecha", "Militar": "militar", "Misterio": "misterio", "Música": "musica", "Deportes": "deportes", "Romance": "romance", "Ciencia Ficción": "ciencia-ficcion", "Seinen": "seinen", "Shoujo": "shoujo", "Shounen": "shounen", "Sobrenatural": "sobrenatural", "Suspenso": "suspenso", "Terror (Gore)": "terror", "Vampiros": "vampiros", "Yaoi": "yaoi", "Yuri": "yuri", "Isekai": "isekai" };

// --- INICIO ---
window.onload = () => {
    // Verificar modo guardado
    const savedMode = localStorage.getItem('appMode');
    if (savedMode) selectMode(savedMode);
    else if (navigator.userAgent.toLowerCase().includes('smart')) document.getElementById('btn-mode-tv').focus();

    // PWA
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; document.getElementById('btn-install').style.display='block'; document.getElementById('btn-install').onclick = () => deferredPrompt.prompt(); });
};

function selectMode(mode) {
    isTV = (mode === 'tv');
    document.body.classList.toggle('tv-mode', isTV);
    document.getElementById('device-selector').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    localStorage.setItem('appMode', mode);
    
    // Iniciar
    cargarEstrenos();
    renderGeneros();
    if(!isTV) { renderFavorites(); renderHistorial(); } // En móvil renderizamos tabs normales
    history.replaceState({page:'home'}, "", "");
    
    if(isTV) setTimeout(() => document.querySelector('.hero-btn.primary').focus(), 500); // Foco al botón Play del Hero
}

// --- UTILIDAD TV: ENFOCAR ---
function enfocarPrimerElemento(id) {
    if(!isTV) return;
    setTimeout(() => {
        const el = document.getElementById(id)?.querySelector('.focusable');
        if(el) el.focus();
    }, 200);
}

// --- DATA FETCH ---
async function fetchData(endpoint) {
    if(!endpoint || endpoint.includes('undefined')) return null;
    for (const wrap of PROXIES) {
        try {
            const resp = await fetch(wrap(API_BASE + endpoint));
            if(!resp.ok) continue;
            let data = JSON.parse(await resp.text());
            if(data.contents) data = JSON.parse(data.contents);
            return data.success ? data.data : null;
        } catch(e){}
    }
    return null;
}

// --- HOME LOGIC (NETFLIX STYLE) ---
async function cargarEstrenos() {
    const data = await fetchData('/list/latest-episodes');
    if(!data) return;

    // 1. LLENAR HERO (Usamos el primero de la lista)
    const heroItem = data[0];
    document.getElementById('hero-title').innerText = heroItem.title;
    document.getElementById('hero-desc').innerText = `Nuevo Episodio ${heroItem.number}`;
    document.getElementById('hero-backdrop').style.backgroundImage = `url('${heroItem.cover}')`;
    
    document.getElementById('hero-play').onclick = () => {
        // Truco: cargar detalles y luego play
        const slug = heroItem.slug.split('-').slice(0,-1).join('-');
        cargarDetallesAnime(slug).then(() => {
             prepararReproductor(heroItem.slug, heroItem.title, heroItem.number, heroItem.cover);
        });
    };
    document.getElementById('hero-details').onclick = () => cargarDetallesAnime(heroItem.slug.split('-').slice(0,-1).join('-'));

    // 2. FILA ESTRENOS
    const grid = document.getElementById('grid-latest');
    grid.innerHTML = '';
    data.forEach(item => crearTarjeta(item, grid));

    // 3. FILAS EXTRA EN HOME (SOLO TV o SI HAY DATOS)
    renderHomeRow('history', 'grid-home-history', 'row-history');
    renderHomeRow('favorites', 'grid-home-favorites', 'row-favorites');
}

function renderHomeRow(type, gridId, rowId) {
    const list = JSON.parse(localStorage.getItem(type === 'history' ? 'animeHistory' : 'favorites') || '[]');
    const grid = document.getElementById(gridId);
    const row = document.getElementById(rowId);
    
    if(list.length > 0) {
        row.style.display = 'block';
        grid.innerHTML = '';
        list.slice(0, 15).forEach(item => crearTarjeta(item, grid)); // Max 15 items en Home
    } else {
        row.style.display = 'none';
    }
}

// --- TARJETAS ---
function crearTarjeta(item, container) {
    const card = document.createElement('div');
    card.className = 'anime-card focusable';
    card.setAttribute('tabindex', '0'); // Crucial para TV
    
    // Detectar tipo (simple)
    let badge = '';
    if(item.type) badge = `<span class="status-badge ${item.type === 'Movie' ? 'st-movie' : 'st-tv'}">${item.type}</span>`;
    
    const epNum = item.number || item.lastEp || '?';
    card.innerHTML = `
        ${badge}
        <img src="${item.cover}" loading="lazy">
        <span class="badge-new">Ep ${epNum}</span>
        <div class="info"><span class="title">${item.title}</span></div>
    `;
    
    card.onclick = () => {
        // Lógica unificada de click
        const slug = item.animeSlug || (item.slug.includes('-episodio-') ? item.slug.split('-').slice(0,-1).join('-') : item.slug);
        cargarDetallesAnime(slug).then(() => {
            if(isTV && item.number) { 
                // Opcional: Auto-play en TV
            }
        });
    };
    // Enter key support
    card.onkeydown = (e) => { if(e.key === 'Enter') card.click(); };
    container.appendChild(card);
}

// --- DETALLES ---
async function cargarDetallesAnime(slug) {
    if(!slug) return;
    agregarHistorial('details');
    const modal = document.getElementById('details-modal');
    modal.style.display = 'block';
    // Enfocar botón cerrar o play
    setTimeout(() => document.getElementById('btn-play-latest').focus(), 200);

    const info = await fetchData(`/anime/${slug}`);
    if(info) {
        currentAnimeData = info;
        // Orden ascendente 1..2..3
        info.episodes.sort((a,b) => parseFloat(a.number) - parseFloat(b.number));
        
        document.getElementById('det-title').innerText = info.title;
        document.getElementById('det-synopsis').innerText = (info.synopsis||"").substring(0, 300)+'...';
        document.getElementById('det-img').src = info.cover;
        document.querySelector('.backdrop-img').style.backgroundImage = `url('${info.cover}')`;
        document.getElementById('det-genres').innerHTML = info.genres.map(g => `<span>${g}</span>`).join('');
        
        updateFavButton();

        // Botón Continuar
        document.getElementById('btn-play-latest').onclick = () => {
            // Buscar último visto o el último episodio (final array)
            const lastIndex = info.episodes.length - 1;
            const ep = info.episodes[lastIndex];
            currentEpisodeIndex = lastIndex;
            prepararReproductor(ep.slug, info.title, ep.number, info.cover);
        };

        // Grid Episodios
        const grid = document.getElementById('det-episodes');
        grid.innerHTML = '';
        const watched = JSON.parse(localStorage.getItem('watchedList') || '[]');
        
        info.episodes.forEach((ep, idx) => {
            const btn = document.createElement('div');
            btn.className = 'ep-card focusable';
            btn.setAttribute('tabindex', '0');
            btn.innerText = ep.number;
            if(watched.includes(ep.slug)) btn.classList.add('watched');
            
            btn.onclick = () => {
                currentEpisodeIndex = idx;
                prepararReproductor(ep.slug, info.title, ep.number, info.cover);
            };
            btn.onkeydown = (e) => { if(e.key === 'Enter') btn.click(); };
            grid.appendChild(btn);
        });
    }
}

// --- PLAYER ---
async function prepararReproductor(slug, title, number, cover) {
    agregarHistorial('player');
    const player = document.getElementById('player-modal');
    player.style.display = 'flex';
    document.getElementById('details-modal').style.display = 'none'; // Ocultar detalles
    document.getElementById('player-title').innerText = `Ep ${number}: ${title}`;
    
    // Guardar Historial
    let hist = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    hist = hist.filter(x => x.animeSlug !== currentAnimeData.slug); // Borrar anterior
    hist.unshift({ // Agregar al principio
        animeSlug: currentAnimeData.slug,
        title: currentAnimeData.title,
        cover: currentAnimeData.cover,
        lastEp: number,
        type: currentAnimeData.type
    });
    localStorage.setItem('animeHistory', JSON.stringify(hist));
    
    // Marcar Visto
    let watched = JSON.parse(localStorage.getItem('watchedList') || '[]');
    if(!watched.includes(slug)) watched.push(slug);
    localStorage.setItem('watchedList', JSON.stringify(watched));

    // Botón Siguiente
    const btnNext = document.getElementById('btn-next-ep');
    if(currentEpisodeIndex < currentAnimeData.episodes.length - 1) {
        btnNext.style.display = 'block';
        btnNext.onclick = () => {
            currentEpisodeIndex++;
            const next = currentAnimeData.episodes[currentEpisodeIndex];
            prepararReproductor(next.slug, currentAnimeData.title, next.number, currentAnimeData.cover);
        };
    } else {
        btnNext.style.display = 'none';
    }

    // Cargar Video
    const data = await fetchData(`/anime/episode/${slug}`);
    const list = document.getElementById('server-list');
    list.innerHTML = '';
    
    if(data && data.servers) {
        data.servers.forEach((s, i) => {
            const btn = document.createElement('button');
            btn.innerText = s.name;
            btn.className = 'focusable';
            btn.setAttribute('tabindex', '0');
            btn.onclick = () => {
                document.querySelectorAll('#server-list button').forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('video-wrapper').innerHTML = `<iframe src="${s.embed || s.url}" allowfullscreen></iframe>`;
            };
            list.appendChild(btn);
            if(i===0) btn.click();
        });
        enfocarPrimerElemento('server-list');
    }
}

// --- UTILS ---
function cerrarDetalles() { history.back(); }
function cerrarReproductor() { history.back(); }
function abrirDetallesDesdePlayer() { history.back(); } // Volver a details

// --- BACKUP ---
function exportData() {
    const d = { f: localStorage.getItem('favorites'), h: localStorage.getItem('animeHistory'), w: localStorage.getItem('watchedList') };
    const b = new Blob([JSON.stringify(d)],{type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download='whustaf-data.json'; a.click();
}
function importData(el) {
    const r = new FileReader();
    r.onload = e => {
        const d = JSON.parse(e.target.result);
        if(d.f) localStorage.setItem('favorites', d.f);
        if(d.h) localStorage.setItem('animeHistory', d.h);
        if(d.w) localStorage.setItem('watchedList', d.w);
        alert('Datos cargados!'); location.reload();
    };
    r.readAsText(el.files[0]);
}

// --- FAVORITOS ---
function toggleFavorite() {
    let favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const idx = favs.findIndex(f => f.slug === currentAnimeData.slug);
    if(idx === -1) favs.unshift({slug: currentAnimeData.slug, title: currentAnimeData.title, cover: currentAnimeData.cover, type: currentAnimeData.type});
    else favs.splice(idx, 1);
    localStorage.setItem('favorites', JSON.stringify(favs));
    updateFavButton();
    renderHomeRow('favorites', 'grid-home-favorites', 'row-favorites'); // Actualizar fila home
}
function updateFavButton() {
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const isFav = favs.some(f => f.slug === currentAnimeData.slug);
    document.getElementById('btn-fav').innerText = isFav ? "💔 Quitar" : "❤️ Favoritos";
}

// --- GENEROS & BUSCADOR ---
function renderGeneros() {
    const c = document.getElementById('genre-list'); c.innerHTML='';
    Object.keys(GENRE_MAP).forEach(k => {
        const b = document.createElement('button'); b.className='genre-chip focusable'; b.innerText=k;
        b.onclick=()=>buscar(k, false); c.appendChild(b);
    });
}
function renderHistorial() { /* Render standard grid for mobile tab */ }
function renderFavorites() { /* Render standard grid for mobile tab */ }

// --- NAV ---
window.addEventListener('popstate', () => {
    const h = window.location.hash;
    document.getElementById('player-modal').style.display = h === '#player' ? 'flex' : 'none';
    document.getElementById('details-modal').style.display = h === '#details' ? 'block' : 'none';
    if(h === '#player') document.getElementById('details-modal').style.display = 'none'; // Fix Doble
});
function agregarHistorial(h) { if(window.location.hash !== `#${h}`) history.pushState({p:h},'',`#${h}`); }
function cambiarTab(id) {
    document.querySelectorAll('.tab-content').forEach(d=>d.classList.remove('active'));
    document.getElementById(`tab-${id}`).classList.add('active');
}