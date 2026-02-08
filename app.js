const API_BASE = "https://animeflv.ahmedrangel.com/api";
const PROXIES = [ 
    (u) => u, 
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, 
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}` 
];

let currentAnimeSlug = null;

// --- HISTORIAL ---
window.addEventListener('popstate', (event) => {
    const player = document.getElementById('player-modal');
    const details = document.getElementById('details-modal');
    const search = document.getElementById('searchContainer');

    if (player && player.style.display === 'flex') {
        player.style.display = 'none';
        document.getElementById('video-wrapper').innerHTML = ''; 
        return;
    }
    if (details && details.style.display === 'block') {
        details.style.display = 'none';
        return;
    }
    if (search && search.style.display === 'flex') {
        search.style.display = 'none';
        return;
    }
    const searchView = document.getElementById('view-search');
    if (searchView && searchView.classList.contains('active')) {
        cambiarVista('home');
        return;
    }
});

function agregarHistorial(stateId) {
    history.pushState({ page: stateId }, "", `#${stateId}`);
}

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

// --- NAVEGACIÓN ---
function cambiarVista(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const view = document.getElementById(`view-${id}`);
    if (view) view.classList.add('active');

    const btn = document.getElementById(`btn-${id}`);
    if (btn) btn.classList.add('active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if(id === 'history') renderHistorial();
}

function toggleSearch() {
    const el = document.getElementById('searchContainer');
    if (el.style.display === 'flex') {
        el.style.display = 'none';
        if (document.getElementById('inp').value === '') history.back(); 
    } else {
        el.style.display = 'flex';
        document.getElementById('inp').focus();
        agregarHistorial('search_overlay');
    }
}

// --- LOGICA ---
async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    const data = await fetchData('/list/latest-episodes');
    grid.innerHTML = '';
    if (data) data.forEach(item => crearTarjeta(item, grid, 'latest'));
    else grid.innerHTML = '<div style="padding:20px; text-align:center;">Error de conexión</div>';
}

async function buscar() {
    const q = document.getElementById('inp').value;
    if (!q) return;

    document.getElementById('searchContainer').style.display = 'none';
    document.getElementById('inp').blur();

    cambiarVista('search');
    
    const grid = document.getElementById('grid-search');
    grid.innerHTML = '<div class="loader">Buscando...</div>';
    
    const data = await fetchData(`/search?query=${encodeURIComponent(q)}`);
    grid.innerHTML = '';
    
    if (data && data.media) {
        data.media.forEach(anime => crearTarjeta(anime, grid, 'search'));
    } else {
        grid.innerHTML = '<div style="padding:20px; text-align:center;">No se encontraron resultados.</div>';
    }
}

// --- UI ---
function crearTarjeta(item, container, context) {
    const card = document.createElement('div');
    card.className = 'anime-card focusable';
    card.setAttribute('tabindex', '0'); 
    
    const img = item.cover || 'https://via.placeholder.com/150';
    const title = item.title;
    let meta = '';

    if (context === 'latest') meta = `Episodio ${item.number}`;
    else if (context === 'search') meta = item.type || 'Anime';
    else meta = `Visto: Ep ${item.lastEp}`;

    card.innerHTML = `
        <img src="${img}" loading="lazy">
        ${context === 'latest' ? '<div class="badge-new">NUEVO</div>' : ''}
        <div class="info">
            <span class="title">${title}</span>
            <div class="meta">${meta}</div>
        </div>
    `;

    card.onclick = () => {
        if (context === 'search') {
            cargarDetallesAnime(item.slug);
        } else if (context === 'latest') {
            const partes = item.slug.split('-');
            partes.pop(); 
            currentAnimeSlug = partes.join('-'); 
            prepararReproductor(item.slug, item.title, item.number, img);
        } else {
            prepararReproductor(item.slug, item.title, item.lastEp, img);
            currentAnimeSlug = item.animeSlug;
        }
    };
    card.onkeydown = (e) => { if(e.key === 'Enter') card.click(); };
    container.appendChild(card);
}

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
                btn.onkeydown = (e) => { if(e.key === 'Enter') btn.click(); };
                epList.appendChild(btn);
            });
        }
    }
}

