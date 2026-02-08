const API_BASE = "https://animeflv.ahmedrangel.com/api";
const PROXIES = [ (u)=>u, (u)=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, (u)=>`https://corsproxy.io/?${encodeURIComponent(u)}` ];
let currentAnimeData = null;
let currentEpisodeIndex = -1;
let searchPage = 1; let currentQuery = ""; let hasMoreResults = true; let isLoadingMore = false;

// INICIO WEB
window.onload = () => {
    cargarEstrenos(); renderHistorial(); renderFavorites();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
};

// FETCH
async function fetchData(endpoint) {
    if(endpoint.includes('undefined')) return null;
    for (const wrap of PROXIES) {
        try {
            const resp = await fetch(wrap(API_BASE + endpoint));
            if(!resp.ok) continue;
            let data = JSON.parse(await resp.text());
            if(data.contents) data = JSON.parse(data.contents);
            return data.success ? data.data : null;
        } catch(e){}
    }
    return null;
}

// LOGICA PRINCIPAL
async function cargarEstrenos() {
    const grid = document.getElementById('grid-latest');
    const data = await fetchData('/list/latest-episodes');
    if(data) {
        grid.innerHTML = '';
        data.forEach(item => crearTarjeta(item, grid, 'latest'));
    }
}

async function buscar() {
    const q = document.getElementById('inp').value;
    if(!q) return;
    searchPage = 1; currentQuery = q; hasMoreResults = true;
    const grid = document.getElementById('grid-search');
    grid.innerHTML = '<div class="loader">...</div>';
    await cargarMasResultados(true);
}

async function cargarMasResultados(limpiar) {
    if(isLoadingMore || !hasMoreResults) return; isLoadingMore = true;
    const grid = document.getElementById('grid-search');
    const data = await fetchData(`/search?query=${encodeURIComponent(currentQuery)}&page=${searchPage}`);
    if(limpiar) grid.innerHTML = '';
    if(data && data.media.length > 0) {
        data.media.forEach(item => crearTarjeta(item, grid, 'search'));
        searchPage++; hasMoreResults = data.hasNextPage;
    } else { hasMoreResults = false; }
    isLoadingMore = false;
}

// SCROLL INFINITO
document.querySelector('#tab-search .content-body').addEventListener('scroll', (e) => {
    if(e.target.scrollTop + e.target.clientHeight >= e.target.scrollHeight - 100) cargarMasResultados();
});

// UI
function crearTarjeta(item, container, ctx) {
    const card = document.createElement('div'); card.className = 'anime-card';
    const img = item.cover || 'https://via.placeholder.com/150';
    const meta = ctx === 'latest' ? `Ep ${item.number}` : (item.type || 'Anime');
    card.innerHTML = `<img src="${img}"><div class="info"><span class="title">${item.title}</span><div class="meta">${meta}</div></div>`;
    card.onclick = () => {
        const slug = item.animeSlug || (item.slug.includes('-episodio-') ? item.slug.split('-').slice(0,-1).join('-') : item.slug);
        cargarDetalles(slug);
    };
    container.appendChild(card);
}

async function cargarDetalles(slug) {
    document.getElementById('details-modal').style.display='block';
    const info = await fetchData(`/anime/${slug}`);
    if(info) {
        currentAnimeData = info;
        info.episodes.sort((a,b)=>parseFloat(a.number)-parseFloat(b.number)); // Orden 1-2-3
        document.getElementById('det-title').innerText = info.title;
        document.getElementById('det-img').src = info.cover;
        document.getElementById('det-synopsis').innerText = info.synopsis.substring(0,200)+'...';
        document.getElementById('backdrop-img').style.backgroundImage = `url('${info.cover}')`;
        
        const grid = document.getElementById('det-episodes'); grid.innerHTML = '';
        info.episodes.forEach((ep, i) => {
            const btn = document.createElement('div'); btn.className='ep-card'; btn.innerText = ep.number;
            btn.onclick = () => { currentEpisodeIndex=i; playVideo(ep.slug, ep.number); };
            grid.appendChild(btn);
        });
    }
}

async function playVideo(slug, number) {
    document.getElementById('player-modal').style.display='flex';
    document.getElementById('video-wrapper').innerHTML = '';
    const data = await fetchData(`/anime/episode/${slug}`);
    if(data && data.servers) {
        const s = document.getElementById('server-list'); s.innerHTML='';
        data.servers.forEach(srv => {
            const b = document.createElement('button'); b.innerText = srv.name;
            b.onclick = () => document.getElementById('video-wrapper').innerHTML = `<iframe src="${srv.embed || srv.url}" allowfullscreen></iframe>`;
            s.appendChild(b);
        });
        s.firstChild.click();
    }
}

// UTILS
function cambiarTab(id) {
    document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    document.getElementById(`tab-${id}`).classList.add('active');
    document.getElementById(`nav-${id}`).classList.add('active');
}
function cerrarDetalles() { document.getElementById('details-modal').style.display='none'; }
function cerrarReproductor() { document.getElementById('player-modal').style.display='none'; document.getElementById('video-wrapper').innerHTML=''; }
function borrarHistorial() { localStorage.removeItem('animeHistory'); renderHistorial(); }
function renderHistorial() { /* Render logic here from localstorage */ }
function renderFavorites() { /* Render logic here from localstorage */ }