const API_BASE = "https://animeflv.ahmedrangel.com/api";
const PROXIES = [ (u)=>u, (u)=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, (u)=>`https://corsproxy.io/?${encodeURIComponent(u)}` ];

let currentAnimeData = null; 
let currentEpisodeIndex = -1; 
let deferredPrompt;
let isTV = false;

// VARIABLES SCROLL
let searchPage = 1; let currentQuery = ""; let searchMode = ""; let isLoadingMore = false; let hasMoreResults = true;

const GENRE_MAP = {
    "Acción": "accion", "Artes Marciales": "artes-marciales", "Aventuras": "aventura", "Carreras": "carreras", "Ciencia Ficción": "ciencia-ficcion", "Comedia": "comedia", "Demencia": "demencia", "Demonios": "demonios", "Deportes": "deportes", "Drama": "drama", "Ecchi": "ecchi", "Escolares": "escolares", "Espacial": "espacial", "Fantasía": "fantasia", "Harem": "harem", "Histórico": "historico", "Infantil": "infantil", "Josei": "josei", "Juegos": "juegos", "Magia": "magia", "Mecha": "mecha", "Militar": "militar", "Misterio": "misterio", "Música": "musica", "Parodia": "parodia", "Policía": "policia", "Psicológico": "psicologico", "Recuentos de la vida": "recuentos-de-la-vida", "Romance": "romance", "Samurai": "samurai", "Seinen": "seinen", "Shoujo": "shoujo", "Shounen": "shounen", "Sobrenatural": "sobrenatural", "Superpoderes": "superpoderes", "Suspenso": "suspenso", "Terror (Gore)": "terror", "Vampiros": "vampiros", "Yaoi": "yaoi", "Yuri": "yuri"
};

// --- 1. LÓGICA DE SELECTOR DE MODO (TV vs MÓVIL) ---
window.onload = () => {
    // Detectar si ya eligió modo antes
    const savedMode = localStorage.getItem('appMode');
    if (savedMode) {
        selectMode(savedMode);
    } else {
        // Auto-detectar Smart TV por User Agent (opcional)
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes('smart-tv') || ua.includes('webos') || ua.includes('tizen')) {
            document.getElementById('btn-mode-tv').focus(); // Sugerir TV
        }
    }
    
    // Instalar Service Worker
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
    
    // Instalar PWA
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault(); deferredPrompt = e;
        const btn = document.getElementById('btn-install');
        if(btn) { btn.style.display = 'inline-block'; btn.onclick = () => { btn.style.display = 'none'; deferredPrompt.prompt(); }; }
    });
};

function selectMode(mode) {
    document.getElementById('device-selector').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    localStorage.setItem('appMode', mode);
    
    if (mode === 'tv') {
        isTV = true;
        document.body.classList.add('tv-mode');
        // En TV enfocamos el primer elemento automáticamente
        enfocarPrimerElemento('tab-home');
    } else {
        isTV = false;
        document.body.classList.remove('tv-mode');
    }
    
    // Iniciar App
    cargarEstrenos(); 
    renderHistorial(); 
    renderGeneros(); 
    renderFavorites();
    history.replaceState({ page: 'home' }, "", " ");
}

// --- UTILIDAD TV: ENFOCAR ---
function enfocarPrimerElemento(contenedorId) {
    if(!isTV) return;
    setTimeout(() => {
        const container = document.getElementById(contenedorId);
        if (container) {
            const primer = container.querySelector('.focusable');
            if (primer) primer.focus();
        }
    }, 200);
}

// --- 2. GESTIÓN DE DATOS (BACKUP) ---
function exportData() {
    const data = {
        favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
        history: JSON.parse(localStorage.getItem('animeHistory') || '[]'),
        watched: JSON.parse(localStorage.getItem('watchedList') || '[]')
    };
    const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "whustaf-backup.json";
    a.click();
}

