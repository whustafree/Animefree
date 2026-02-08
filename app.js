const API_BASE = "https://animeflv.ahmedrangel.com/api";
const PROXIES = [ (u)=>u, (u)=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, (u)=>`https://corsproxy.io/?${encodeURIComponent(u)}` ];

// VARIABLE GLOBAL PARA GUARDAR EL ANIME ACTUAL (Para volver desde el player)
let currentAnimeSlug = null;

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

window.onload = () => { cargarEstrenos(); renderHistorial(); };

// --- NAVEGACIÓN ---
function cambiarVista(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`view-${id}`).classList.add('active');
    document.getElementById(`btn-${id}`).classList.add('active');
    if(id === 'history') renderHistorial();
}
function toggleSearch() {
    const el = document.getElementById('searchContainer');
    el.style.display = (el.style.display === 'flex') ? 'none' : 'flex';
    if(el.style.display === 'flex') document.getElementById('inp').focus();
}

// --- LOGICA PRINCIPAL ---
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

// --- CREAR TARJETAS (Inteligente) ---
function crearTarjeta(item, container, context) {
    const card = document.createElement('div');
    card.className = 'anime-card focusable';
    // Para TV: Tabindex permite navegar con flechas
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

    // ACCIONES AL CLIC
    card.onclick = () => {
        if (context === 'search') {
            // Desde búsqueda: Abrir ficha de detalles
            cargarDetallesAnime(item.slug);
        } else if (context === 'latest') {
            // Desde estrenos: Reproducir directo, PERO guardamos slug para ver más
            // El item de latest no trae slug de anime limpio, trae slug de episodio.
            // Truco: slug episodio es "nombre-anime-numero".
            const partes = item.slug.split('-');
            partes.pop(); // quitar numero
            currentAnimeSlug = partes.join('-'); 
            
            prepararReproductor(item.slug, item.title, item.number, img);
        } else {
            // Historial
            prepararReproductor(item.slug, item.title, item.lastEp, img);
            currentAnimeSlug = item.animeSlug; // Recuperamos slug guardado
        }
    };
    
    // Soporte TV Enter
    card.onkeydown = (e) => { if(e.key === 'Enter') card.click(); };
    
    container.appendChild(card);
}

// --- DETALLES DE ANIME (Lo nuevo) ---
async function cargarDetallesAnime(slug) {
    currentAnimeSlug = slug; // Guardar referencia
    const modal = document.getElementById('details-modal');
    modal.style.display = 'block';
    
    // Limpiar UI anterior
    document.getElementById('det-title').innerText = 'Cargando...';
    document.getElementById('det-episodes').innerHTML = '<div class="loader">...</div>';
    
    const info = await fetchData(`/anime/${slug}`);
    
    if (info) {
        document.getElementById('det-title').innerText = info.title;
        document.getElementById('det-synopsis').innerText = info.synopsis || "Sin sinopsis.";
        document.getElementById('det-img').src = info.cover;
        
        // Géneros
        const genresDiv = document.getElementById('det-genres');
        genresDiv.innerHTML = info.genres.map(g => `<span>${g}</span>`).join('');
        
        // Lista Episodios
        const epList = document.getElementById('det-episodes');
        epList.innerHTML = '';
        
        if (info.episodes && info.episodes.length > 0) {
            // Botón reproducir último
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

function cerrarDetalles() { document.getElementById('details-modal').style.display = 'none'; }

// --- REPRODUCTOR ---
async function prepararReproductor(slug, title, number, cover) {
    document.getElementById('player-modal').style.display = 'flex';
    document.getElementById('player-title').innerText = `${title} - Ep ${number}`;
    document.getElementById('video-wrapper').innerHTML = '';
    
    // Guardar Historial
    if (currentAnimeSlug) {
        guardarHistorial({ 
            animeSlug: currentAnimeSlug, // Guardamos slug del anime para volver
            slug: slug, // Slug del episodio
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
            if(i===0) btn.click(); // Auto-play primero
        });
    } else {
        list.innerHTML = 'Error: No hay servidores.';
    }
}

function abrirDetallesDesdePlayer() {
    cerrarReproductor();
    if (currentAnimeSlug) {
        cargarDetallesAnime(currentAnimeSlug);
    } else {
        alert("No se pudo identificar el anime. Búscalo en el buscador.");
    }
}

function cerrarReproductor() {
    document.getElementById('player-modal').style.display = 'none';
    document.getElementById('video-wrapper').innerHTML = '';
    renderHistorial();
}

// --- HISTORIAL ---
function renderHistorial() {
    const grid = document.getElementById('grid-history');
    const h = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    grid.innerHTML = '';
    if(h.length === 0) grid.innerHTML = '<div style="padding:20px; color:#555">Historial vacío</div>';
    h.reverse().forEach(item => crearTarjeta(item, grid, 'history'));
}
function guardarHistorial(item) {
    let h = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    h = h.filter(x => x.animeSlug !== item.animeSlug); // Evitar duplicados del mismo anime
    h.push(item);
    if(h.length > 20) h.shift();
    localStorage.setItem('animeHistory', JSON.stringify(h));
}
function borrarHistorial() { 
    if(confirm("¿Borrar historial?")) { localStorage.removeItem('animeHistory'); renderHistorial(); } 
}
function recargar() { location.reload(); }