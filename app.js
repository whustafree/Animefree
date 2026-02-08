const API_BASE = "https://animeflv.ahmedrangel.com/api";
const PROXIES = [ (u)=>u, (u)=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, (u)=>`https://corsproxy.io/?${encodeURIComponent(u)}` ];
let currentAnimeSlug = null;
let deferredPrompt;

// --- INSTALACIÓN ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    const btn = document.getElementById('btn-install');
    if(btn) { btn.style.display = 'block'; btn.onclick = () => { btn.style.display = 'none'; deferredPrompt.prompt(); }; }
});

// --- HISTORIAL DE NAVEGACIÓN ---
window.addEventListener('popstate', () => {
    const player = document.getElementById('player-modal');
    const details = document.getElementById('details-modal');
    
    // Si hay modales abiertos, cerrarlos
    if (player && player.style.display === 'flex') { player.style.display = 'none'; document.getElementById('video-wrapper').innerHTML = ''; return; }
    if (details && details.style.display === 'block') { details.style.display = 'none'; return; }
    
    // Si estamos en Buscar o Historial y damos atrás, volver a Inicio
    const home = document.getElementById('view-home');
    if (!home.classList.contains('active')) { cambiarVista('home'); return; }
});
function agregarHistorial(stateId) { history.pushState({ page: stateId }, "", `#${stateId}`); }

// --- CORE ---
async function fetchData(endpoint) {
    for (const wrap of PROXIES) {
        try {
            const resp = await fetch(wrap(API_BASE + endpoint));
            if (!resp.ok) continue;
            const text = await resp.text();
            let data = JSON.parse(text);
            if(data.contents) data = JSON.parse(data.contents);
            if (data.success) return data.data;
        } catch (e) {}
    }
    return null;
}

window.onload = () => { 
    cargarEstrenos(); 
    renderHistorial(); 
    history.replaceState({ page: 'home' }, "", "");
};

// --- NAVEGACIÓN ENTRE PESTAÑAS ---
function cambiarVista(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`view-${id}`).classList.add('active');
    document.getElementById(`btn-${id}`).classList.add('active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Cargar datos específicos si es necesario
    if(id === 'history') renderHistorial();
    if(id === 'search') document.getElementById('inp').focus();
}

async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    const data = await fetchData('/list/latest-episodes');
    grid.innerHTML = '';
    if (data) data.forEach(item => crearTarjeta(item, grid, 'latest'));
}

async function buscar() {
    const q = document.getElementById('inp').value;
    if (!q) return;
    
    const grid = document.getElementById('grid-search');
    grid.innerHTML = '<div class="loader">Buscando...</div>';
    
    const data = await fetchData(`/search?query=${encodeURIComponent(q)}`);
    grid.innerHTML = '';
    
    if (data && data.media) data.media.forEach(anime => crearTarjeta(anime, grid, 'search'));
    else grid.innerHTML = '<div class="empty-msg">No se encontraron resultados.</div>';
}

function crearTarjeta(item, container, context) {
    const card = document.createElement('div');
    card.className = 'anime-card focusable';
    card.setAttribute('tabindex', '0'); 
    
    const img = item.cover || 'https://via.placeholder.com/150';
    const title = item.title;
    let meta = context === 'latest' ? `Ep ${item.number}` : (context === 'search' ? (item.type || 'Anime') : `Ep ${item.lastEp}`);

    card.innerHTML = `<img src="${img}" loading="lazy">${context === 'latest' ? '<div class="badge-new">NUEVO</div>' : ''}<div class="info"><span class="title">${title}</span><div class="meta">${meta}</div></div>`;
    
    card.onclick = () => {
        if (context === 'search') cargarDetallesAnime(item.slug);
        else if (context === 'latest') {
            const partes = item.slug.split('-'); partes.pop(); 
            currentAnimeSlug = partes.join('-'); 
            prepararReproductor(item.slug, item.title, item.number, img);
        } else {
            prepararReproductor(item.slug, item.title, item.lastEp, img);
            currentAnimeSlug = item.animeSlug;
        }
    };
    container.appendChild(card);
}

// ... (MANTÉN LAS FUNCIONES DE DETALLES, REPRODUCTOR, HISTORIAL Y UTILS IGUAL QUE EN LA V20) ...
// Para ahorrar espacio aquí, copia las funciones: cargarDetallesAnime, cerrarDetalles, prepararReproductor, renderHistorial, guardarHistorial, borrarHistorial de la versión anterior. Son idénticas.

