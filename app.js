const API_BASE = "https://animeflv.ahmedrangel.com/api";
const PROXIES = [ 
    (u) => u, 
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, 
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}` 
];
let currentAnimeSlug = null;
let deferredPrompt;

// --- MAPA DE GÉNEROS (Nombre Botón -> Código Real AnimeFLV) ---
const GENRE_MAP = {
    "Acción": "accion",
    "Artes Marciales": "artes-marciales",
    "Aventuras": "aventura",
    "Carreras": "carreras",
    "Ciencia Ficción": "ciencia-ficcion",
    "Comedia": "comedia",
    "Demencia": "demencia",
    "Demonios": "demonios",
    "Deportes": "deportes",
    "Drama": "drama",
    "Ecchi": "ecchi",
    "Escolares": "escolares",
    "Espacial": "espacial",
    "Fantasía": "fantasia",
    "Harem": "harem",
    "Histórico": "historico",
    "Infantil": "infantil",
    "Josei": "josei",
    "Juegos": "juegos",
    "Magia": "magia",
    "Mecha": "mecha",
    "Militar": "militar",
    "Misterio": "misterio",
    "Música": "musica",
    "Parodia": "parodia",
    "Policía": "policia",
    "Psicológico": "psicologico",
    "Recuentos de la vida": "recuentos-de-la-vida",
    "Romance": "romance",
    "Samurai": "samurai",
    "Seinen": "seinen",
    "Shoujo": "shoujo",
    "Shounen": "shounen",
    "Sobrenatural": "sobrenatural",
    "Superpoderes": "superpoderes",
    "Suspenso": "suspenso",
    "Terror (Gore)": "terror", // Gore suele estar aquí
    "Vampiros": "vampiros",
    "Yaoi": "yaoi",
    "Yuri": "yuri"
    // NOTA: "Isekai" no es categoría oficial, se busca por texto.
};

// --- INSTALACIÓN ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    const btn = document.getElementById('btn-install');
    if(btn) { btn.style.display = 'inline-block'; btn.onclick = () => { btn.style.display = 'none'; deferredPrompt.prompt(); }; }
});

// --- HISTORIAL ---
window.addEventListener('popstate', () => {
    if(document.getElementById('player-modal').style.display === 'flex') { cerrarReproductor(); return; }
    if(document.getElementById('details-modal').style.display === 'block') { cerrarDetalles(); return; }
    if(!document.getElementById('tab-home').classList.contains('active')) { cambiarTab('home'); }
});
function agregarHistorial(stateId) { history.pushState({ page: stateId }, "", `#${stateId}`); }

// --- NAVEGACIÓN ---
function cambiarTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`nav-${tabId}`).classList.add('active');
    window.scrollTo(0, 0);
    if(tabId === 'history') renderHistorial();
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
    renderGeneros(); 
    history.replaceState({ page: 'home' }, "", ""); 
};

// --- GÉNEROS ---
function renderGeneros() {
    const container = document.getElementById('genre-list');
    if(!container) return;
    container.innerHTML = '';
    
    // Botón especial Isekai (Búsqueda manual)
    const btnIsekai = document.createElement('button');
    btnIsekai.className = 'genre-chip focusable';
    btnIsekai.innerText = "Isekai";
    btnIsekai.onclick = () => buscar("Isekai", true); // true = es texto
    container.appendChild(btnIsekai);

    // Resto de géneros oficiales
    Object.keys(GENRE_MAP).forEach(label => {
        const btn = document.createElement('button');
        btn.className = 'genre-chip focusable';
        btn.innerText = label;
        btn.onclick = () => buscar(label, false); // false = es filtro
        container.appendChild(btn);
    });
}

// --- HOME ---
async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    const data = await fetchData('/list/latest-episodes');
    grid.innerHTML = '';
    if (data) data.forEach(item => crearTarjeta(item, grid, 'latest'));
}

// --- SEARCH INTELIGENTE ---
async function buscar(termino = null, esTexto = true) {
    let q = termino || document.getElementById('inp').value;
    if (!q) return;
    
    // Si viene del input manual, siempre es texto
    if (!termino) esTexto = true;
    
    if(termino) document.getElementById('inp').value = termino;

    const grid = document.getElementById('grid-search');
    grid.innerHTML = '<div class="loader">Buscando...</div>';
    
    let endpoint = '';
    
    if (esTexto) {
        // Búsqueda por nombre (Para Isekai o escritura manual)
        endpoint = `/search?query=${encodeURIComponent(q)}`;
    } else {
        // Búsqueda por CATEGORÍA REAL (La solución)
        // Usamos el endpoint "by-url" para simular un filtro de la web oficial
        const slug = GENRE_MAP[q];
        if (slug) {
            // Construimos la URL de navegación de AnimeFLV
            // Nota: genre[] es la sintaxis que usa la web
            const webUrl = `https://www3.animeflv.net/browse?genre[]=${slug}&order=default&page=1`;
            endpoint = `/search/by-url?url=${encodeURIComponent(webUrl)}`;
        } else {
            // Fallback si algo falla
            endpoint = `/search?query=${encodeURIComponent(q)}`;
        }
    }
    
    const data = await fetchData(endpoint);
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
            document.getElementById('btn-play-latest').onclick = () => prepararReproductor(info.episodes[0].slug, info.title, info.episodes[0].number, info.cover);
            info.episodes.forEach(ep => {
                const b = document.createElement('div');
                b.className = 'ep-card focusable';
                b.innerText = `Ep ${ep.number}`;
                b.onclick = () => prepararReproductor(ep.slug, info.title, ep.number, info.cover);
                grid.appendChild(b);
            });
        }
    }
}
function cerrarDetalles() { document.getElementById('details-modal').style.display = 'none'; history.back(); }

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
        const prio = ["Okru", "YourUpload", "Maru", "Netu", "Streamwish", "Mega"];
        data.servers.sort((a,b) => {
            const pa = prio.indexOf(a.name); const pb = prio.indexOf(b.name);
            return (pa===-1?99:pa) - (pb===-1?99:pb);
        });
        
        data.servers.forEach((s, i) => {
            const btn = document.createElement('button');
            btn.className = 'focusable';
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
function borrarHistorial() { if(confirm("¿Borrar?")) { localStorage.removeItem('animeHistory'); renderHistorial(); } }