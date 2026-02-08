// ==========================================
// SUPER CONSOLA DE DIAGNÓSTICO v2.0
// ==========================================

// 1. Crear el contenedor de la consola flotante
const consoleContainer = document.createElement('div');
consoleContainer.id = 'debug-console-container';
consoleContainer.style.cssText = `
    position: fixed; bottom: 0; left: 0; width: 100%; height: 250px;
    background: rgba(0, 0, 0, 0.95); color: #0f0; font-family: monospace; font-size: 11px;
    z-index: 99999; border-top: 2px solid #ff4500; display: flex; flex-direction: column;
    transition: height 0.3s ease; box-shadow: 0 -4px 10px rgba(0,0,0,0.5);
`;

// 2. Crear la barra de herramientas (Botones)
const toolbar = document.createElement('div');
toolbar.style.cssText = `
    background: #222; padding: 5px 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444;
`;

// Título de estado
const statusTitle = document.createElement('span');
statusTitle.innerHTML = '🔧 <b>DIAGNÓSTICO</b>';
statusTitle.style.color = '#ff4500';

// Contenedor de botones
const btnGroup = document.createElement('div');
btnGroup.style.display = 'flex';
btnGroup.style.gap = '10px';

// Botón Copiar
const btnCopy = document.createElement('button');
btnCopy.innerText = '📋 COPIAR LOG';
btnCopy.onclick = copiarLog;
estilarBoton(btnCopy, '#00d4ff');

// Botón Minimizar
const btnMin = document.createElement('button');
btnMin.innerText = '🔽';
btnMin.onclick = toggleConsole;
estilarBoton(btnMin, '#fff');

// Botón Limpiar
const btnClear = document.createElement('button');
btnClear.innerText = '🗑️';
btnClear.onclick = () => { logsDiv.innerHTML = ''; log('Consola limpiada.', 'warn'); };
estilarBoton(btnClear, '#ff5555');

// 3. Crear el área de texto
const logsDiv = document.createElement('div');
logsDiv.id = 'debug-logs';
logsDiv.style.cssText = `
    flex: 1; overflow-y: auto; padding: 10px; white-space: pre-wrap; word-break: break-all;
`;

// Armar todo
btnGroup.append(btnCopy, btnClear, btnMin);
toolbar.append(statusTitle, btnGroup);
consoleContainer.append(toolbar, logsDiv);
document.body.appendChild(consoleContainer);

// Funciones de la consola
function estilarBoton(btn, color) {
    btn.style.cssText = `
        background: #333; color: ${color}; border: 1px solid ${color}; 
        padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 10px;
    `;
}

function toggleConsole() {
    if (consoleContainer.style.height === '35px') {
        consoleContainer.style.height = '250px';
        btnMin.innerText = '🔽';
        logsDiv.style.display = 'block';
    } else {
        consoleContainer.style.height = '35px';
        btnMin.innerText = '🔼';
        logsDiv.style.display = 'none';
    }
}

function copiarLog() {
    const texto = logsDiv.innerText;
    navigator.clipboard.writeText(texto).then(() => {
        alert("¡Log copiado! Ahora pégalo en el chat.");
    }).catch(err => {
        // Fallback para celulares viejos
        const textArea = document.createElement("textarea");
        textArea.value = texto;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("Copy");
        textArea.remove();
        alert("¡Log copiado (modo compatibilidad)!");
    });
}

function log(msg, type = 'info') {
    const p = document.createElement('div');
    p.style.marginBottom = "4px";
    p.style.borderBottom = "1px solid #222";
    p.style.paddingBottom = "2px";
    
    const time = new Date().toLocaleTimeString();
    let icon = '🔹';
    
    if (type === 'error') { p.style.color = '#ff5555'; p.style.fontWeight = 'bold'; icon = '❌'; }
    else if (type === 'success') { p.style.color = '#55ff55'; p.style.fontWeight = 'bold'; icon = '✅'; }
    else if (type === 'warn') { p.style.color = '#ffff55'; icon = '⚠️'; }

    p.innerHTML = `<span style="opacity:0.6">[${time}]</span> ${icon} ${msg}`;
    logsDiv.appendChild(p);
    logsDiv.scrollTop = logsDiv.scrollHeight;
    
    // Actualizar título si hay error
    if(type === 'error') statusTitle.innerText = '🚨 ERROR DETECTADO';
}

// ==========================================
// LÓGICA DE CONEXIÓN MULTI-SERVIDOR
// ==========================================

// Lista ampliada de servidores
const API_SERVERS = [
    "https://animetize-api.vercel.app/anime/animeflv",  // Opción 1 (Más rápida)
    "https://consumet-api-clone.vercel.app/anime/animeflv", // Opción 2
    "https://api.consumet.org/anime/animeflv", // Opción 3 (Oficial)
    "https://consumet-jade.vercel.app/anime/animeflv" // Opción 4
];