// --- DETALLES ---
async function cargarDetallesAnime(slug) {
    currentAnimeSlug = slug;
    agregarHistorial('details');
    const modal = document.getElementById('details-modal');
    modal.style.display = 'block';
    modal.scrollTop = 0;
    document.getElementById('det-title').innerText = 'Cargando...';
    document.getElementById('det-episodes').innerHTML = '<div class="loader">...</div>';
    const info = await fetchData(`/anime/${slug}`);
    if (info) {
        document.getElementById('det-title').innerText = info.title;
        document.getElementById('det-synopsis').innerText = info.synopsis || "Sin sinopsis.";
        document.getElementById('det-img').src = info.cover;
        const genresDiv = document.getElementById('det-genres');
        genresDiv.innerHTML = info.genres.map(g => `<span>${g}</span>`).join('');
        const epList = document.getElementById('det-episodes');
        epList.innerHTML = '';
        if (info.episodes && info.episodes.length > 0) {
            const lastEp = info.episodes[0];
            const btnPlay = document.getElementById('btn-play-latest');
            if(btnPlay) btnPlay.onclick = () => prepararReproductor(lastEp.slug, info.title, lastEp.number, info.cover);
            info.episodes.forEach(ep => {
                const btn = document.createElement('div');
                btn.className = 'ep-card focusable';
                btn.setAttribute('tabindex', '0');
                btn.innerText = `Ep ${ep.number}`;
                btn.onclick = () => prepararReproductor(ep.slug, info.title, ep.number, info.cover);
                epList.appendChild(btn);
            });
        }
    }
}
function cerrarDetalles() { history.back(); }

async function prepararReproductor(slug, title, number, cover) {
    agregarHistorial('player');
    const modal = document.getElementById('player-modal');
    modal.style.display = 'flex';
    document.getElementById('player-title').innerText = `${title} - Ep ${number}`;
    document.getElementById('video-wrapper').innerHTML = '';
    if (currentAnimeSlug) guardarHistorial({ animeSlug: currentAnimeSlug, slug: slug, title: title, lastEp: number, cover: cover });
    const list = document.getElementById('server-list');
    list.innerHTML = 'Cargando servidores...';
    const data = await fetchData(`/anime/episode/${slug}`);
    list.innerHTML = '';
    if (data && data.servers) {
        const prioridad = ["Okru", "YourUpload", "Maru", "Netu", "Streamwish", "Mega"];
        data.servers.sort((a, b) => {
            const pA = prioridad.indexOf(a.name);
            const pB = prioridad.indexOf(b.name);
            return (pA === -1 ? 99 : pA) - (pB === -1 ? 99 : pB);
        });
        data.servers.forEach((s, i) => {
            const btn = document.createElement('button');
            btn.className = 'focusable';
            btn.setAttribute('tabindex', '0');
            btn.innerText = s.name;
            const url = s.embed || s.code || s.url;
            btn.onclick = () => {
                document.querySelectorAll('.server-list button').forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                const iframeHTML = `<iframe src="${url}" allowfullscreen allow="autoplay; encrypted-media; fullscreen" style="border:none; width:100%; height:100%;"></iframe>`;
                document.getElementById('video-wrapper').innerHTML = iframeHTML;
            };
            list.appendChild(btn);
            if(i===0) btn.click();
        });
    } else { list.innerHTML = 'Error: No hay servidores.'; }
}
function abrirDetallesDesdePlayer() { history.back(); setTimeout(() => { if (currentAnimeSlug) cargarDetallesAnime(currentAnimeSlug); }, 200); }
function cerrarReproductor() { history.back(); }
function renderHistorial() {
    const grid = document.getElementById('grid-history');
    if(!grid) return;
    const h = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    grid.innerHTML = '';
    if(h.length === 0) grid.innerHTML = '<div class="empty-msg">Historial vacío</div>';
    h.reverse().forEach(item => crearTarjeta(item, grid, 'history'));
}
function guardarHistorial(item) {
    let h = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    h = h.filter(x => x.animeSlug !== item.animeSlug);
    h.push(item);
    if(h.length > 50) h.shift();
    localStorage.setItem('animeHistory', JSON.stringify(h));
}
function borrarHistorial() { if(confirm("¿Borrar historial?")) { localStorage.removeItem('animeHistory'); renderHistorial(); } }