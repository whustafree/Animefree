const API_BASE = "https://animeflv.ahmedrangel.com/api";
const PROXIES = [ 
    (u) => u, 
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, 
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}` 
];
let currentAnimeSlug = null;
let deferredPrompt;

// --- INSTALACIÓN ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    const btn = document.getElementById('btn-install');
    if(btn) { 
        btn.style.display = 'inline-block'; 
        btn.onclick = () => { btn.style.display = 'none'; deferredPrompt.prompt(); }; 
    }
});

// --- HISTORIAL DE NAVEGACIÓN ---
window.addEventListener('popstate', () => {
    // 1. Cerrar modales si están abiertos
    if(document.getElementById('player-modal').style.display === 'flex') { 
        cerrarReproductor(); return; 
    }
    if(document.getElementById('details-modal').style.display === 'block') { 
        cerrarDetalles(); return; 
    }
    
    // 2. Si estamos en una pestaña que no es Home, volver a Home
    if(!document.getElementById('tab-home').classList.contains('active')) { 
        cambiarTab('home'); 
    }
});
function agregarHistorial(stateId) { 
    history.pushState({ page: stateId }, "", `#${stateId}`); 
}

// --- NAVEGACIÓN PESTAÑAS ---
function cambiarTab(tabId) {
    // Ocultar todo
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    // Mostrar selección
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`nav-${tabId}`).classList.add('active');
    
    // Scroll arriba
    window.scrollTo(0, 0);

    // Acciones especiales
    if(tabId === 'history') renderHistorial();
    if(tabId === 'search') document.getElementById('inp').focus();
}

// --- CORE FETCH ---
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
    cargarEstrenos(); 
    renderHistorial();
    history.replaceState({ page: 'home' }, "", ""); 
};

// --- HOME ---
async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    const data = await fetchData('/list/latest-episodes');
    grid.innerHTML = '';
    if (data) data.forEach(item => crearTarjeta(item, grid, 'latest'));
}

// --- SEARCH ---
async function buscar() {
    const q = document.getElementById('inp').value;
    if (!q) return;
    
    const grid = document.getElementById('grid-search');
    grid.innerHTML = '<div class="loader">Buscando...</div>';
    
    const data = await fetchData(`/search?query=${encodeURIComponent(q)}`);
    grid.innerHTML = '';
    
    if (data && data.media) {
        data.media.forEach(anime => crearTarjeta(anime, grid, 'search'));
    } else {
        grid.innerHTML = '<div class="placeholder-msg"><p>No se encontraron resultados.</p></div>';
    }
}

// --- TARJETAS ---
function crearTarjeta(item, container, context) {
    const card = document.createElement('div');
    card.className = 'anime-card focusable';
    card.setAttribute('tabindex', '0');
    
    const img = item.cover || 'https://via.placeholder.com/150';
    let meta = '';
    
    if (context === 'latest') meta = `Ep ${item.number}`;
    else if (context === 'search') meta = item.type || 'Anime';
    else meta = `Visto: Ep ${item.lastEp}`;
    
    card.innerHTML = `
        <img src="${img}" loading="lazy">
        ${context === 'latest' ? '<div class="badge-new">NUEVO</div>' : ''}
        <div class="info">
            <span class="title">${item.title}</span>
            <div class="meta">${meta}</div>
        </div>
    `;
    
    card.onclick = () => {
        if (context === 'search') {
            cargarDetallesAnime(item.slug);
        } else if (context === 'latest') {
            // Limpiar slug de episodio para obtener anime
            const slugAnime = item.slug.split('-').slice(0, -1).join('-');
            currentAnimeSlug = slugAnime;
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
    
    if(info) {
        document.getElementById('det-title').innerText = info.title;
        document.getElementById('det-synopsis').innerText = (info.synopsis || "Sin sinopsis.").substring(0, 200) + "...";
        document.getElementById('det-img').src = info.cover;
        document.getElementById('det-genres').innerHTML = info.genres.map(g=>`<span>${g}</span>`).join('');
        
        const grid = document.getElementById('det-episodes');
        grid.innerHTML = '';
        
        if(info.episodes.length > 0) {
            // Configurar botón "Ver último"
            document.getElementById('btn-play-latest').onclick = () => 
                prepararReproductor(info.episodes[0].slug, info.title, info.episodes[0].number, info.cover);
            
            // Lista completa
            info.episodes.forEach(ep => {
                const b = document.createElement('div');
                b.className = 'ep-card focusable';
                b.setAttribute('tabindex', '0');
                b.innerText = `Ep ${ep.number}`;
                b.onclick = () => prepararReproductor(ep.slug, info.title, ep.number, info.cover);
                b.onkeydown = (e) => { if(e.key === 'Enter') b.click(); };
                grid.appendChild(b);
            });
        }
    }
}
function cerrarDetalles() { 
    document.getElementById('details-modal').style.display = 'none'; 
    history.back(); 
}

// --- REPRODUCTOR ---
async function prepararReproductor(slug, title, number, cover) {
    agregarHistorial('player');
    const modal = document.getElementById('player-modal');
    modal.style.display = 'flex';
    document.getElementById('player-title').innerText = `Ep ${number}: ${title}`;
    document.getElementById('video-wrapper').innerHTML = '';
    
    if(currentAnimeSlug) guardarHistorial({animeSlug: currentAnimeSlug, slug:slug, title:title, lastEp:number, cover:cover});
    
    const list = document.getElementById('server-list');
    list.innerHTML = 'Cargando...';
    
    const data = await fetchData(`/anime/episode/${slug}`);
    list.innerHTML = '';
    
    if(data && data.servers) {
        // Orden inteligente
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
                document.getElementById('video-wrapper').innerHTML = `<iframe src="${s.embed || s.code || s.url}" allowfullscreen allow="autoplay; encrypted-media; fullscreen"></iframe>`;
            };
            list.appendChild(btn);
            if(i===0) btn.click();
        });
    } else {
        list.innerHTML = 'Error: No servers';
    }
}
function cerrarReproductor() { 
    document.getElementById('player-modal').style.display = 'none'; 
    document.getElementById('video-wrapper').innerHTML=''; 
    history.back(); 
}
function abrirDetallesDesdePlayer() { 
    // Truco: cerramos player (lo cual hace history back) y abrimos detalles
    document.getElementById('player-modal').style.display = 'none';
    document.getElementById('video-wrapper').innerHTML='';
    history.back(); 
    setTimeout(()=>cargarDetallesAnime(currentAnimeSlug), 300); 
}

// --- UTILS ---
function renderHistorial() {
    const g = document.getElementById('grid-history');
    const h = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    g.innerHTML = '';
    if(h.length===0) g.innerHTML = '<div class="placeholder-msg"><p>Sin historial</p></div>';
    h.reverse().forEach(i => crearTarjeta(i, g, 'history'));
}
function guardarHistorial(i) {
    let h = JSON.parse(localStorage.getItem('animeHistory') || '[]');
    h = h.filter(x => x.animeSlug !== i.animeSlug);
    h.push(i);
    if(h.length>50) h.shift();
    localStorage.setItem('animeHistory', JSON.stringify(h));
}
function borrarHistorial() { 
    if(confirm("¿Borrar?")) { localStorage.removeItem('animeHistory'); renderHistorial(); } 
}