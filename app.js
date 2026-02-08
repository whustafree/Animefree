const consoleDiv = document.getElementById('debug-console');

// --- SISTEMA DE LOGS DETALLADO ---
function log(msg, type = 'info') {
    const d = document.createElement('div');
    d.style.marginBottom = "3px";
    d.style.borderLeft = "3px solid";
    d.style.paddingLeft = "5px";
    const time = new Date().toLocaleTimeString();
    
    switch(type) {
        case 'error': 
            d.style.color = '#ff5555'; 
            d.style.borderLeftColor = '#ff0000';
            break;
        case 'success': 
            d.style.color = '#55ff55'; 
            d.style.borderLeftColor = '#00ff00';
            break;
        case 'warn': 
            d.style.color = '#ffff55'; 
            d.style.borderLeftColor = '#ffff00';
            break;
        default: 
            d.style.color = '#00d4ff'; 
            d.style.borderLeftColor = '#00d4ff';
    }

    d.innerText = `[${time}] ${msg}`;
    consoleDiv.appendChild(d);
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

// --- FUNCIÓN DE LLAMADA CON ROTACIÓN DE PROXIES (ANTI-CORS) ---
async function call(path) {
    const targetUrl = `https://api.consumet.org/anime/animeflv/${path}`;
    
    // Lista de proxies para intentar saltar el bloqueo de GitHub Pages
    const proxies = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        `https://thingproxy.freeboard.io/fetch/${targetUrl}`
    ];

    log(`Iniciando petición a: /${path}`, 'warn');

    for (const proxyUrl of proxies) {
        try {
            const host = new URL(proxyUrl).hostname;
            log(`Probando proxy: ${host}...`, 'info');
            
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const textData = await response.text();
            let finalData;

            // AllOrigins devuelve un objeto con .contents, otros el JSON directo
            try {
                const json = JSON.parse(textData);
                finalData = json.contents ? JSON.parse(json.contents) : json;
            } catch (e) {
                // Si falla el primer parseo, intentamos el texto directo
                finalData = JSON.parse(textData);
            }

            log(`¡Éxito con ${host}!`, 'success');
            return finalData;

        } catch (error) {
            log(`Fallo proxy ${new URL(proxyUrl).hostname}: ${error.message}`, 'error');
            // Continúa al siguiente proxy en el bucle
        }
    }

    log("TODOS LOS PROXIES FALLARON. La API podría estar caída.", "error");
    return null;
}

// --- LÓGICA DE RENDERIZADO Y CONTROL ---

async function init() {
    log("Cargando cartelera de estrenos...", "info");
    const data = await call("recent-episodes");
    if (data && data.results) {
        render(data.results);
    }
}

async function buscar() {
    const q = document.getElementById('inp').value;
    if (!q) return log("Ingresa un nombre para buscar", "warn");
    log(`Buscando: "${q}"`, "info");
    const data = await call(q);
    if (data && data.results) {
        render(data.results);
    }
}

function render(list) {
    const g = document.getElementById('grid');
    g.innerHTML = '';
    
    if (!list || list.length === 0) {
        log("No hay resultados para mostrar", "warn");
        return;
    }

    list.forEach(a => {
        const c = document.createElement('div');
        c.className = 'anime-card';
        // Usamos images.weserv.nl para evitar bloqueos de imágenes (Hotlinking)
        const proxyImg = `https://images.weserv.nl/?url=${encodeURIComponent(a.image)}`;
        
        c.innerHTML = `
            <img src="${proxyImg}" loading="lazy" onerror="this.src='https://via.placeholder.com/140x200?text=No+Image'">
            <div>${a.title}</div>
        `;
        c.onclick = () => loadAnime(a.id, a.title);
        g.appendChild(c);
    });
}

async function loadAnime(id, title) {
    log(`Abriendo: ${title}`, "info");
    document.getElementById('modal').style.display = 'flex';
    document.getElementById('mTitle').innerText = title;
    document.getElementById('mEps').innerHTML = 'Cargando episodios...';
    document.getElementById('mLinks').innerHTML = '';
    
    const data = await call(`info?id=${id}`);
    if (data && data.episodes) {
        const container = document.getElementById('mEps');
        container.innerHTML = '';
        data.episodes.forEach(e => {
            const b = document.createElement('div');
            b.className = 'ep-btn';
            b.innerText = e.number;
            b.onclick = () => loadLinks(e.id);
            container.appendChild(b);
        });
        log(`${data.episodes.length} episodios encontrados.`, "success");
    }
}

async function loadLinks(id) {
    log(`Buscando video para ep: ${id}`, "info");
    const data = await call(`watch?episodeId=${id}`);
    const cont = document.getElementById('mLinks');
    cont.innerHTML = 'Obteniendo links...';
    
    if (data && data.sources) {
        cont.innerHTML = '';
        data.sources.forEach(s => {
            const b = document.createElement('button');
            b.innerText = `Calidad: ${s.quality}`;
            b.style.display = "block";
            b.style.margin = "10px auto";
            b.style.padding = "12px";
            b.style.width = "100%";
            b.style.background = "#333";
            b.style.color = "white";
            b.style.border = "1px solid #ff4500";
            b.style.borderRadius = "5px";
            b.onclick = () => {
                log(`Abriendo servidor ${s.quality}`, "success");
                window.open(s.url, '_blank');
            };
            cont.appendChild(b);
        });
    } else {
        cont.innerHTML = 'No se encontraron links.';
    }
}

function cerrarModal() { 
    document.getElementById('modal').style.display = 'none'; 
}

// Errores globales de JS
window.onerror = (m, s, l) => log(`JS ERROR: ${m} en línea ${l}`, 'error');

window.onload = init;
