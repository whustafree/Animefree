const API_BASE = "https://animeflv.ahmedrangel.com/api";
const PROXIES = [ (u)=>u, (u)=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, (u)=>`https://corsproxy.io/?${encodeURIComponent(u)}` ];

let currentAnimeSlug = null;

// --- SISTEMA DE NAVEGACIÓN (HISTORIAL) ---
window.addEventListener('popstate', (event) => {
    // Cuando el usuario hace el gesto "Atrás", el navegador dispara este evento.
    // Verificamos qué tenemos abierto para cerrarlo visualmente.
    
    const player = document.getElementById('player-modal');
    const details = document.getElementById('details-modal');
    const search = document.getElementById('searchContainer');

    // Prioridad 1: Si el reproductor está abierto, lo cerramos
    if (player.style.display === 'flex') {
        player.style.display = 'none';
        document.getElementById('video-wrapper').innerHTML = ''; // Parar video
        return;
    }

    // Prioridad 2: Si los detalles están abiertos, los cerramos
    if (details.style.display === 'block') {
        details.style.display = 'none';
        return;
    }
    
    // Prioridad 3: Si el buscador está abierto, lo cerramos
    if (search.style.display === 'flex') {
        search.style.display = 'none';
        return;
    }

    // Si no hay nada abierto, el navegador seguirá su curso normal (salir o volver al inicio)
});

// Función para "crear" una página nueva en el historial
function agregarHistorial(id) {
    history.pushState({ page: id }, "", `#${id}`);
}


// --- CORE FUNCTIONS ---
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
    
    // Reemplazamos el estado inicial para evitar bugs
    history.replaceState({ page: 'home' }, "", "");
};

// --- NAVEGACIÓN VISTAS ---
function cambiarVista(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`view-${id}`).classList.add('active');
    document.getElementById(`btn-${id}`).classList.add('active');
    if(id === 'history') renderHistorial();
}

function toggleSearch() {
    const el = document.getElementById('searchContainer');
    if (el.style.display === 'flex') {
        el.style.display = 'none';
        // Si cerramos manual, retrocedemos historial si corresponde (opcional)
    } else {
        el.style.display = 'flex';
        document.getElementById('inp').focus();
        agregarHistorial('search_overlay'); // Agregamos estado para poder volver
    }
}

// --- LÓGICA ---
async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    const data = await fetchData('/list/latest-episodes');
    grid.innerHTML = '';
    if (data) data.forEach(item => crearTarjeta(item, grid, 'latest'));
    else grid.innerHTML = '<div style="padding:20px">Error de conexión</div>';
}

async function buscar() {
    const q = document.getElementById('inp').value;
    if (!q) return;
    cambiarVista('search');
    // Cerrar el overlay de búsqueda
    document.getElementById('searchContainer').style.display = 'none';
    
    const grid = document.getElementById('grid-search');
    grid.innerHTML = '<div class="loader">Buscando...</div>';
    
    const data = await fetchData(`/search?query=${encodeURIComponent(q)}`);
    grid.innerHTML = '';
    
    if (data && data.media) {
        data.media.forEach(anime => crearTarjeta(anime, grid, 'search'));
    } else {
        grid.innerHTML = '<div style="padding:20px">No encontrado</div>';
    }
}

// --- TARJETAS ---
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
    
    // 1. ABRIR MODAL
    const modal = document.getElementById('details-modal');
    modal.style.display = 'block';
    
    // 2. AGREGAR AL HISTORIAL (El truco mágico)
    agregarHistorial('details'); 

    // Limpiar UI
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
            btnPlay.onclick = () => prepararReproductor(lastEp.slug, info.title, lastEp.number, info.cover);
            
            info.episodes.forEach(ep => {
                const btn = document.createElement('div');
                btn.className = 'ep-card focusable';
                btn.setAttribute('tabindex', '0');
                btn.innerText = `Episodio ${ep.number}`;
                btn.onclick = () => prepararReproductor(ep.slug, info.title, ep.number, info.cover);
                btn.onkeydown = (e) => { if(e.key === 'Enter') btn.click(); };
                epList.appendChild(btn);
            });
        }
    }
}

// Función modificada para cerrar usando el historial
function cerrarDetalles() {
    // Simulamos pulsar "Atrás" para ser consistentes
    history.back();
}

// --- REPRODUCTOR ---
async function prepararReproductor(slug, title, number, cover) {
    const modal = document.getElementById('player-modal');
    modal.style.display = 'flex';
    
    // AGREGAR AL HISTORIAL
    agregarHistorial('player');

    document.getElementById('player-title').innerText = `${title} - Ep ${number}`;
    document.getElementById('video-wrapper').innerHTML = '';
    
    if (currentAnimeSlug) {
        guardarHistorial({ 
            animeSlug: currentAnimeSlug,
            slug: slug, 
            title: title, 
            lastEp: number, 
            cover: cover 
        });
    }

    const list = document.getElementById('server-list');
    list.innerHTML = 'Cargando servidores...';
    
    const data = await fetchData(`/anime/episode/${slug}`);
    list.innerHTML = '';

    if (data && data.servers) {
        data.servers.forEach((s, i) => {
            const btn = document.createElement('button');
            btn.className = 'focusable';
            btn.setAttribute('tabindex', '0');
            btn.innerText = s.name;
            const url = s.embed || s.code || s.url;
            
            btn.onclick = () => {
                document.querySelectorAll('.server-list button').forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('video-wrapper').innerHTML = `<iframe src="${url}" allowfullscreen allow="autoplay"></iframe>`;
            };
            list.appendChild(btn);
            if(i===0) btn.click();
        });
    } else {
        list.innerHTML = 'Error: No hay servidores.';
    }
}

function abrirDetallesDesdePlayer() {
    // Al salir del player, queremos ir a detalles.
    // Como player agregó historia, hacemos back para cerrarlo
    // PERO si venimos directo de Home, details no está en historial.
    
    // Estrategia simple: Cerramos player y abrimos details
    document.getElementById('player-modal').style.display = 'none';
    document.getElementById('video-wrapper').innerHTML = '';
    
    // Forzamos un history back manual para sacar el estado 'player'
    history.back();

    // Pequeño delay y abrimos detalles
    setTimeout(() => {
        if (currentAnimeSlug) cargarDetallesAnime(currentAnimeSlug);
    }, 100);
}

function cerrarReproductor() {
    // Simular Atrás
    history.back();
}

// --- UTILS ---
function renderHistorial() {
    const grid = document.getElementById('grid-history');
    if(!grid) return;
    const h = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    grid.innerHTML = '';
    if(h.length === 0) grid.innerHTML = '<div style="padding:20px; color:#555">Historial vacío</div>';
    h.reverse().forEach(item => crearTarjeta(item, grid, 'history'));
}
function guardarHistorial(item) {
    let h = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    h = h.filter(x => x.animeSlug !== item.animeSlug);
    h.push(item);
    if(h.length > 20) h.shift();
    localStorage.setItem('animeHistory', JSON.stringify(h));
}
function borrarHistorial() { 
    if(confirm("¿Borrar historial?")) { localStorage.removeItem('animeHistory'); renderHistorial(); } 
}
function recargar() { location.reload(); }