function importData(input) {
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if(data.favorites) localStorage.setItem('favorites', JSON.stringify(data.favorites));
            if(data.history) localStorage.setItem('animeHistory', JSON.stringify(data.history));
            if(data.watched) localStorage.setItem('watchedList', JSON.stringify(data.watched));
            alert("¡Datos restaurados con éxito!");
            location.reload();
        } catch(err) { alert("Error al leer archivo"); }
    };
    reader.readAsText(file);
}

// --- HISTORIAL NAV ---
window.addEventListener('popstate', (event) => {
    const hash = window.location.hash;
    const player = document.getElementById('player-modal');
    const details = document.getElementById('details-modal');

    if (hash === '#player') {
        player.style.display = 'flex';
        details.style.display = 'none'; // Fix Doble X
        enfocarPrimerElemento('player-controls');
    } else if (hash === '#details') {
        player.style.display = 'none'; 
        document.getElementById('video-wrapper').innerHTML = ''; 
        details.style.display = 'block'; 
        setTimeout(() => document.getElementById('btn-play-latest').focus(), 100);
    } else {
        player.style.display = 'none';
        document.getElementById('video-wrapper').innerHTML = '';
        details.style.display = 'none';
        if(document.getElementById('tab-home').classList.contains('active')) enfocarPrimerElemento('grid-latest');
    }
});

function agregarHistorial(stateId) { 
    if(window.location.hash !== `#${stateId}`) {
        history.pushState({ page: stateId }, "", `#${stateId}`); 
    }
}

// --- TABS ---
function cambiarTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    // Manejo especial para settings
    const targetTab = document.getElementById(`tab-${tabId}`);
    if(targetTab) targetTab.classList.add('active');
    
    const navBtn = document.getElementById(`nav-${tabId}`);
    if(navBtn) navBtn.classList.add('active');
    
    window.scrollTo(0, 0);
    
    if(tabId === 'history') { renderHistorial(); enfocarPrimerElemento('grid-history'); }
    else if(tabId === 'favorites') { renderFavorites(); enfocarPrimerElemento('grid-favorites'); }
    else if(tabId === 'home') { enfocarPrimerElemento('grid-latest'); }
    else if(tabId === 'search') { document.getElementById('inp').focus(); }
    else if(tabId === 'settings') { enfocarPrimerElemento('tab-settings'); }
}

// --- FETCH ---
async function fetchData(endpoint) {
    if(!endpoint || endpoint.includes('undefined')) return null;
    for (const wrap of PROXIES) {
        try {
            const resp = await fetch(wrap(API_BASE + endpoint));
            if (!resp.ok) continue;
            let data = JSON.parse(await resp.text());
            if(data.contents) data = JSON.parse(data.contents);
            if (data.success) return data.data;
        } catch (e) {}
    }
    return null;
}

// --- GÉNEROS ---
function renderGeneros() {
    const container = document.getElementById('genre-list'); if(!container) return; container.innerHTML = '';
    const btnIsekai = document.createElement('button'); btnIsekai.className = 'genre-chip focusable'; btnIsekai.innerText = "Isekai"; btnIsekai.onclick = () => buscar("Isekai", true); container.appendChild(btnIsekai);
    Object.keys(GENRE_MAP).forEach(label => {
        const btn = document.createElement('button'); btn.className = 'genre-chip focusable'; btn.innerText = label; btn.onclick = () => buscar(label, false); container.appendChild(btn);
    });
}

// --- HOME & CARRUSEL ---
async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    const data = await fetchData('/list/latest-episodes');
    if (data) {
        grid.innerHTML = '';
        data.forEach(item => crearTarjeta(item, grid, 'latest'));
        
        // 3. CARRUSEL LOGIC
        const slider = document.getElementById('hero-wrapper');
        slider.innerHTML = '';
        // Tomamos los 5 primeros para el carrusel
        const top5 = data.slice(0, 5);
        top5.forEach(item => {
            const slide = document.createElement('div');
            slide.className = 'hero-item focusable';
            // Simulamos backdrop con la cover
            slide.innerHTML = `
                <img src="${item.cover}" class="hero-img">
                <div class="hero-caption">
                    <span class="hero-badge">NUEVO EPISODIO</span>
                    <h2 class="hero-title">${item.title}</h2>
                </div>
            `;
            slide.onclick = () => {
                const slugAnime = item.slug.split('-').slice(0, -1).join('-');
                cargarDetallesAnime(slugAnime);
            };
            slider.appendChild(slide);
        });

        if(isTV) enfocarPrimerElemento('grid-latest');
    }
}

