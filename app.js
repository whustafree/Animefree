const API_BASE = "https://animeflv.ahmedrangel.com/api";
const PROXIES = [ (u)=>u, (u)=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, (u)=>`https://corsproxy.io/?${encodeURIComponent(u)}` ];

let currentAnimeData = null; // Guardamos toda la info del anime
let currentEpisodeIndex = -1; // Para saber cuál es el siguiente
let deferredPrompt;

// VARIABLES SCROLL
let searchPage = 1; let currentQuery = ""; let searchMode = ""; let isLoadingMore = false; let hasMoreResults = true;

const GENRE_MAP = {
    "Acción": "accion", "Artes Marciales": "artes-marciales", "Aventuras": "aventura", "Carreras": "carreras", "Ciencia Ficción": "ciencia-ficcion", "Comedia": "comedia", "Demencia": "demencia", "Demonios": "demonios", "Deportes": "deportes", "Drama": "drama", "Ecchi": "ecchi", "Escolares": "escolares", "Espacial": "espacial", "Fantasía": "fantasia", "Harem": "harem", "Histórico": "historico", "Infantil": "infantil", "Josei": "josei", "Juegos": "juegos", "Magia": "magia", "Mecha": "mecha", "Militar": "militar", "Misterio": "misterio", "Música": "musica", "Parodia": "parodia", "Policía": "policia", "Psicológico": "psicologico", "Recuentos de la vida": "recuentos-de-la-vida", "Romance": "romance", "Samurai": "samurai", "Seinen": "seinen", "Shoujo": "shoujo", "Shounen": "shounen", "Sobrenatural": "sobrenatural", "Superpoderes": "superpoderes", "Suspenso": "suspenso", "Terror (Gore)": "terror", "Vampiros": "vampiros", "Yaoi": "yaoi", "Yuri": "yuri"
};

// --- INSTALACIÓN ---
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; const btn = document.getElementById('btn-install'); if(btn) { btn.style.display = 'inline-block'; btn.onclick = () => { btn.style.display = 'none'; deferredPrompt.prompt(); }; } });

// --- HISTORIAL NAV ---
window.addEventListener('popstate', () => {
    if(document.getElementById('player-modal').style.display === 'flex') { cerrarReproductor(); return; }
    if(document.getElementById('details-modal').style.display === 'block') { cerrarDetalles(); return; }
    if(!document.getElementById('tab-home').classList.contains('active')) { cambiarTab('home'); }
});
function agregarHistorial(stateId) { history.pushState({ page: stateId }, "", `#${stateId}`); }

// --- TABS ---
function cambiarTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`nav-${tabId}`).classList.add('active');
    window.scrollTo(0, 0);
    if(tabId === 'history') renderHistorial();
    if(tabId === 'favorites') renderFavorites();
}

