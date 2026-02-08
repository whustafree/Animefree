const API_BASE = "https://animeflv.ahmedrangel.com/api";
const PROXIES = [ 
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`
];

async function fetchData(endpoint) {
    if (endpoint.includes('undefined')) return null;
    for (const wrap of PROXIES) {
        try {
            const resp = await fetch(wrap(API_BASE + endpoint));
            if (!resp.ok) continue;
            let data = JSON.parse(await resp.text());
            if (data.contents) data = JSON.parse(data.contents);
            return data.success ? data.data : data;
        } catch (e) {}
    }
    return null;
}

let currentTVAnime = null;

window.onload = () => {
    tvTab('home');
    tvCargarInicio();
    setTimeout(() => document.getElementById('tv-home').focus(), 500);
};

function tvTab(id) {
    document.querySelectorAll('.tv-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.tv-link').forEach(l => l.classList.remove('active'));
    document.getElementById(`view-${id}`).classList.add('active');
    
    if(id==='search') document.getElementById('tv-search-input').focus();
    if(id==='favorites') renderGridLocal('favorites', 'tv-favorites-grid');
    if(id==='history') renderGridLocal('animeHistory', 'tv-history-grid');
}

async function tvCargarInicio() {
    const data = await fetchData('/list/latest-episodes');
    if (data) {
        const hero = data[0];
        document.getElementById('hero-title').innerText = hero.title;
        document.getElementById('hero-desc').innerText = `Episodio ${hero.number}`;
        document.getElementById('hero-bg').style.backgroundImage = `url('${hero.cover}')`;
        document.getElementById('hero-play').onclick = () => {
            let s = hero.animeSlug || hero.slug;
            if(s.includes('-episodio-')) s = s.split('-episodio-')[0];
            tvOpenDetails(s);
        };

        const row = document.getElementById('row-latest');
        row.innerHTML = '';
        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'anime-card focusable';
            card.tabIndex = 0;
            card.innerHTML = `<img src="${item.cover}"><div class="info">${item.title}</div>`;
            card.onclick = () => {
                let s = item.animeSlug || item.slug;
                if(s.includes('-episodio-')) s = s.split('-episodio-')[0];
                tvOpenDetails(s);
            };
            card.onkeydown = (e) => { if (e.key === 'Enter') card.click(); };
            row.appendChild(card);
        });
        renderRowLocal('favorites', 'row-favs');
    }
}

async function tvBuscar() {
    const q = document.getElementById('tv-search-input').value;
    const grid = document.getElementById('tv-search-results');
    grid.innerHTML = 'Cargando...';
    const data = await fetchData(`/search?query=${encodeURIComponent(q)}`);
    grid.innerHTML = '';
    if (data && data.media) {
        data.media.forEach(item => {
            const card = document.createElement('div'); card.className = 'anime-card focusable'; card.tabIndex = 0;
            card.innerHTML = `<img src="${item.cover}"><div class="info">${item.title}</div>`;
            card.onclick = () => tvOpenDetails(item.slug);
            card.onkeydown = (e) => { if (e.key === 'Enter') card.click(); };
            grid.appendChild(card);
        });
    }
}

async function tvOpenDetails(slug) {
    const info = await fetchData(`/anime/${slug}`);
    if (info) {
        currentTVAnime = info;
        document.getElementById('tv-details-modal').style.display = 'flex';
        if(info.episodes) info.episodes.sort((a,b)=>parseFloat(a.number)-parseFloat(b.number));
        
        document.getElementById('tv-det-img').src = info.cover;
        document.getElementById('tv-det-title').innerText = info.title;
        document.getElementById('tv-det-desc').innerText = (info.synopsis || "").substring(0,250)+'...';
        
        const list = document.getElementById('tv-episodes-list'); list.innerHTML = '';
        info.episodes.forEach(ep => {
            const btn = document.createElement('div'); btn.className = 'tv-ep-btn focusable'; btn.tabIndex = 0;
            btn.innerText = ep.number;
            btn.onclick = () => tvPlay(ep.slug);
            btn.onkeydown = (e) => { if (e.key === 'Enter') btn.click(); };
            list.appendChild(btn);
        });
        
        // Guardar en historial TV
        let hist = JSON.parse(localStorage.getItem('animeHistory') || '[]');
        hist = hist.filter(h => h.slug !== info.slug);
        hist.unshift({ slug: info.slug, title: info.title, cover: info.cover });
        localStorage.setItem('animeHistory', JSON.stringify(hist.slice(0, 15)));

        setTimeout(() => document.getElementById('tv-btn-play').focus(), 100);
    }
}

async function tvPlay(slug) {
    document.getElementById('tv-player').style.display = 'block';
    const data = await fetchData(`/anime/episode/${slug}`);
    if(data && data.servers) {
        document.getElementById('tv-video-container').innerHTML = `<iframe src="${data.servers[0].embed || data.servers[0].url}" style="width:100%;height:100%;border:none;" allowfullscreen></iframe>`;
        setTimeout(() => document.querySelector('.tv-close-player').focus(), 500);
    }
}

function closeTvDetails() { document.getElementById('tv-details-modal').style.display = 'none'; }
function closeTvPlayer() { document.getElementById('tv-player').style.display = 'none'; document.getElementById('tv-video-container').innerHTML=''; }

function renderRowLocal(key, id) {
    const list = JSON.parse(localStorage.getItem(key)||'[]');
    const c = document.getElementById(id); if(!c) return; c.innerHTML= list.length ? '' : '<p style="margin-left:20px">Vacio</p>';
    list.forEach(i => {
        const card = document.createElement('div'); card.className='anime-card focusable'; card.tabIndex=0;
        card.innerHTML=`<img src="${i.cover}"><div class="info">${i.title}</div>`;
        card.onclick=()=>tvOpenDetails(i.slug);
        card.onkeydown = (e) => { if (e.key === 'Enter') card.click(); };
        c.appendChild(card);
    });
}
function renderGridLocal(key, id) {
    renderRowLocal(key, id);
}