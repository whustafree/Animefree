


// ==========================================
// ANIFREEW - LÓGICA PRO + INSTALACIÓN PWA
// ==========================================

const API_BASE = "/api"; 
let currentAnimeData = null;
let deferredPrompt; // Guardará el evento de instalación

// --- LÓGICA DE INSTALACIÓN PWA ---
window.addEventListener('beforeinstallprompt', (e) => {
    // Evita que el navegador muestre el prompt automático
    e.preventDefault();
    // Guarda el evento para activarlo después
    deferredPrompt = e;
    // Muestra nuestro botón de instalación personalizado
    const installContainer = document.getElementById('nav-install');
    if (installContainer) installContainer.style.display = 'inline-block';
});

// 1. Detectar si es iOS (iPhone/iPad)
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Si no es iPhone y no está instalada, mostramos el botón
    if (!isStandalone) {
        document.getElementById('nav-install').style.display = 'inline-block';
    }
});

// 2. Si es iPhone y no está instalada, mostramos el botón con instrucciones
if (isIOS && !isStandalone) {
    const installBtn = document.getElementById('btn-install');
    const installLink = document.getElementById('nav-install');
    
    if (installLink) {
        installLink.style.display = 'inline-block';
        installBtn.innerHTML = '<i class="fa fa-apple"></i> ¿Cómo instalar?';
        
        installBtn.onclick = (e) => {
            e.preventDefault();
            alert('Para instalar AnifreeW en tu iPhone:\n1. Pulsa el botón "Compartir" (el cuadrado con flecha abajo).\n2. Selecciona "Añadir a la pantalla de inicio".');
        };
    }
}

// Manejo del click en el botón "Instalar"
document.getElementById('btn-install')?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (deferredPrompt) {
        // Muestra el prompt de instalación nativo
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('El usuario aceptó la instalación');
        }
        // Limpiamos la variable, el evento ya no es válido
        deferredPrompt = null;
        document.getElementById('nav-install').style.display = 'none';
    }
});

// Ocultar si ya se instaló
window.addEventListener('appinstalled', () => {
    console.log('App instalada con éxito');
    deferredPrompt = null;
    const installContainer = document.getElementById('nav-install');
    if (installContainer) installContainer.style.display = 'none';
});

// --- LÓGICA EXISTENTE ---
async function fetchData(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        const json = await response.json();
        return json.success ? (json.data || json.servers) : null;
    } catch (error) {
        console.error("Error API:", error);
        return null;
    }
}

window.cambiarTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.header__nav ul li').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${id}`)?.classList.add('active');
    document.getElementById(`nav-${id}`)?.classList.add('active');
    if(id === 'favorites') renderFavorites();
    if(id === 'history') renderHistorial();
};

function crearTarjetaAnime(item, container) {
    const col = document.createElement('div');
    col.className = 'col-lg-3 col-md-4 col-sm-6 col-6 mb-4';
    
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
                <h5 class="text-white">${item.title}</h5>
            </div>
        </div>
    `;
    container.appendChild(col);
}

async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    if(!grid) return;
    grid.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-danger"></div></div>';
    const data = await fetchData('/latest'); 
    if (data) {
        grid.innerHTML = '';
        data.forEach(item => crearTarjetaAnime(item, grid));
    }
}

window.buscar = async () => {
    const q = document.getElementById('inp').value;
    if (!q) return;
    window.cambiarTab('search');
    const grid = document.getElementById('grid-search');
    grid.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-danger"></div></div>';
    const data = await fetchData(`/search?q=${encodeURIComponent(q)}`);
    grid.innerHTML = '';
    if (data?.data) data.data.forEach(item => crearTarjetaAnime(item, grid));
};

window.cargarDetalles = async (id) => {
    const modal = document.getElementById('details-modal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    document.getElementById('det-title').innerText = "Cargando...";
    document.getElementById('det-episodes').innerHTML = "";
    const info = await fetchData(`/anime/${id}`);
    if (info) {
        currentAnimeData = info;
        document.getElementById('det-title').innerText = info.title;
        document.getElementById('det-img').src = info.cover; 
        document.getElementById('det-synopsis').innerText = info.synopsis || "Sin sinopsis.";
        document.getElementById('det-genres').innerText = (info.genres || []).join(', ');
        const grid = document.getElementById('det-episodes');
        if(info.episodes?.length) {
            info.episodes.sort((a, b) => b.number - a.number);
            grid.innerHTML = info.episodes.map(ep => {
                const capSlug = ep.url.split('/').pop(); 
                return `<button class="ep-btn" onclick="playVideo('${capSlug}', ${ep.number})">Cap ${ep.number}</button>`;
            }).join('');
        }
        actualizarBotonFav();
        guardarHistorial(info);
    }
};

window.playVideo = async (capSlug, number) => {
    document.getElementById('player-modal').style.display = 'flex';
    document.getElementById('player-title').innerText = `Episodio ${number}`;
    document.getElementById('video-wrapper').innerHTML = '<div class="spinner-border text-danger"></div>';
    const servers = await fetchData(`/episode/${capSlug}`);
    if (servers) {
        document.getElementById('server-list').innerHTML = servers.map(srv => 
            `<button class="btn btn-sm btn-outline-light mr-2 mb-2" onclick="setSource('${srv.embed || srv.url}')">${srv.name}</button>`
        ).join('');
        setSource(servers[0].embed || servers[0].url);
    }
};

window.setSource = (url) => { 
    document.getElementById('video-wrapper').innerHTML = `<iframe src="${url}" allowfullscreen frameborder="0"></iframe>`; 
};

window.toggleFavorite = () => {
    if (!currentAnimeData) return;
    let favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const isFav = favs.some(f => f.url === currentAnimeData.url);
    if(isFav) favs = favs.filter(f => f.url !== currentAnimeData.url);
    else favs.push({ id: currentAnimeData.url.split('/').pop(), title: currentAnimeData.title, cover: currentAnimeData.cover, url: currentAnimeData.url });
    localStorage.setItem('favorites', JSON.stringify(favs));
    actualizarBotonFav();
};

function actualizarBotonFav() {
    const btn = document.getElementById('btn-fav');
    if (!currentAnimeData || !btn) return;
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const isFav = favs.some(f => f.url === currentAnimeData.url);
    btn.innerHTML = isFav ? '❤️ Quitar' : '🤍 Favorito';
}

function renderFavorites() {
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const grid = document.getElementById('grid-favorites');
    grid.innerHTML = favs.length ? '' : '<p class="text-white p-3">Aún no tienes favoritos.</p>';
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
    grid.innerHTML = hist.length ? '' : '<p class="text-white p-3">Historial vacío.</p>';
    hist.forEach(h => crearTarjetaAnime(h, grid));
}

window.borrarHistorial = () => { localStorage.removeItem('animeHistory'); renderHistorial(); };
window.cerrarDetalles = () => { document.getElementById('details-modal').style.display = 'none'; document.body.style.overflow = 'auto'; };
window.cerrarReproductor = () => { document.getElementById('player-modal').style.display = 'none'; document.getElementById('video-wrapper').innerHTML = ''; };

window.onload = cargarEstrenos;