// --- BUSCADOR ---
async function buscar(termino = null, esTexto = true) {
    let q = termino || document.getElementById('inp').value; if (!q) return;
    if (!termino) esTexto = true; else document.getElementById('inp').value = termino;
    searchPage = 1; currentQuery = q; searchMode = esTexto ? 'text' : 'genre'; hasMoreResults = true; isLoadingMore = false;
    const grid = document.getElementById('grid-search'); grid.innerHTML = '<div class="loader">Buscando...</div>';
    await cargarMasResultados(true);
}

async function cargarMasResultados(limpiar = false) {
    if(isLoadingMore || !hasMoreResults) return; isLoadingMore = true;
    const grid = document.getElementById('grid-search');
    let endpoint = searchMode === 'text' ? `/search?query=${encodeURIComponent(currentQuery)}&page=${searchPage}` : `/search/by-url?url=${encodeURIComponent(`https://www3.animeflv.net/browse?genre[]=${GENRE_MAP[currentQuery]}&order=default&page=${searchPage}`)}`;
    const data = await fetchData(endpoint);
    if (limpiar) grid.innerHTML = '';
    if (data && data.media && data.media.length > 0) {
        data.media.forEach(anime => crearTarjeta(anime, grid, 'search'));
        searchPage++; hasMoreResults = data.hasNextPage || false;
        if(limpiar && isTV) enfocarPrimerElemento('grid-search');
    } else { hasMoreResults = false; if (limpiar) grid.innerHTML = '<div class="placeholder-msg"><p>Sin resultados</p></div>'; }
    isLoadingMore = false;
}
window.addEventListener('scroll', () => {
    if(document.getElementById('tab-search').classList.contains('active')) {
        if (document.documentElement.scrollTop + document.documentElement.clientHeight >= document.documentElement.scrollHeight - 300 && hasMoreResults && !isLoadingMore) cargarMasResultados();
    }
});

// --- TARJETAS ---
function crearTarjeta(item, container, context) {
    const card = document.createElement('div'); card.className = 'anime-card focusable'; card.setAttribute('tabindex', '0');
    const img = item.cover || 'https://via.placeholder.com/150';
    let meta = context === 'latest' ? `Ep ${item.number}` : (context === 'search' ? (item.type || 'Anime') : `Ep ${item.lastEp}`);
    
    // 4. ETIQUETAS (BADGES)
    let badgeHTML = '';
    if(item.type) {
        let typeClass = 'st-tv';
        if(item.type === 'Movie') typeClass = 'st-movie';
        if(item.type === 'OVA') typeClass = 'st-ova';
        badgeHTML = `<span class="status-badge ${typeClass}">${item.type}</span>`;
    }

    card.innerHTML = `
        ${badgeHTML}
        <img src="${img}" loading="lazy">
        ${context === 'latest' ? '<div class="badge-new">NUEVO</div>' : ''}
        <div class="info"><span class="title">${item.title}</span><div class="meta">${meta}</div></div>
    `;
    
    card.onclick = () => {
        const realSlug = item.animeSlug || item.slug;
        if (context === 'search' || context === 'favorites') {
            cargarDetallesAnime(realSlug);
        } else if (context === 'latest') {
            const slugAnime = item.slug.split('-').slice(0, -1).join('-');
            cargarDetallesAnime(slugAnime).then(() => {
                if(currentAnimeData && currentAnimeData.episodes) {
                    currentEpisodeIndex = currentAnimeData.episodes.findIndex(e => e.number == item.number);
                    prepararReproductor(item.slug, item.title, item.number, img);
                }
            });
        } else { 
            cargarDetallesAnime(realSlug).then(()=>prepararReproductor(item.slug, item.title, item.lastEp, img)); 
        }
    };
    card.onkeydown = (e) => { if (e.key === 'Enter') card.click(); };
    container.appendChild(card);
}

