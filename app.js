const consoleDiv = document.getElementById('debug-console');

// --- SISTEMA DE LOGS ---
function log(msg, type = 'info') {
    const d = document.createElement('div');
    d.style.marginBottom = "2px";
    d.style.paddingLeft = "5px";
    d.style.fontSize = "11px";
    
    if (type === 'error') d.style.color = '#ff5555';
    else if (type === 'success') d.style.color = '#55ff55';
    else if (type === 'warn') d.style.color = '#ffff55';
    else d.style.color = '#00d4ff';

    const time = new Date().toLocaleTimeString().split(' ')[0];
    d.innerText = `[${time}] ${msg}`;
    consoleDiv.appendChild(d);
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

// --- LÓGICA DE CONEXIÓN INTELIGENTE ---
async function call(path) {
    // LISTA DE APIS (Si una falla, salta a la siguiente)
    // 1. Animetize (Clon público de Consumet - Más rápido)
    // 2. Consumet Oficial (vía Proxy para saltar bloqueo)
    const candidates = [
        { 
            url: `https://animetize-api.vercel.app/anime/animeflv/${path}`, 
            proxy: false 
        },
        { 
            url: `https://api.consumet.org/anime/animeflv/${path}`, 
            proxy: true 
        }
    ];

    log(`Pidiendo datos...`, 'warn');

    for (const api of candidates) {
        let fetchUrl = api.url;
        
        // Si la API requiere proxy (como la oficial), lo envolvemos
        if (api.proxy) {
            const timeStamp = new Date().getTime();
            fetchUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(api.url)}&t=${timeStamp}`;
        }

        try {
            log(`Probando servidor: ${new URL(api.url).hostname}...`, 'info');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 seg límite

            const response = await fetch(fetchUrl, {
                method: 'GET',
                signal: controller.signal,
                referrerPolicy: 'no-referrer'
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                log(`Error ${response.status} en servidor.`, 'warn');
                continue; // Salta al siguiente candidato
            }

            const data = await response.json();
            
            // Validación: ¿Recibimos datos reales o un error camuflado?
            let finalData = data;
            if (data.contents) {
                // Desempaquetar si viene de AllOrigins
                finalData = JSON.parse(data.contents);
            }

            if (finalData.results || finalData.episodes || finalData.sources) {
                log(`¡Conexión establecida!`, 'success');
                return finalData;
            }

        } catch (error) {
            log(`Fallo intento: ${error.message}`, 'error');
        }
    }

    log("ERROR CRÍTICO: Ninguna API respondió. Intenta más tarde.", 'error');
    return null;
}

// --- INTERFAZ (Sin cambios, solo lógica de visualización) ---
async function init() {
    log("Iniciando sistema (v2.1)...", "info");
    const data = await call("recent-episodes");
    
    if (data && data.results) {
        render(data.results);
    } else {
        document.getElementById('grid').innerHTML = '<div style="text-align:center; padding:20px;">Servidores ocupados o en mantenimiento.</div>';
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
        // Proxy de imágenes de Weserv para evitar roturas
        const imgUrl = `https://images.weserv.nl/?url=${encodeURIComponent(a.image)}`;
        
        c.innerHTML = `
            <img src="${imgUrl}" loading="lazy" onerror="this.src='https://via.placeholder.com/140x200?text=Sin+Imagen'">
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
    log(`Obteniendo video...`, 'info');
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
            b.onclick = () => window.location.href = s.url;
            cont.appendChild(b);
        });
        log("¡Enlaces listos!", 'success');
    } else {
        cont.innerHTML = 'No se encontraron enlaces.';
        log("Sin enlaces disponibles.", 'error');
    }
}

function cerrarModal() { 
    document.getElementById('modal').style.display = 'none'; 
}

window.onerror = (msg) => log(`JS Error: ${msg}`, 'error');
window.onload = init;