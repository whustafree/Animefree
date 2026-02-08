const consoleDiv = document.getElementById('debug-console');

// --- SISTEMA DE LOGS ---
function log(msg, type = 'info') {
    const d = document.createElement('div');
    d.style.marginBottom = "2px";
    d.style.paddingLeft = "5px";
    d.style.fontSize = "11px";
    
    // Colores tipo Hacker
    if (type === 'error') d.style.color = '#ff5555';
    else if (type === 'success') d.style.color = '#55ff55';
    else if (type === 'warn') d.style.color = '#ffff55';
    else d.style.color = '#00d4ff';

    const time = new Date().toLocaleTimeString().split(' ')[0];
    d.innerText = `[${time}] ${msg}`;
    consoleDiv.appendChild(d);
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

// --- LÓGICA DE CONEXIÓN ROBUSTA ---
async function call(path) {
    const targetUrl = `https://api.consumet.org/anime/animeflv/${path}`;
    
    // Usamos 'raw' en allorigins para recibir JSON directo y evitar errores de parseo
    // Añadimos un timestamp para evitar que el celular guarde caché vieja
    const timeStamp = new Date().getTime();
    
    const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}&t=${timeStamp}`,
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        `https://thingproxy.freeboard.io/fetch/${targetUrl}`
    ];

    log(`Pidiendo datos...`, 'warn');

    for (const proxyUrl of proxies) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos de espera máx

            const response = await fetch(proxyUrl, {
                method: 'GET',
                signal: controller.signal,
                referrerPolicy: 'no-referrer' // <--- ESTO ES CLAVE PARA CELULARES
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                log(`Proxy devolvió error: ${response.status}`, 'warn');
                continue;
            }

            const data = await response.json();
            
            // Verificamos si la respuesta tiene sentido
            if (data.results || data.episodes || data.sources) {
                log(`¡Conexión exitosa!`, 'success');
                return data; // Devolvemos el JSON limpio
            } else if (data.contents) {
                // A veces AllOrigins devuelve el JSON dentro de 'contents'
                return JSON.parse(data.contents);
            }

        } catch (error) {
            log(`Intento fallido: ${error.message}`, 'error');
        }
    }

    log("ERROR FATAL: No se pudo conectar a ninguna API.", 'error');
    return null;
}

// --- INTERFAZ ---
async function init() {
    log("Iniciando sistema...", "info");
    const data = await call("recent-episodes");
    
    if (data && data.results) {
        render(data.results);
    } else {
        document.getElementById('grid').innerHTML = '<div style="text-align:center; padding:20px;">Servidores ocupados. Intenta recargar en 1 minuto.</div>';
    }
}

async function buscar() {
    const q = document.getElementById('inp').value;
    if (!q) return;
    
    log(`Buscando: ${q}`, "info");
    const data = await call(q);
    
    if (data && data.results) {
        render(data.results);
    }
}

function render(list) {
    const g = document.getElementById('grid');
    g.innerHTML = '';
    
    list.forEach(a => {
        const c = document.createElement('div');
        c.className = 'anime-card';
        // Proxy de imágenes para que se vean siempre
        const imgUrl = `https://images.weserv.nl/?url=${encodeURIComponent(a.image)}`;
        
        c.innerHTML = `
            <img src="${imgUrl}" loading="lazy" onerror="this.src='https://via.placeholder.com/140x200?text=Error+Img'">
            <div>${a.title}</div>
        `;
        c.onclick = () => loadAnime(a.id, a.title);
        g.appendChild(c);
    });
}

async function loadAnime(id, title) {
    document.getElementById('modal').style.display = 'flex';
    document.getElementById('mTitle').innerText = title;
    document.getElementById('mEps').innerHTML = 'Cargando lista...';
    document.getElementById('mLinks').innerHTML = '';
    
    const data = await call(`info?id=${id}`);
    
    if (data && data.episodes) {
        const container = document.getElementById('mEps');
        container.innerHTML = '';
        // Invertimos para que el cap 1 salga primero (opcional)
        data.episodes.reverse().forEach(e => {
            const b = document.createElement('div');
            b.className = 'ep-btn';
            b.innerText = e.number;
            b.onclick = () => loadLinks(e.id);
            container.appendChild(b);
        });
        log(`Cargados ${data.episodes.length} episodios.`, 'success');
    }
}

async function loadLinks(id) {
    log(`Buscando video...`, 'info');
    document.getElementById('mLinks').innerHTML = 'Conectando con servidor de video...';
    
    const data = await call(`watch?episodeId=${id}`);
    const cont = document.getElementById('mLinks');
    cont.innerHTML = '';
    
    if (data && data.sources) {
        data.sources.forEach(s => {
            const b = document.createElement('button');
            b.innerText = `Ver en ${s.quality}`;
            b.style.display = "block";
            b.style.width = "100%";
            b.style.padding = "15px";
            b.style.margin = "5px 0";
            b.style.background = "#ff4500";
            b.style.color = "white";
            b.style.border = "none";
            b.style.borderRadius = "8px";
            b.style.fontSize = "16px";
            b.onclick = () => window.location.href = s.url; // Abre directo en el reproductor del cel
            cont.appendChild(b);
        });
        log("¡Enlace encontrado!", 'success');
    } else {
        cont.innerHTML = 'No se encontraron enlaces.';
        log("Sin enlaces disponibles.", 'error');
    }
}

function cerrarModal() { 
    document.getElementById('modal').style.display = 'none'; 
}

// Manejo de errores globales
window.onerror = function(msg) {
    log(`JS Error: ${msg}`, 'error');
};

window.onload = init;
