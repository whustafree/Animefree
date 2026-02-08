const consoleDiv = document.getElementById('debug-console');

// Sistema de Log Avanzado
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
    console.log(`[${type.toUpperCase()}] ${msg}`);
}

// Función de llamada con detalles técnicos
async function call(path) {
    const targetUrl = `https://api.consumet.org/anime/animeflv/${path}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    
    log(`Iniciando petición a: /${path}`, 'warn');

    try {
        const startTime = performance.now();
        const response = await fetch(proxyUrl);
        const endTime = performance.now();

        if (!response.ok) {
            throw new Error(`HTTP Error! Status: ${response.status}`);
        }

        const data = await response.json();
        
        log(`Respuesta recibida en ${Math.round(endTime - startTime)}ms`, 'info');

        if (!data.contents) {
            throw new Error("El Proxy no devolvió contenidos (contents es nulo)");
        }

        // Intentar parsear el contenido de la API
        try {
            const parsedData = JSON.parse(data.contents);
            log(`JSON parseado correctamente. Items: ${parsedData.results?.length || 'N/A'}`, 'success');
            return parsedData;
        } catch (parseError) {
            log(`ERROR DE PARSEO: El contenido recibido no es un JSON válido.`, 'error');
            log(`Respuesta cruda: ${data.contents.substring(0, 100)}...`, 'warn');
            return null;
        }

    } catch (error) {
        log(`ERROR DE RED/PROXY: ${error.message}`, 'error');
        return null;
    }
}

// --- LÓGICA DE LA INTERFAZ ---

async function init() {
    log("Cargando cartelera de estrenos...", "info");
    const data = await call("recent-episodes");
    if (data && data.results) {
        render(data.results);
    } else {
        log("No se pudieron cargar los estrenos.", "error");
    }
}

async function buscar() {
    const q = document.getElementById('inp').value;
    if (!q) {
        log("Búsqueda vacía abortada", "warn");
        return;
    }
    log(`Buscando anime: "${q}"`, "info");
    const data = await call(q);
    if (data && data.results) {
        render(data.results);
    }
}

function render(list) {
    const g = document.getElementById('grid');
    g.innerHTML = '';
    if (list.length === 0) {
        log("La búsqueda no devolvió resultados.", "warn");
        g.innerHTML = '<div style="padding:20px">No se encontraron resultados.</div>';
        return;
    }
    list.forEach(a => {
        const c = document.createElement('div');
        c.className = 'anime-card';
        c.innerHTML = `<img src="${a.image}" loading="lazy"><div>${a.title}</div>`;
        c.onclick = () => loadAnime(a.id, a.title);
        g.appendChild(c);
    });
}

async function loadAnime(id, title) {
    log(`Abriendo detalles de: ${title}`, "info");
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
        log(`${data.episodes.length} episodios cargados.`, "success");
    }
}

async function loadLinks(id) {
    log(`Buscando servidores para el episodio: ${id}`, "info");
    const data = await call(`watch?episodeId=${id}`);
    const cont = document.getElementById('mLinks');
    cont.innerHTML = 'Buscando links...';
    
    if (data && data.sources) {
        cont.innerHTML = '';
        data.sources.forEach(s => {
            const b = document.createElement('button');
            b.innerText = `Calidad: ${s.quality}`;
            b.style.display = "block";
            b.style.margin = "10px auto";
            b.style.padding = "10px";
            b.style.width = "100%";
            b.style.background = "#333";
            b.style.color = "white";
            b.style.border = "1px solid #ff4500";
            b.style.borderRadius = "5px";
            b.onclick = () => {
                log(`Abriendo reproductor: ${s.url.substring(0, 30)}...`, "success");
                window.open(s.url, '_blank');
            };
            cont.appendChild(b);
        });
        log(`Se encontraron ${data.sources.length} servidores.`, "success");
    } else {
        cont.innerHTML = 'No se encontraron links disponibles.';
        log("No hay fuentes de video disponibles para este episodio.", "error");
    }
}

function cerrarModal() { 
    document.getElementById('modal').style.display = 'none'; 
}

// Capturar errores no manejados
window.addEventListener('unhandledrejection', function (event) {
    log(`PROMISE ERROR: ${event.reason}`, 'error');
});

window.onerror = function(message, source, lineno, colno, error) {
    log(`JS ERROR: ${message} en línea ${lineno}`, 'error');
};

window.onload = init;
