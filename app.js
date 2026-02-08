// CONFIGURACIÓN API (AHMED RANGEL)
const API_BASE = "https://animeflv.ahmedrangel.com/api";

// PROXIES (Invisibles)
const PROXIES = [
    (url) => url, // Directo
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
];

// --- FUNCIONES CORE ---
async function fetchData(endpoint) {
    const targetUrl = `${API_BASE}${endpoint}`;
    for (const wrap of PROXIES) {
        try {
            const resp = await fetch(wrap(targetUrl));
            if (!resp.ok) continue;
            
            const text = await resp.text();
            let data;
            try { data = JSON.parse(text); if(data.contents) data = JSON.parse(data.contents); } 
            catch(e) { continue; }
            
            if (data.success) return data.data;
        } catch (e) {}
    }
    return null;
}

// --- INICIO ---
window.onload = () => {
    cargarEstrenos();
    renderHistorial();
};

function cambiarVista(vistaName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`view-${vistaName}`).classList.add('active');
    if(document.getElementById(`btn-${vistaName}`)) {
        document.getElementById(`btn-${vistaName}`).classList.add('active');
    }
    
    if (vistaName === 'history') renderHistorial();
}

function toggleSearch() {
    const el = document.getElementById('searchContainer');
    if (el.style.display === 'flex') el.style.display = 'none';
    else el.style.display = 'flex';
}

// --- LOGICA DE ESTRENOS (VISTA 1) ---
async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    const data = await fetchData('/list/latest-episodes');
    
    if (data) {
        grid.innerHTML = '';
        data.forEach(item => {
            crearTarjeta(item, grid, true);
        });
    } else {
        grid.innerHTML = '<div class="empty-msg">Error de conexión.</div>';
    }
}

// --- LOGICA DE HISTORIAL (VISTA 2) ---
function renderHistorial() {
    const grid = document.getElementById('grid-history');
    const history = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    
    if (history.length === 0) {
        grid.innerHTML = '<div class="empty-msg">Aquí aparecerán los animes que veas.</div>';
        return;
    }
    
    grid.innerHTML = '';
    // Mostrar del más reciente al más antiguo
    history.reverse().forEach(item => {
        crearTarjeta(item, grid, false, true);
    });
}

function guardarHistorial(anime) {
    let history = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    // Eliminar si ya existe para ponerlo primero
    history = history.filter(h => h.slug !== anime.slug);
    // Agregar al inicio
    history.push(anime);
    // Guardar máx 50 items
    if (history.length > 50) history.shift();
    localStorage.setItem('animeHistory', JSON.stringify(history));
}

function borrarHistorial() {
    if(confirm("¿Borrar todo el historial?")) {
        localStorage.removeItem('animeHistory');
        renderHistorial();
    }
}

// --- UI COMPONENTS ---
function crearTarjeta(item, container, esEstreno = false, esHistorial = false) {
    const card = document.createElement('div');
    card.className = 'anime-card';
    
    const img = item.cover || 'https://via.placeholder.com/150';
    const title = item.title;
    // Si es estreno, viene con 'number'. Si es historial, puede variar.
    const epNum = item.number || item.lastEp || '?';
    
    let badgeHTML = '';
    if (esEstreno) badgeHTML = '<div class="badge-new">NUEVO</div>';
    
    card.innerHTML = `
        <img src="${img}" loading="lazy">
        ${badgeHTML}
        <div class="info">
            <span class="title">${title}</span>
            <div class="meta">
                ${esEstreno ? 'Episodio ' + epNum : 'Visto: Ep ' + epNum}
            </div>
        </div>
    `;
    
    // Al hacer click, reproducir
    card.onclick = () => {
        // Si es estreno, item tiene slug del episodio. Si no, construimos.
        const slug = item.slug; 
        prepararReproductor(slug, title, epNum, img);
    };
    
    container.appendChild(card);
}

// --- BÚSQUEDA ---
async function buscar() {
    const q = document.getElementById('inp').value;
    if (!q) return;
    
    cambiarVista('search');
    const grid = document.getElementById('grid-search');
    grid.innerHTML = '<div class="loader">Buscando...</div>';
    
    const data = await fetchData(`/search?query=${encodeURIComponent(q)}`);
    
    grid.innerHTML = '';
    if (data && data.media) {
        data.media.forEach(anime => {
            // Tarjetas de búsqueda llevan a detalles (simplificado: reproducir ultimo ep o lista)
            // Por simplicidad en esta versión, intentaremos reproducir el último disponible
            // Ojo: La API de búsqueda devuelve animes, no episodios.
            // Para "hacerlo simple", al buscar y hacer click, buscaremos el cap 1 o el ultimo.
            // Aquí haremos una tarjeta simple.
            
            const card = document.createElement('div');
            card.className = 'anime-card';
            card.innerHTML = `
                <img src="${anime.cover}" loading="lazy">
                <div class="info">
                    <span class="title">${anime.title}</span>
                    <div class="meta">${anime.type || 'Anime'}</div>
                </div>
            `;
            // Al buscar, vamos a intentar ver el cap 1 (Fix rápido)
            card.onclick = () => {
                 // Convertimos slug de anime a slug de ep 1 (generalmente es slug-1)
                 // Esto es un hack, lo ideal es una vista de detalles.
                 const epSlug = `${anime.slug}-1`;
                 prepararReproductor(epSlug, anime.title, "1", anime.cover);
            };
            grid.appendChild(card);
        });
    } else {
        grid.innerHTML = '<div class="empty-msg">No encontrado.</div>';
    }
}

// --- REPRODUCTOR DE VIDEO ---
async function prepararReproductor(slug, title, number, cover) {
    const modal = document.getElementById('player-modal');
    const wrapper = document.getElementById('video-wrapper');
    const list = document.getElementById('server-list');
    
    modal.style.display = 'flex';
    document.getElementById('player-title').innerText = `${title} - Ep ${number}`;
    wrapper.innerHTML = ''; // Limpiar video anterior
    list.innerHTML = 'Cargando servidores...';
    
    // Guardar en historial
    guardarHistorial({ slug: slug, title: title, lastEp: number, cover: cover });

    const data = await fetchData(`/anime/episode/${slug}`);
    
    list.innerHTML = '';
    if (data && data.servers) {
        data.servers.forEach((server, index) => {
            const btn = document.createElement('button');
            btn.className = 'server-btn';
            btn.innerText = server.name;
            
            // Preferir embed
            const url = server.embed || server.code || server.url;
            
            btn.onclick = () => {
                document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                cargarVideoEnIframe(url);
            };
            
            list.appendChild(btn);
            
            // Cargar el primero automáticamente
            if (index === 0) btn.click();
        });
    } else {
        list.innerHTML = 'No se encontraron servidores.';
    }
}

function cargarVideoEnIframe(url) {
    const wrapper = document.getElementById('video-wrapper');
    wrapper.innerHTML = `<iframe src="${url}" allowfullscreen scrolling="no" allow="autoplay; encrypted-media"></iframe>`;
}

function cerrarReproductor() {
    document.getElementById('player-modal').style.display = 'none';
    document.getElementById('video-wrapper').innerHTML = ''; // Detener video
    renderHistorial(); // Actualizar vista historial
}

function recargar() { location.reload(); }