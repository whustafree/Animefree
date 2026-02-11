// ==========================================
// WHUSTAF WEB - RENDER EDITION (FULL STACK)
// ==========================================

// Usamos ruta relativa porque la API está en el mismo dominio
const API_BASE = "/api"; 

// --- VARIABLES GLOBALES ---
let currentAnimeData = null;
let currentEpisodeIndex = -1;

async function fetchData(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        const json = await response.json();
        // La API puede devolver 'data' o 'servers' dependiendo de la ruta
        return json.success ? (json.data || json.servers) : null;
    } catch (error) {
        console.error("Error API:", error);
        return null;
    }
}

// --- SISTEMA DE PESTAÑAS (TABs) ---
window.cambiarTab = (id) => {
    // 1. Ocultar todas las pestañas
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    // 2. Mostrar la seleccionada
    const tab = document.getElementById(`tab-${id}`);
    const btn = document.getElementById(`nav-${id}`);
    if(tab) tab.classList.add('active');
    if(btn) btn.classList.add('active');

    // 3. Cargar datos específicos si es necesario
    if(id === 'favorites') renderFavorites();
    if(id === 'history') renderHistorial();
};

// --- CARGAR ESTRENOS ---
async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    if(!grid) return;
    grid.innerHTML = '<div class="loader">Cargando estrenos...</div>';
    
    const data = await fetchData('/latest'); 
    
    if (data && data.length > 0) {
        grid.innerHTML = '';
        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'anime-card';
            
            // Limpieza básica del slug para intentar navegar al anime
            let animeSlug = item.slug;
            if(item.number) {
                 animeSlug = animeSlug.replace(`-${item.number}`, '').replace(/-episodio-\d+$/, '');
            }

            card.innerHTML = `
                <img src="${item.cover}" onerror="this.src='https://via.placeholder.com/150x220?text=No+Image'">
                <div class="info">
                    <span class="title">${item.title}</span>
                    <div class="meta">Episodio ${item.number}</div>
                </div>
            `;
            // Al hacer click, vamos a los detalles
            card.onclick = () => cargarDetalles(animeSlug); 
            grid.appendChild(card);
        });
    } else {
        grid.innerHTML = '<p style="padding:20px;">No se pudieron cargar los estrenos.</p>';
    }
}

// --- BÚSQUEDA ---
window.buscar = async () => {
    const q = document.getElementById('inp').value;
    if (!q) return;
    
    // Cambiar a pestaña de búsqueda si no estamos ahí
    window.cambiarTab('search');
    
    const grid = document.getElementById('grid-search');
    grid.innerHTML = '<div class="loader">Buscando...</div>';
    
    const data = await fetchData(`/search?q=${encodeURIComponent(q)}`);
    
    grid.innerHTML = '';
    if (data && data.data && data.data.length > 0) {
        data.data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'anime-card';
            card.innerHTML = `
                <img src="${item.cover}" onerror="this.src='https://via.placeholder.com/150x220?text=No+Image'">
                <div class="info"><span class="title">${item.title}</span></div>
            `;
            card.onclick = () => cargarDetalles(item.id); 
            grid.appendChild(card);
        });
    } else {
        grid.innerHTML = '<p style="padding:20px;">Sin resultados.</p>';
    }
};

// --- DETALLES DEL ANIME ---
window.cargarDetalles = async (id) => {
    const modal = document.getElementById('details-modal');
    modal.style.display = 'block';
    
    // UI de carga
    document.getElementById('det-title').innerText = "Cargando...";
    document.getElementById('det-img').src = "";
    document.getElementById('det-episodes').innerHTML = '<div class="loader">...</div>';

    const info = await fetchData(`/anime/${id}`);
    
    if (info) {
        currentAnimeData = info; // Guardamos para favoritos/historial
        
        document.getElementById('det-title').innerText = info.title;
        document.getElementById('det-img').src = info.cover; 
        document.getElementById('det-synopsis').innerText = info.synopsis || "Sin sinopsis.";
        document.getElementById('det-genres').innerText = (info.genres || []).join(', ');
        
        const backdrop = document.getElementById('backdrop-img');
        if(backdrop) backdrop.style.backgroundImage = `url('${info.cover}')`;
        
        // Renderizar episodios
        const grid = document.getElementById('det-episodes');
        if(info.episodes && info.episodes.length > 0) {
            // Ordenar episodios (mayor a menor) si vienen desordenados
            info.episodes.sort((a, b) => b.number - a.number);

            grid.innerHTML = info.episodes.map(ep => {
                const capSlug = ep.url.split('/').pop(); 
                return `<div class="ep-card" onclick="playVideo('${capSlug}', ${ep.number})">${ep.number}</div>`;
            }).join('');
        } else {
            grid.innerHTML = "<p>No hay episodios disponibles.</p>";
        }
        
        actualizarBotonFav();
        guardarHistorial(info);
    } else {
         document.getElementById('det-title').innerText = "Error al cargar";
         document.getElementById('det-episodes').innerHTML = "<p>Error de conexión</p>";
    }
};

