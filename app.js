// ==========================================
// MODO FORENSE: DIAGNÓSTICO DE RED
// ==========================================

const consoleDiv = document.createElement('div');
consoleDiv.id = 'debug-console';
consoleDiv.style.cssText = `
    position: fixed; bottom: 0; left: 0; width: 100%; height: 250px;
    background: #000; color: #0f0; font-family: monospace; font-size: 10px;
    overflow-y: scroll; z-index: 9999; border-top: 2px solid #ff4500;
    padding: 10px; box-sizing: border-box; opacity: 0.95;
`;
document.body.appendChild(consoleDiv);

function log(msg, type = 'info') {
    const p = document.createElement('p');
    p.style.margin = "2px 0";
    p.style.borderBottom = "1px solid #333";
    
    const time = new Date().toLocaleTimeString();
    
    if (type === 'error') { p.style.color = '#ff5555'; p.style.fontWeight = 'bold'; }
    else if (type === 'success') { p.style.color = '#55ff55'; p.style.fontWeight = 'bold'; }
    else if (type === 'warn') { p.style.color = '#ffff55'; }
    else { p.style.color = '#00d4ff'; }

    p.innerText = `[${time}] ${msg}`;
    consoleDiv.appendChild(p);
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
    console.log(`[${type}] ${msg}`);
}

// ==========================================
// CONFIGURACIÓN DE APIS Y PROXIES
// ==========================================

// Lista de APIs a probar
const APIS = [
    "https://animetize-api.vercel.app/anime/animeflv",
    "https://consumet-api-clone.vercel.app/anime/animeflv",
    "https://api.consumet.org/anime/animeflv"
];

// Lista de Proxies para envolver la petición
const PROXIES = [
    { name: "Directo (Sin Proxy)", url: (u) => u },
    { name: "AllOrigins", url: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
    { name: "CorsProxy", url: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}` }
];

// ==========================================
// LÓGICA DE CONEXIÓN
// ==========================================

async function fetchData(endpoint) {
    log(`--- INICIANDO BÚSQUEDA: ${endpoint} ---`, 'warn');

    for (const apiBase of APIS) {
        const targetUrl = `${apiBase}/${endpoint}`;
        
        for (const proxy of PROXIES) {
            const finalUrl = proxy.url(targetUrl);
            const host = new URL(apiBase).hostname;
            
            log(`Probando: ${host} | Vía: ${proxy.name}`);
            log(`URL: ${finalUrl.substring(0, 50)}...`, 'info');

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);

                const response = await fetch(finalUrl, {
                    signal: controller.signal,
                    referrerPolicy: "no-referrer"
                });
                
                clearTimeout(timeoutId);

                // 1. Diagnóstico de Estado HTTP
                log(`Status HTTP: ${response.status} ${response.statusText}`);
                
                if (!response.ok) {
                    log(`❌ Falló con status ${response.status}. Saltando...`, 'error');
                    continue;
                }

                // 2. Diagnóstico de Contenido (Texto Crudo)
                const rawText = await response.text();
                const preview = rawText.substring(0, 100).replace(/\n/g, ""); // Ver primeros 100 caracteres
                
                log(`📦 Recibido (Inicio): ${preview}`);

                // 3. Detección de Errores Comunes
                if (rawText.includes("<!DOCTYPE html>") || rawText.includes("<html")) {
                    log(`❌ ERROR: Recibimos HTML en lugar de JSON. (Posible bloqueo de Cloudflare o Error 404/500 disfrazado).`, 'error');
                    continue;
                }

                // 4. Intento de Parseo JSON
                let data;
                try {
                    data = JSON.parse(rawText);
                    
                    // Manejo especial para AllOrigins que a veces envuelve en 'contents'
                    if (data.contents) {
                        log(`ℹ️ Desempaquetando respuesta de AllOrigins...`);
                        data = JSON.parse(data.contents);
                    }
                    
                    log(`✅ JSON Válido. Objetos: ${Object.keys(data).join(", ")}`, 'success');

                } catch (jsonError) {
                    log(`❌ Error de Sintaxis JSON: ${jsonError.message}`, 'error');
                    continue;
                }

                // 5. Verificación final de datos útiles
                if (data.results || data.episodes || data.sources) {
                    log(`🏆 ¡ÉXITO! Datos encontrados.`, 'success');
                    return data;
                } else {
                    log(`⚠️ JSON válido pero sin datos esperados.`, 'warn');
                }

            } catch (networkError) {
                log(`💀 Error de Red/Fetch: ${networkError.message}`, 'error');
            }
            
            log(`-----------------------------------`);
        }
    }

    log(`⛔ FATAL: Se probaron todas las combinaciones y ninguna funcionó.`, 'error');
    document.getElementById('animeGrid').innerHTML = '<div style="padding:20px; text-align:center; color:red;">Revisa la consola abajo para ver el error exacto.</div>';
    return null;
}

// ==========================================
// FUNCIONES DE INTERFAZ (UI)
// ==========================================

window.onload = () => cargarInicio();

async function cargarInicio() {
    const grid = document.getElementById('animeGrid');
    if(grid) grid.innerHTML = '<div class="loader">Iniciando diagnóstico...</div>';
    
    const data = await fetchData("recent-episodes");
    if (data && data.results) renderGrid(data.results);
}

async function buscarAnime() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    const grid = document.getElementById('animeGrid');
    grid.innerHTML = '<div class="loader">Buscando...</div>';
    
    const data = await fetchData(query);
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

// Funciones del Modal y Video (Simplificadas para diagnóstico)
async function abrirDetalles(id, title) {
    const modal = document.getElementById('animeModal');
    modal.style.display = 'flex';
    document.getElementById('modalTitle').innerText = title;
    
    const epList = document.getElementById('modalEpisodes');
    epList.innerHTML = 'Consultando API...';
    
    const data = await fetchData(`info?id=${id}`);
    
    if (data && data.episodes) {
        epList.innerHTML = '';
        data.episodes.reverse().forEach(ep => {
            const btn = document.createElement('div');
            btn.className = 'ep-btn';
            btn.innerText = ep.number;
            btn.onclick = () => cargarLinks(ep.id);
            epList.appendChild(btn);
        });
    }
}

async function cargarLinks(epId) {
    const linksDiv = document.getElementById('modalLinks');
    linksDiv.innerHTML = 'Buscando video...';
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
    } else {
        linksDiv.innerHTML = 'Sin video.';
    }
}

function cerrarModal() {
    document.getElementById('animeModal').style.display = 'none';
}