function cerrarDetalles() { history.back(); }

// --- REPRODUCTOR (CON ESCUDO) ---
async function prepararReproductor(slug, title, number, cover) {
    agregarHistorial('player');
    const modal = document.getElementById('player-modal');
    modal.style.display = 'flex';
    document.getElementById('player-title').innerText = `${title} - Ep ${number}`;
    document.getElementById('video-wrapper').innerHTML = '';
    
    // Contenedor para el botón de escudo
    let shieldContainer = document.getElementById('shield-control');
    if(!shieldContainer) {
        shieldContainer = document.createElement('div');
        shieldContainer.id = 'shield-control';
        shieldContainer.style.padding = "10px";
        shieldContainer.style.textAlign = "center";
        document.querySelector('.player-controls').prepend(shieldContainer);
    }
    shieldContainer.innerHTML = ''; // Limpiar botón anterior

    if (currentAnimeSlug) {
        guardarHistorial({ animeSlug: currentAnimeSlug, slug: slug, title: title, lastEp: number, cover: cover });
    }

    const list = document.getElementById('server-list');
    list.innerHTML = 'Cargando servidores...';
    
    const data = await fetchData(`/anime/episode/${slug}`);
    list.innerHTML = '';

    if (data && data.servers) {
        // Orden inteligente
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
                cargarVideoConEscudo(url, true); // Por defecto: ACTIVADO
            };
            list.appendChild(btn);
            if(i===0) btn.click();
        });
    } else {
        list.innerHTML = 'Error: No hay servidores.';
    }
}

// MAGIA DEL ESCUDO
function cargarVideoConEscudo(url, activo) {
    const wrapper = document.getElementById('video-wrapper');
    const shieldContainer = document.getElementById('shield-control');
    
    // Sandbox Estricto (Sin 'allow-popups') vs Normal
    const sandboxRules = activo 
        ? "allow-forms allow-pointer-lock allow-same-origin allow-scripts allow-top-navigation"
        : "allow-forms allow-pointer-lock allow-same-origin allow-scripts allow-top-navigation allow-popups";

    wrapper.innerHTML = `<iframe src="${url}" allowfullscreen allow="autoplay; encrypted-media; fullscreen" sandbox="${sandboxRules}"></iframe>`;

    // Botón para alternar
    const btnText = activo ? "🛡️ Escudo ACTIVO (Sin Anuncios)" : "⚠️ Escudo DESACTIVADO (Permitir Popups)";
    const btnColor = activo ? "#28a745" : "#ffc107";
    const textColor = activo ? "white" : "black";
    
    shieldContainer.innerHTML = `
        <button onclick="cargarVideoConEscudo('${url}', ${!activo})" style="background:${btnColor}; color:${textColor}; border:none; padding:8px 15px; border-radius:5px; font-weight:bold; width:100%; cursor:pointer;">
            ${btnText} <br><small style="font-weight:normal">${activo ? 'Si el video no carga, toca aquí' : 'Cuidado: Saldrán anuncios'}</small>
        </button>
    `;
}


function abrirDetallesDesdePlayer() {
    history.back();
    setTimeout(() => { if (currentAnimeSlug) cargarDetallesAnime(currentAnimeSlug); }, 200);
}

function cerrarReproductor() { history.back(); }

// --- UTILS ---
function renderHistorial() {
    const grid = document.getElementById('grid-history');
    if(!grid) return;
    const h = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    grid.innerHTML = '';
    if(h.length === 0) grid.innerHTML = '<div style="padding:20px; color:#555; grid-column:1/-1; text-align:center;">Historial vacío</div>';
    h.reverse().forEach(item => crearTarjeta(item, grid, 'history'));
}

function guardarHistorial(item) {
    let h = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    h = h.filter(x => x.animeSlug !== item.animeSlug);
    h.push(item);
    if(h.length > 50) h.shift();
    localStorage.setItem('animeHistory', JSON.stringify(h));
}

function borrarHistorial() { 
    if(confirm("¿Borrar historial?")) { localStorage.removeItem('animeHistory'); renderHistorial(); } 
}

function recargar() { location.reload(); }