// --- REPRODUCTOR ---
window.playVideo = async (capSlug, number) => {
    const modal = document.getElementById('player-modal');
    modal.style.display = 'flex';
    document.getElementById('player-title').innerText = `Episodio ${number}`;
    document.getElementById('video-wrapper').innerHTML = '<div class="loader">Buscando servidores...</div>';
    document.getElementById('server-list').innerHTML = '';
    
    const servers = await fetchData(`/episode/${capSlug}`);
    
    if (servers && servers.length > 0) {
        const sList = document.getElementById('server-list');
        sList.innerHTML = servers.map(srv => 
            `<button onclick="setSource('${srv.embed || srv.url}')">${srv.name}</button>`
        ).join('');
        
        // Reproducir el primero automáticamente
        setSource(servers[0].embed || servers[0].url);
    } else {
        document.getElementById('video-wrapper').innerHTML = '<p style="color:white;padding:20px;text-align:center;">No se encontraron servidores.</p>';
    }
};

window.setSource = (url) => { 
    document.getElementById('video-wrapper').innerHTML = `<iframe src="${url}" allowfullscreen frameborder="0"></iframe>`; 
};

// --- FAVORITOS Y HISTORIAL ---
window.toggleFavorite = () => {
    if (!currentAnimeData) return;
    let favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const isFav = favs.some(f => f.url === currentAnimeData.url); // Usamos URL o ID como clave
    
    if(isFav) {
        favs = favs.filter(f => f.url !== currentAnimeData.url);
    } else {
        favs.push({ 
            id: currentAnimeData.url.split('/').pop(), // Extraer ID
            title: currentAnimeData.title, 
            cover: currentAnimeData.cover,
            url: currentAnimeData.url
        });
    }
    localStorage.setItem('favorites', JSON.stringify(favs));
    actualizarBotonFav();
    if(document.getElementById('tab-favorites').style.display === 'block') renderFavorites();
};

function actualizarBotonFav() {
    if (!currentAnimeData) return;
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const isFav = favs.some(f => f.url === currentAnimeData.url);
    const btn = document.getElementById('btn-fav');
    if(btn) btn.innerText = isFav ? '❤️ En Favoritos' : '🤍 Añadir Favorito';
}

function renderFavorites() {
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const grid = document.getElementById('grid-favorites');
    if(!grid) return;
    
    grid.innerHTML = favs.length ? '' : '<p style="padding:10px;">Aún no tienes favoritos.</p>';
    favs.forEach(f => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        card.innerHTML = `<img src="${f.cover}"><div class="info"><span class="title">${f.title}</span></div>`;
        card.onclick = () => cargarDetalles(f.id);
        grid.appendChild(card);
    });
}

function guardarHistorial(anime) {
    if(!anime) return;
    let hist = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    // Evitar duplicados recientes
    hist = hist.filter(h => h.url !== anime.url);
    // Agregar al principio
    hist.unshift({ 
        id: anime.url.split('/').pop(),
        title: anime.title, 
        cover: anime.cover,
        url: anime.url 
    });
    // Limitar a 20
    localStorage.setItem('animeHistory', JSON.stringify(hist.slice(0, 20)));
}

function renderHistorial() {
    const hist = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    const grid = document.getElementById('grid-history');
    if(!grid) return;

    grid.innerHTML = hist.length ? '' : '<p style="padding:10px;">Historial vacío.</p>';
    hist.forEach(h => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        card.innerHTML = `<img src="${h.cover}"><div class="info"><span class="title">${h.title}</span></div>`;
        card.onclick = () => cargarDetalles(h.id);
        grid.appendChild(card);
    });
}

window.borrarHistorial = () => { 
    localStorage.removeItem('animeHistory'); 
    renderHistorial(); 
};

// --- NAVEGACIÓN MODALES ---
window.cerrarDetalles = () => document.getElementById('details-modal').style.display = 'none';
window.cerrarReproductor = () => {
    document.getElementById('player-modal').style.display = 'none';
    document.getElementById('video-wrapper').innerHTML = '';
};

// --- INICIALIZACIÓN ---
window.onload = () => {
    console.log("App iniciada. API:", API_BASE);
    cargarEstrenos();
    // Registrar Service Worker si existe
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for(let registration of registrations) {
                registration.update();
            }
        });
    }
};