// --- DETALLES ---
async function cargarDetallesAnime(slug) {
    if(!slug) return;
    if(window.location.hash !== '#details') { agregarHistorial('details'); }
    
    document.getElementById('details-modal').style.display = 'block';
    document.getElementById('player-modal').style.display = 'none';

    document.getElementById('det-title').innerText = 'Cargando...';
    document.getElementById('det-synopsis').innerText = '';
    document.getElementById('det-episodes').innerHTML = '<div class="loader">...</div>';
    document.getElementById('backdrop-img').style.backgroundImage = 'none';

    const info = await fetchData(`/anime/${slug}`);
    
    if(info) {
        // ORDEN ASCENDENTE (1, 2, 3...)
        if (info.episodes) {
            info.episodes.sort((a,b) => parseFloat(a.number) - parseFloat(b.number));
        }

        currentAnimeData = info; 
        document.getElementById('det-title').innerText = info.title;
        document.getElementById('det-synopsis').innerText = (info.synopsis || "Sin sinopsis.").substring(0, 300) + "...";
        document.getElementById('det-img').src = info.cover;
        document.getElementById('det-genres').innerHTML = info.genres.map(g=>`<span>${g}</span>`).join('');
        document.getElementById('backdrop-img').style.backgroundImage = `url('${info.cover}')`;

        updateFavButton();

        const grid = document.getElementById('det-episodes');
        grid.innerHTML = '';
        const watchedList = JSON.parse(localStorage.getItem('watchedList') || '[]');

        if(info.episodes.length > 0) {
            document.getElementById('btn-play-latest').onclick = () => {
                const lastIndex = info.episodes.length - 1;
                currentEpisodeIndex = lastIndex; 
                const lastEp = info.episodes[lastIndex];
                prepararReproductor(lastEp.slug, info.title, lastEp.number, info.cover);
            };
            
            info.episodes.forEach((ep, index) => {
                const b = document.createElement('div');
                b.className = 'ep-card focusable';
                b.setAttribute('tabindex', '0');
                if(watchedList.includes(ep.slug)) b.classList.add('watched');
                b.innerText = `Ep ${ep.number}`;
                b.onclick = () => {
                    currentEpisodeIndex = index; 
                    prepararReproductor(ep.slug, info.title, ep.number, info.cover);
                };
                b.onkeydown = (e) => { if (e.key === 'Enter') b.click(); };
                grid.appendChild(b);
            });
            setTimeout(() => document.getElementById('btn-play-latest').focus(), 100);
        }
    }
}

function cerrarDetalles() { history.back(); }

