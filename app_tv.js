// --- IMPORTANTE: COPIA LA MISMA FUNCIÓN fetchData() DE APP_WEB.JS AQUÍ ---
const API_BASE = "https://animeflv.ahmedrangel.com/api";
const PROXIES = [ (u)=>u, (u)=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, (u)=>`https://corsproxy.io/?${encodeURIComponent(u)}` ];
async function fetchData(endpoint) { /* ... COPIA LA MISMA LOGICA DE FETCH ... */ 
    for (const wrap of PROXIES) { try { const r = await fetch(wrap(API_BASE+endpoint)); if(r.ok) { let d=JSON.parse(await r.text()); return d.contents?JSON.parse(d.contents).data:d.data; } } catch(e){} } return null;
}

let currentTVAnime = null;

window.onload = () => {
    tvTab('home');
    tvCargarInicio();
    // Foco inicial
    setTimeout(()=>document.getElementById('tv-home').focus(), 500);
};

// NAVEGACIÓN
function tvTab(id) {
    document.querySelectorAll('.tv-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${id}`).classList.add('active');
    
    if(id==='favorites') tvRenderGrid('favorites', 'tv-favorites-grid');
    if(id==='history') tvRenderGrid('animeHistory', 'tv-history-grid');
    if(id==='search') document.getElementById('tv-search-input').focus();
}

// INICIO (HERO + FILAS)
async function tvCargarInicio() {
    const data = await fetchData('/list/latest-episodes');
    if(data) {
        // Hero
        const hero = data[0];
        document.getElementById('hero-title').innerText = hero.title;
        document.getElementById('hero-desc').innerText = `Episodio ${hero.number}`;
        document.getElementById('hero-bg').style.backgroundImage = `url('${hero.cover}')`;
        document.getElementById('hero-play').onclick = () => tvOpenDetails(hero.slug.split('-').slice(0,-1).join('-'));
        
        // Fila Estrenos
        const row = document.getElementById('row-latest');
        row.innerHTML = '';
        data.forEach(item => {
            const card = document.createElement('div'); card.className = 'anime-card focusable'; card.tabIndex = 0;
            card.innerHTML = `<img src="${item.cover}">`;
            card.onclick = () => tvOpenDetails(item.animeSlug || item.slug.replace(/-episodio-\d+$/, ''));
            card.onkeydown = (e) => { if(e.key==='Enter') card.click(); };
            row.appendChild(card);
        });
        
        // Fila Favoritos (Mini)
        tvRenderRow('favorites', 'row-favs');
    }
}

// BUSCADOR TV
async function tvBuscar() {
    const q = document.getElementById('tv-search-input').value;
    const grid = document.getElementById('tv-search-results');
    grid.innerHTML = 'Cargando...';
    const data = await fetchData(`/search?query=${encodeURIComponent(q)}`);
    grid.innerHTML = '';
    if(data && data.media) {
        data.media.forEach(item => {
            const card = document.createElement('div'); card.className='anime-card focusable'; card.tabIndex=0;
            card.innerHTML = `<img src="${item.cover}"><div class="info">${item.title}</div>`;
            card.onclick = () => tvOpenDetails(item.slug);
            grid.appendChild(card);
        });
    }
}

// DETALLES TV
async function tvOpenDetails(slug) {
    document.getElementById('tv-details-modal').style.display = 'flex';
    const info = await fetchData(`/anime/${slug}`);
    if(info) {
        currentTVAnime = info;
        info.episodes.sort((a,b)=>parseFloat(a.number)-parseFloat(b.number));
        document.getElementById('tv-det-img').src = info.cover;
        document.getElementById('tv-det-title').innerText = info.title;
        document.getElementById('tv-det-desc').innerText = info.synopsis.substring(0,300);
        
        const list = document.getElementById('tv-episodes-list'); list.innerHTML='';
        info.episodes.forEach(ep => {
            const btn = document.createElement('div'); btn.className='tv-ep-btn focusable'; btn.tabIndex=0; btn.innerText = ep.number;
            btn.onclick = () => tvPlay(ep.slug);
            list.appendChild(btn);
        });
        document.getElementById('tv-btn-play').focus();
    }
}

async function tvPlay(slug) {
    document.getElementById('tv-player').style.display='block';
    const data = await fetchData(`/anime/episode/${slug}`);
    if(data && data.servers) {
        document.getElementById('tv-video-container').innerHTML = `<iframe src="${data.servers[0].embed || data.servers[0].url}" style="width:100%;height:100%;border:none;" allowfullscreen></iframe>`;
    }
}

function closeTvDetails() { document.getElementById('tv-details-modal').style.display='none'; }
function closeTvPlayer() { document.getElementById('tv-player').style.display='none'; document.getElementById('tv-video-container').innerHTML=''; }

// UTILS RENDER
function tvRenderRow(key, id) {
    const list = JSON.parse(localStorage.getItem(key)||'[]');
    const c = document.getElementById(id); c.innerHTML='';
    list.forEach(i => {
        const card = document.createElement('div'); card.className='anime-card focusable'; card.tabIndex=0;
        card.innerHTML = `<img src="${i.cover}">`;
        card.onclick = () => tvOpenDetails(i.slug);
        c.appendChild(card);
    });
}
function tvRenderGrid(key, id) {
    const list = JSON.parse(localStorage.getItem(key)||'[]');
    const c = document.getElementById(id); c.innerHTML='';
    list.forEach(i => {
        const card = document.createElement('div'); card.className='anime-card focusable'; card.tabIndex=0;
        card.innerHTML = `<img src="${i.cover}"><div class="info">${i.title}</div>`;
        card.onclick = () => tvOpenDetails(i.slug);
        c.appendChild(card);
    });
}