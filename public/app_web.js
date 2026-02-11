// ==========================================
// ANIFREEW - LÓGICA DE APLICACIÓN (VERSION PRO)
// ==========================================

const API_BASE = "/api"; 

let currentAnimeData = null;

// Función para obtener datos del servidor
async function fetchData(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        const json = await response.json();
        return json.success ? (json.data || json.servers) : null;
    } catch (error) {
        console.error("Error en la API:", error);
        return null;
    }
}

// --- SISTEMA DE NAVEGACIÓN ---
window.cambiarTab = (id) => {
    // Ocultar contenidos
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    // Quitar estados activos de la navegación
    document.querySelectorAll('.header__nav ul li').forEach(el => el.classList.remove('active'));
    
    // Mostrar lo seleccionado
    const tab = document.getElementById(`tab-${id}`);
    const navItem = document.getElementById(`nav-${id}`);
    if(tab) tab.classList.add('active');
    if(navItem) navItem.classList.add('active');

    // Cargas especiales
    if(id === 'favorites') renderFavorites();
    if(id === 'history') renderHistorial();
};

// --- RENDERIZAR TARJETAS (ESTILO PROFESIONAL) ---
function crearTarjetaAnime(item, container) {
    const col = document.createElement('div');
    col.className = 'col-lg-3 col-md-4 col-sm-6 col-6'; // Adaptable a móvil y PC

    // Limpieza de Slug para evitar errores de temporada/episodio
    let animeSlug = item.slug || item.id;
    if (animeSlug.includes('episodio')) {
        animeSlug = animeSlug.replace(/-episodio-\d+$/, '');
    } else if (item.number) {
        const suffix = `-${item.number}`;
        if (animeSlug.endsWith(suffix)) animeSlug = animeSlug.substring(0, animeSlug.length - suffix.length);
    }

    col.innerHTML = `
        <div class="product__item" onclick="cargarDetalles('${animeSlug}')">
            <div class="product__item__pic" style="background-image: url('${item.cover || item.image}')">
                ${item.number ? `<div class="ep">Ep ${item.number}</div>` : ''}
            </div>
            <div class="product__item__text">
                <h5><a href="javascript:void(0)">${item.title}</a></h5>
            </div>
        </div>
    `;
    container.appendChild(col);
}

// --- CARGAR ESTRENOS ---
async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    if(!grid) return;
    grid.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-danger"></div></div>';
    
    const data = await fetchData('/latest'); 
    
    if (data && data.length > 0) {
        grid.innerHTML = '';
        data.forEach(item => crearTarjetaAnime(item, grid));
    } else {
        grid.innerHTML = '<p class="col-12 text-center text-white">No se pudieron cargar los estrenos.</p>';
    }
}

// --- BUSCADOR ---
window.buscar = async () => {
    const q = document.getElementById('inp').value;
    if (!q) return;
    
    window.cambiarTab('search');
    const grid = document.getElementById('grid-search');
    grid.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-danger"></div></div>';
    
    const data = await fetchData(`/search?q=${encodeURIComponent(q)}`);
    
    grid.innerHTML = '';
    if (data && data.data && data.data.length > 0) {
        data.data.forEach(item => crearTarjetaAnime(item, grid));
    } else {
        grid.innerHTML = '<p class="col-12 text-center text-white">No se encontraron resultados.</p>';
    }
};

