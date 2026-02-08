const API_BASE = "https://animeflv.ahmedrangel.com/api";
const PROXIES = [ (u)=>u, (u)=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, (u)=>`https://corsproxy.io/?${encodeURIComponent(u)}` ];
let currentAnimeSlug = null;
let deferredPrompt;

// --- INSTALACIÓN ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    const btn = document.getElementById('btn-install');
    if(btn) { btn.style.display = 'inline-block'; btn.onclick = () => { btn.style.display = 'none'; deferredPrompt.prompt(); }; }
});

// --- HISTORIAL ---
window.addEventListener('popstate', () => {
    // Cerrar modales si están abiertos
    if(document.getElementById('player-modal').style.display === 'flex') { cerrarReproductor(); return; }
    if(document.getElementById('details-modal').style.display === 'block') { cerrarDetalles(); return; }
    
    // Si estamos en una pestaña que no es Home, volver a Home
    if(!document.getElementById('tab-home').classList.contains('active')) { cambiarTab('home'); }
});
function agregarHistorial(stateId) { history.pushState({ page: stateId }, "", `#${stateId}`); }

// --- NAVEGACIÓN PESTAÑAS ---
function cambiarTab(tabId) {
    // 1. Ocultar todas las pestañas
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    // 2. Mostrar la seleccionada
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`nav-${tabId}`).classList.add('active');
    
    // 3. Scroll arriba
    window.scrollTo(0, 0);

    // 4. Acciones específicas
    if(tabId === 'history') renderHistorial();
    if(tabId === 'search') document.getElementById('inp').focus();
}

// --- CORE ---
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
    if (data && data.media) data.media.forEach(anime => crearTarjeta(anime, grid, 'search'));
    else grid.innerHTML = '<div class="placeholder-msg">Sin resultados</div>';
}

// --- TARJETAS ---
function crearTarjeta(item, container, context) {
    const card = document.createElement('div');
    card.className = 'anime-card';
    const img = item.cover || 'https://via.placeholder.com/150';
    let meta = context === 'latest' ? `Ep ${item.number}` : (context === 'search' ? (item.type || 'Anime') : `Ep ${item.lastEp}`);
    
    card.innerHTML = `
        <img src="${img}" loading="lazy">
        ${context === 'latest' ? '<div class="badge-new">NUEVO</div>' : ''}
        <div class="info"><span class="title">${item.title}</span><div class="meta">${meta}</div></div>
    `;
    card.onclick = () => {
        if (context === 'search') cargarDetallesAnime(item.slug);
        else if (context === 'latest') {
            const slugAnime = item.slug.split('-').slice(0, -1).join('-');
            currentAnimeSlug = slugAnime;
            prepararReproductor(item.slug, item.title, item.number, img);
        } else {
            prepararReproductor(item.slug, item.title, item.lastEp, img);
            currentAnimeSlug = item.animeSlug;
        }
    };
    container.appendChild(card);
}

// --- DETALLES & PLAYER (Funciones estándar) ---
async function cargarDetallesAnime(slug) {
    currentAnimeSlug = slug;
    agregarHistorial('details');
    document.getElementById('details-modal').style.display = 'block';
    const info = await fetchData(`/anime/${slug}`);
    if(info) {
        document.getElementById('det-title').innerText = info.title;
        document.getElementById('det-synopsis').innerText = (info.synopsis || "").substring(0, 150) + "...";
        document.getElementById('det-img').src = info.cover;
        document.getElementById('det-genres').innerHTML = info.genres.map(g=>`<span>${g}</span>`).join('');
        const grid = document.getElementById('det-episodes');
        grid.innerHTML = '';
        if(info.episodes.length > 0) {
            document.getElementById('btn-play-latest').onclick = () => prepararReproductor(info.episodes[0].slug, info.title, info.episodes[0].number, info.cover);
            info.episodes.forEach(ep => {
                const b = document.createElement('div');
                b.className = 'ep-card';
                b.innerText = `Ep ${ep.number}`;
                b.onclick = () => prepararReproductor(ep.slug, info.title, ep.number, info.cover);
                grid.appendChild(b);
            });
        }
    }
}
function cerrarDetalles() { document.getElementById('details-modal').style.display = 'none'; history.back(); }

async function prepararReproductor(slug, title, number, cover) {
    agregarHistorial('player');
    document.getElementById('player-modal').style.display = 'flex';
    document.getElementById('player-title').innerText = `Ep ${number}: ${title}`;
    if(currentAnimeSlug) guardarHistorial({animeSlug: currentAnimeSlug, slug:slug, title:title, lastEp:number, cover:cover});
    
    const list = document.getElementById('server-list');
    list.innerHTML = 'Cargando...';
    const data = await fetchData(`/anime/episode/${slug}`);
    list.innerHTML = '';
    if(data && data.servers) {
        // Orden inteligente
        const prio = ["Okru", "YourUpload", "Maru", "Netu", "Streamwish", "Mega"];
        data.servers.sort((a,b) => prio.indexOf(a.name) - prio.indexOf(b.name));
        
        data.servers.forEach((s, i) => {
            const btn = document.createElement('button');
            btn.innerText = s.name;
            btn.onclick = () => {
                document.querySelectorAll('.server-list button').forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('video-wrapper').innerHTML = `<iframe src="${s.embed || s.code || s.url}" allowfullscreen allow="autoplay"></iframe>`;
            };
            list.appendChild(btn);
            if(i===0) btn.click();
        });
    }
}
function cerrarReproductor() { document.getElementById('player-modal').style.display = 'none'; document.getElementById('video-wrapper').innerHTML=''; history.back(); }
function abrirDetallesDesdePlayer() { cerrarReproductor(); setTimeout(()=>cargarDetallesAnime(currentAnimeSlug), 300); }

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
    localStorage.setItem('animeHistory', JSON.stringify(h));
}
function borrarHistorial() { localStorage.removeItem('animeHistory'); renderHistorial(); }