// --- REPRODUCTOR ---
async function prepararReproductor(slug, title, number, cover) {
    agregarHistorial('player');
    document.getElementById('player-modal').style.display = 'flex';
    document.getElementById('details-modal').style.display = 'none'; // FIX DOBLE X
    document.getElementById('player-title').innerText = `Ep ${number}: ${title}`;
    document.getElementById('video-wrapper').innerHTML = '';
    document.getElementById('server-list').innerHTML = 'Cargando...';
    
    if(currentAnimeData) guardarHistorial({animeSlug: currentAnimeData.slug, slug:slug, title:title, lastEp:number, cover:cover});
    marcarComoVisto(slug);

    const btnNext = document.getElementById('btn-next-ep');
    
    // Lógica Siguiente (ASCENDENTE)
    if (currentAnimeData && currentEpisodeIndex < currentAnimeData.episodes.length - 1) {
        btnNext.style.display = 'block';
        btnNext.onclick = () => {
            const nextEp = currentAnimeData.episodes[currentEpisodeIndex + 1];
            currentEpisodeIndex++; 
            history.replaceState({ page: 'player' }, "", `#player`); 
            prepararReproductor(nextEp.slug, currentAnimeData.title, nextEp.number, currentAnimeData.cover);
        };
    } else {
        btnNext.style.display = 'none';
    }

    const data = await fetchData(`/anime/episode/${slug}`);
    document.getElementById('server-list').innerHTML = '';
    
    if(data && data.servers) {
        const prio = ["Okru", "YourUpload", "Maru", "Netu", "Streamwish", "Mega"];
        data.servers.sort((a,b) => {
            const pa = prio.indexOf(a.name); const pb = prio.indexOf(b.name);
            return (pa===-1?99:pa) - (pb===-1?99:pb);
        });
        
        data.servers.forEach((s, i) => {
            const btn = document.createElement('button');
            btn.className = 'focusable';
            btn.setAttribute('tabindex', '0');
            btn.innerText = s.name;
            btn.onclick = () => {
                document.querySelectorAll('.server-list button').forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('video-wrapper').innerHTML = `<iframe src="${s.embed || s.code || s.url}" frameborder="0" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" style="width:100%; height:100%;"></iframe>`;
            };
            btn.onkeydown = (e) => { if (e.key === 'Enter') btn.click(); };
            document.getElementById('server-list').appendChild(btn);
            if(i===0) btn.click();
        });
        
        enfocarPrimerElemento('server-list');
    } else { document.getElementById('server-list').innerHTML = 'Error servidores'; }
}

function cerrarReproductor() { history.back(); }
function abrirDetallesDesdePlayer() { history.back(); }

// --- FAVORITOS ---
function toggleFavorite() {
    if(!currentAnimeData) return;
    let favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const index = favs.findIndex(f => f.slug === currentAnimeData.slug);
    if(index === -1) {
        favs.push({ slug: currentAnimeData.slug, title: currentAnimeData.title, cover: currentAnimeData.cover, type: currentAnimeData.type });
    } else { favs.splice(index, 1); }
    localStorage.setItem('favorites', JSON.stringify(favs));
    updateFavButton(); renderFavorites();
}

function updateFavButton() {
    const btn = document.getElementById('btn-fav');
    let favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const isFav = favs.some(f => f.slug === currentAnimeData.slug);
    if(isFav) { btn.innerHTML = "💔 Quitar de Favoritos"; btn.classList.add('is-fav'); } 
    else { btn.innerHTML = "❤️ Agregar a Favoritos"; btn.classList.remove('is-fav'); }
}

function renderFavorites() {
    const grid = document.getElementById('grid-favorites');
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    grid.innerHTML = '';
    if(favs.length === 0) grid.innerHTML = '<div class="placeholder-msg"><p>Sin favoritos</p></div>';
    favs.forEach(item => crearTarjeta(item, grid, 'favorites'));
}

// --- HISTORIAL ---
function marcarComoVisto(epSlug) {
    let list = JSON.parse(localStorage.getItem('watchedList') || '[]');
    if(!list.includes(epSlug)) list.push(epSlug);
    localStorage.setItem('watchedList', JSON.stringify(list));
}
function renderHistorial() {
    const grid = document.getElementById('grid-history');
    const h = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    grid.innerHTML = '';
    if(h.length===0) grid.innerHTML = '<div class="placeholder-msg"><p>Sin historial</p></div>';
    h.reverse().forEach(i => crearTarjeta(i, grid, 'history'));
}
function guardarHistorial(i) {
    let h = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    h = h.filter(x => x.animeSlug !== i.animeSlug);
    h.push(i);
    if(h.length>50) h.shift();
    localStorage.setItem('animeHistory', JSON.stringify(h));
}
function borrarHistorial() { if(confirm("¿Borrar?")) { localStorage.removeItem('animeHistory'); renderHistorial(); } }