// --- DETALLES DEL ANIME ---
window.cargarDetalles = async (id) => {
    const modal = document.getElementById('details-modal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Bloquear scroll de fondo

    document.getElementById('det-title').innerText = "Cargando...";
    document.getElementById('det-episodes').innerHTML = "";

    const info = await fetchData(`/anime/${id}`);
    
    if (info) {
        currentAnimeData = info;
        document.getElementById('det-title').innerText = info.title;
        document.getElementById('det-img').src = info.cover; 
        document.getElementById('det-synopsis').innerText = info.synopsis || "Sin sinopsis.";
        document.getElementById('det-genres').innerText = (info.genres || []).join(', ');
        
        // Renderizar episodios
        const grid = document.getElementById('det-episodes');
        if(info.episodes && info.episodes.length > 0) {
            // Ordenar: Capitulo más alto primero
            info.episodes.sort((a, b) => b.number - a.number);

            grid.innerHTML = info.episodes.map(ep => {
                const capSlug = ep.url.split('/').pop(); 
                return `<button class="ep-btn" onclick="playVideo('${capSlug}', ${ep.number})">Cap ${ep.number}</button>`;
            }).join('');
        } else {
            grid.innerHTML = "<p class='text-white'>No hay episodios disponibles.</p>";
        }
        
        actualizarBotonFav();
        guardarHistorial(info);
    }
};

// --- REPRODUCTOR ---
window.playVideo = async (capSlug, number) => {
    const modal = document.getElementById('player-modal');
    modal.style.display = 'flex';
    document.getElementById('player-title').innerText = `Episodio ${number}`;
    document.getElementById('video-wrapper').innerHTML = '<div class="spinner-border text-danger"></div>';
    
    const servers = await fetchData(`/episode/${capSlug}`);
    
    if (servers && servers.length > 0) {
        const sList = document.getElementById('server-list');
        sList.innerHTML = servers.map(srv => 
            `<button class="btn btn-sm btn-outline-light mr-2 mb-2" onclick="setSource('${srv.embed || srv.url}')">${srv.name}</button>`
        ).join('');
        setSource(servers[0].embed || servers[0].url);
    } else {
        document.getElementById('video-wrapper').innerHTML = '<p class="text-white">Sin servidores disponibles.</p>';
    }
};

window.setSource = (url) => { 
    document.getElementById('video-wrapper').innerHTML = `<iframe src="${url}" allowfullscreen frameborder="0"></iframe>`; 
};

// --- FAVORITOS Y HISTORIAL ---
window.toggleFavorite = () => {
    if (!currentAnimeData) return;
    let favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const isFav = favs.some(f => f.url === currentAnimeData.url);
    if(isFav) {
        favs = favs.filter(f => f.url !== currentAnimeData.url);
    } else {
        favs.push({ 
            id: currentAnimeData.url.split('/').pop(),
            title: currentAnimeData.title, 
            cover: currentAnimeData.cover,
            url: currentAnimeData.url
        });
    }
    localStorage.setItem('favorites', JSON.stringify(favs));
    actualizarBotonFav();
};

function actualizarBotonFav() {
    const btn = document.getElementById('btn-fav');
    if (!currentAnimeData || !btn) return;
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const isFav = favs.some(f => f.url === currentAnimeData.url);
    btn.innerHTML = isFav ? '<i class="fa fa-heart"></i> Quitar' : '<i class="fa fa-heart-o"></i> Favorito';
    btn.className = isFav ? 'follow-btn bg-danger' : 'follow-btn';
}

function renderFavorites() {
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const grid = document.getElementById('grid-favorites');
    grid.innerHTML = favs.length ? '' : '<p class="col-12 text-white">Aún no tienes favoritos.</p>';
    favs.forEach(f => crearTarjetaAnime(f, grid));
}

function guardarHistorial(anime) {
    let hist = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    hist = hist.filter(h => h.url !== anime.url);
    hist.unshift({ id: anime.url.split('/').pop(), title: anime.title, cover: anime.cover, url: anime.url });
    localStorage.setItem('animeHistory', JSON.stringify(hist.slice(0, 24)));
}

function renderHistorial() {
    const hist = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    const grid = document.getElementById('grid-history');
    grid.innerHTML = hist.length ? '' : '<p class="col-12 text-white">Historial vacío.</p>';
    hist.forEach(h => crearTarjetaAnime(h, grid));
}

window.borrarHistorial = () => { localStorage.removeItem('animeHistory'); renderHistorial(); };
window.cerrarDetalles = () => {
    document.getElementById('details-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
};
window.cerrarReproductor = () => {
    document.getElementById('player-modal').style.display = 'none';
    document.getElementById('video-wrapper').innerHTML = '';
};

window.onload = () => {
    cargarEstrenos();
};