// Lista de proxies
const PROXIES = [
    (url) => url, // Intento directo primero
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
];

async function fetchData(endpoint) {
    log(`Buscando: ${endpoint}...`, 'warn');

    for (const server of API_SERVERS) {
        for (const proxyWrap of PROXIES) {
            const targetUrl = `${server}/${endpoint}`;
            const finalUrl = proxyWrap(targetUrl);
            
            try {
                // log(`Probando: ${new URL(server).hostname}`, 'info'); 
                // Comentado para no llenar la consola, solo errores importantes

                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), 5000); // 5 seg timeout

                const resp = await fetch(finalUrl, { 
                    signal: controller.signal,
                    referrerPolicy: 'no-referrer' 
                });
                clearTimeout(id);

                if (!resp.ok) continue;

                const text = await resp.text();
                let data;

                try {
                    data = JSON.parse(text);
                    if (data.contents) data = JSON.parse(data.contents); // Desempaquetar AllOrigins
                } catch (e) {
                    continue; // No es JSON
                }

                if (data.results || data.episodes || data.sources) {
                    log(`¡Conectado a ${new URL(server).hostname}!`, 'success');
                    return data;
                }

            } catch (e) {
                // Silencio errores de red para no asustar, solo logueamos si TODO falla
            }
        }
    }

    log("FATAL: No se pudo conectar a NINGÚN servidor.", 'error');
    log("Copia este log y envíalo para analizar.", 'error');
    document.getElementById('animeGrid').innerHTML = '<div style="padding:20px; text-align:center;">⚠️ Error de conexión global.</div>';
    return null;
}

// ==========================================
// INTERFAZ DE USUARIO
// ==========================================

window.onload = () => {
    log("Iniciando App v7.0...");
    cargarInicio();
};

async function cargarInicio() {
    const grid = document.getElementById('animeGrid');
    if(grid) grid.innerHTML = '<div class="loader">Cargando estrenos...</div>';
    
    const data = await fetchData("recent-episodes");
    if (data && data.results) renderGrid(data.results);
}

async function buscarAnime() {
    const inp = document.getElementById('searchInput');
    if (!inp || !inp.value.trim()) return;
    
    const grid = document.getElementById('animeGrid');
    grid.innerHTML = '<div class="loader">Buscando...</div>';
    
    const data = await fetchData(inp.value.trim());
    if (data && data.results) renderGrid(data.results);
}

function renderGrid(list) {
    const grid = document.getElementById('animeGrid');
    grid.innerHTML = '';
    
    list.forEach(anime => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        const img = `https://images.weserv.nl/?url=${encodeURIComponent(anime.image)}`;
        
        card.innerHTML = `
            <img src="${img}" loading="lazy" onerror="this.src='https://via.placeholder.com/150'">
            <div class="info">${anime.title}</div>
        `;
        card.onclick = () => abrirDetalles(anime.id, anime.title);
        grid.appendChild(card);
    });
}

// Lógica de Modal simplificada para no alargar
async function abrirDetalles(id, title) {
    const modal = document.getElementById('animeModal');
    if(!modal) return;
    modal.style.display = 'flex';
    document.getElementById('modalTitle').innerText = title;
    
    const list = document.getElementById('modalEpisodes');
    list.innerHTML = 'Cargando...';
    
    const data = await fetchData(`info?id=${id}`);
    if (data && data.episodes) {
        list.innerHTML = '';
        data.episodes.reverse().forEach(ep => {
            const btn = document.createElement('div');
            btn.className = 'ep-btn';
            btn.innerText = ep.number;
            btn.onclick = () => cargarVideo(ep.id);
            list.appendChild(btn);
        });
    }
}

async function cargarVideo(epId) {
    const linksDiv = document.getElementById('modalLinks');
    linksDiv.innerHTML = 'Buscando video...';
    log(`Buscando video para ${epId}...`, 'info');
    
    const data = await fetchData(`watch?episodeId=${epId}`);
    linksDiv.innerHTML = '';
    
    if (data && data.sources) {
        data.sources.forEach(src => {
            const btn = document.createElement('a');
            btn.className = 'link-btn';
            btn.innerText = `▶ ${src.quality}`;
            btn.href = src.url;
            linksDiv.appendChild(btn);
        });
        log("Video encontrado.", 'success');
    } else {
        linksDiv.innerHTML = 'No hay video disponible.';
        log("No se encontraron links de video.", 'error');
    }
}

function cerrarModal() {
    const modal = document.getElementById('animeModal');
    if(modal) modal.style.display = 'none';
}