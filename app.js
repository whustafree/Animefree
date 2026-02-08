const consoleDiv = document.getElementById('debug-console');
function log(m, isErr=false) {
    const d = document.createElement('div');
    if(isErr) d.style.color = '#ff5555';
    d.innerText = `> ${m}`;
    consoleDiv.appendChild(d);
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

async function call(path) {
    const targetUrl = `https://api.consumet.org/anime/animeflv/${path}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    
    log(`Consultando...`);
    try {
        const r = await fetch(proxyUrl);
        const data = await r.json();
        return JSON.parse(data.contents);
    } catch(e) {
        log(`Error: ${e.message}`, true);
        return null;
    }
}

async function init() {
    const data = await call("recent-episodes");
    if(data) render(data.results);
}

async function buscar() {
    const q = document.getElementById('inp').value;
    const data = await call(q);
    if(data) render(data.results);
}

function render(list) {
    const g = document.getElementById('grid');
    g.innerHTML = '';
    list.forEach(a => {
        const c = document.createElement('div');
        c.className = 'anime-card';
        c.innerHTML = `<img src="${a.image}"><div>${a.title}</div>`;
        c.onclick = () => loadAnime(a.id, a.title);
        g.appendChild(c);
    });
}

async function loadAnime(id, title) {
    document.getElementById('modal').style.display = 'flex';
    document.getElementById('mTitle').innerText = title;
    const data = await call(`info?id=${id}`);
    if(data) {
        const container = document.getElementById('mEps');
        container.innerHTML = '';
        data.episodes.forEach(e => {
            const b = document.createElement('div');
            b.className = 'ep-btn';
            b.innerText = e.number;
            b.onclick = () => loadLinks(e.id);
            container.appendChild(b);
        });
    }
}

async function loadLinks(id) {
    const data = await call(`watch?episodeId=${id}`);
    const cont = document.getElementById('mLinks');
    cont.innerHTML = '';
    if(data && data.sources) {
        data.sources.forEach(s => {
            const b = document.createElement('button');
            b.innerText = `Calidad: ${s.quality}`;
            b.style.display = "block";
            b.style.margin = "10px auto";
            b.onclick = () => window.open(s.url, '_blank');
            cont.appendChild(b);
        });
    }
}

function cerrarModal() { document.getElementById('modal').style.display = 'none'; }
window.onload = init;