// --- FETCH ---
async function fetchData(endpoint) {
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

window.onload = () => { 
    cargarEstrenos(); renderHistorial(); renderGeneros(); renderFavorites();
    history.replaceState({ page: 'home' }, "", ""); 
};

// --- GÉNEROS ---
function renderGeneros() {
    const container = document.getElementById('genre-list'); if(!container) return; container.innerHTML = '';
    const btnIsekai = document.createElement('button'); btnIsekai.className = 'genre-chip focusable'; btnIsekai.innerText = "Isekai"; btnIsekai.onclick = () => buscar("Isekai", true); container.appendChild(btnIsekai);
    Object.keys(GENRE_MAP).forEach(label => {
        const btn = document.createElement('button'); btn.className = 'genre-chip focusable'; btn.innerText = label; btn.onclick = () => buscar(label, false); container.appendChild(btn);
    });
}

// --- HOME ---
async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    // Skeleton ya está en HTML, lo limpiamos al cargar
    const data = await fetchData('/list/latest-episodes');
    if (data) {
        grid.innerHTML = '';
        data.forEach(item => crearTarjeta(item, grid, 'latest'));
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
    card.innerHTML = `<img src="${img}" loading="lazy">${context === 'latest' ? '<div class="badge-new">NUEVO</div>' : ''}<div class="info"><span class="title">${item.title}</span><div class="meta">${meta}</div></div>`;
    card.onclick = () => {
        if (context === 'search' || context === 'favorites') cargarDetallesAnime(item.slug);
        else if (context === 'latest') {
            const slugAnime = item.slug.split('-').slice(0, -1).join('-');
            // Cargar info del anime primero para poder navegar
            cargarDetallesAnime(slugAnime).then(() => {
                // Luego buscar el episodio específico
                // Nota: esto es un hack, idealmente el player se abre sobre los detalles
                // pero por simplicidad abrimos directo.
                // Mejor estrategia: Abrir detalles SIEMPRE primero para cargar la lista de episodios.
                // Luego abrir player.
            });
        } else { cargarDetallesAnime(item.animeSlug).then(()=>prepararReproductor(item.slug, item.title, item.lastEp, img)); }
    };
    container.appendChild(card);
}

// --- DETALLES ---
async function cargarDetallesAnime(slug) {
    agregarHistorial('details');
    document.getElementById('details-modal').style.display = 'block';
    
    // Reset UI
    document.getElementById('det-title').innerText = 'Cargando...';
    document.getElementById('det-synopsis').innerText = '';
    document.getElementById('det-episodes').innerHTML = '<div class="loader">...</div>';
    document.getElementById('backdrop-img').style.backgroundImage = 'none';

    const info = await fetchData(`/anime/${slug}`);
    
    if(info) {
        currentAnimeData = info; // Guardar para uso global
        document.getElementById('det-title').innerText = info.title;
        document.getElementById('det-synopsis').innerText = (info.synopsis || "Sin sinopsis.").substring(0, 300) + "...";
        document.getElementById('det-img').src = info.cover;
        document.getElementById('det-genres').innerHTML = info.genres.map(g=>`<span>${g}</span>`).join('');
        
        // BACKDROP (Imagen de fondo difuminada)
        document.getElementById('backdrop-img').style.backgroundImage = `url('${info.cover}')`;

        // FAVORITOS
        updateFavButton();

        // EPISODIOS
        const grid = document.getElementById('det-episodes');
        grid.innerHTML = '';
        const watchedList = JSON.parse(localStorage.getItem('watchedList') || '[]');

        if(info.episodes.length > 0) {
            // Botón Play Último
            document.getElementById('btn-play-latest').onclick = () => 
                prepararReproductor(info.episodes[0].slug, info.title, info.episodes[0].number, info.cover);
            
            info.episodes.forEach((ep, index) => {
                const b = document.createElement('div');
                b.className = 'ep-card focusable';
                if(watchedList.includes(ep.slug)) b.classList.add('watched'); // Marcar visto
                b.innerText = `Ep ${ep.number}`;
                b.onclick = () => {
                    currentEpisodeIndex = index; // Guardar índice para botón siguiente
                    prepararReproductor(ep.slug, info.title, ep.number, info.cover);
                };
                grid.appendChild(b);
            });
        }
    }
}
function cerrarDetalles() { document.getElementById('details-modal').style.display = 'none'; history.back(); }

// --- REPRODUCTOR ---
async function prepararReproductor(slug, title, number, cover) {
    agregarHistorial('player');
    document.getElementById('player-modal').style.display = 'flex';
    document.getElementById('player-title').innerText = `Ep ${number}: ${title}`;
    document.getElementById('video-wrapper').innerHTML = '';
    document.getElementById('server-list').innerHTML = 'Cargando...';
    
    // 1. Guardar en Historial
    if(currentAnimeData) guardarHistorial({animeSlug: currentAnimeData.slug, slug:slug, title:title, lastEp:number, cover:cover});
    
    // 2. Marcar como Visto
    marcarComoVisto(slug);

    // 3. Botón Siguiente
    const btnNext = document.getElementById('btn-next-ep');
    // Verificar si existe un episodio anterior en el array (que es el siguiente numéricamente)
    if (currentAnimeData && currentEpisodeIndex > 0) {
        btnNext.style.display = 'block';
        btnNext.onclick = () => {
            const nextEp = currentAnimeData.episodes[currentEpisodeIndex - 1]; // Array descendente
            currentEpisodeIndex--; // Actualizar índice
            // Recursividad para cargar el siguiente sin cerrar modal
            prepararReproductor(nextEp.slug, currentAnimeData.title, nextEp.number, currentAnimeData.cover);
            // Corregir historial duplicado (opcional, hack rápido)
            history.back(); 
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
            btn.innerText = s.name;
            btn.onclick = () => {
                document.querySelectorAll('.server-list button').forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('video-wrapper').innerHTML = `<iframe src="${s.embed || s.code || s.url}" frameborder="0" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" style="width:100%; height:100%;"></iframe>`;
            };
            document.getElementById('server-list').appendChild(btn);
            if(i===0) btn.click();
        });
    } else { document.getElementById('server-list').innerHTML = 'Error servidores'; }
}
function cerrarReproductor() { document.getElementById('player-modal').style.display = 'none'; document.getElementById('video-wrapper').innerHTML=''; history.back(); setTimeout(()=>cargarDetallesAnime(currentAnimeData.slug), 200); } // Recargar detalles para actualizar "Visto"
function abrirDetallesDesdePlayer() { document.getElementById('player-modal').style.display = 'none'; document.getElementById('video-wrapper').innerHTML=''; history.back(); }

// --- FAVORITOS ---
function toggleFavorite() {
    if(!currentAnimeData) return;
    let favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const index = favs.findIndex(f => f.slug === currentAnimeData.slug);
    
    if(index === -1) {
        // Agregar
        favs.push({ slug: currentAnimeData.slug, title: currentAnimeData.title, cover: currentAnimeData.cover, type: currentAnimeData.type });
    } else {
        // Quitar
        favs.splice(index, 1);
    }
    localStorage.setItem('favorites', JSON.stringify(favs));
    updateFavButton();
    renderFavorites(); // Actualizar pestaña fondo
}

function updateFavButton() {
    const btn = document.getElementById('btn-fav');
    let favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const isFav = favs.some(f => f.slug === currentAnimeData.slug);
    
    if(isFav) {
        btn.innerHTML = "💔 Quitar de Favoritos";
        btn.classList.add('is-fav');
    } else {
        btn.innerHTML = "❤️ Agregar a Favoritos";
        btn.classList.remove('is-fav');
    }
}

function renderFavorites() {
    const grid = document.getElementById('grid-favorites');
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    grid.innerHTML = '';
    if(favs.length === 0) grid.innerHTML = '<div class="placeholder-msg"><p>Sin favoritos</p></div>';
    favs.forEach(item => crearTarjeta(item, grid, 'favorites'));
}

// --- HISTORIAL & VISTOS ---
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