const API_BASE = "https://animeflv.ahmedrangel.com/api";
const PROXIES = [ 
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`
];

let currentAnimeData = null;
let currentEpisodeIndex = -1;
let searchPage = 1; 
let currentQuery = ""; 
let currentGenre = ""; // Nueva variable para filtrar por género
let hasMoreResults = true; 
let isLoadingMore = false;

window.onload = () => {
    if (window.location.protocol !== 'file:') {
        if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    history.replaceState({ page: 'home' }, ""); 
    cargarEstrenos(); 
    renderHistorial(); 
    renderFavorites();
    renderGeneros();
    
    // Carga inicial del "Directorio" (Lista Gigante)
    cargarMasResultados(true); 
};

async function fetchData(endpoint) {
    for (const wrap of PROXIES) {
        try {
            const resp = await fetch(wrap(API_BASE + endpoint));
            if (!resp.ok) continue;
            const text = await resp.text();
            try {
                let data = JSON.parse(text);
                if (data.contents) data = JSON.parse(data.contents);
                return data.success ? data.data : data;
            } catch (e) { continue; }
        } catch (e) { }
    }
    return null;
}

// Mapeo de géneros para la API
const GENRE_MAP = {
    "Acción": "accion", "Aventuras": "aventuras", "Comedia": "comedia", "Drama": "drama", 
    "Ecchi": "ecchi", "Fantasía": "fantasia", "Romance": "romance", "Shounen": "shounen", 
    "Terror": "terror", "Isekai": "isekai", "Sobrenatural": "sobrenatural", "Escolares": "escolares"
};

function renderGeneros() {
    const container = document.getElementById('genre-list');
    if(!container) return;
    const genres = Object.keys(GENRE_MAP);
    container.innerHTML = genres.map(g => `<button class="genre-chip" onclick="buscarPorGenero('${g}')">${g}</button>`).join('');
}

window.buscarPorGenero = (genero) => {
    currentGenre = GENRE_MAP[genero] || "";
    currentQuery = ""; // Limpiar texto al filtrar por género
    document.getElementById('inp').value = genero;
    searchPage = 1;
    hasMoreResults = true;
    cargarMasResultados(true);
};

async function buscar() {
    const q = document.getElementById('inp').value;
    currentQuery = q;
    currentGenre = ""; // Limpiar género al buscar por texto
    searchPage = 1;
    hasMoreResults = true;
    cargarMasResultados(true);
}

async function cargarMasResultados(limpiar) {
    if (isLoadingMore || !hasMoreResults) return; 
    isLoadingMore = true;
    
    const grid = document.getElementById('grid-search');
    if (limpiar) grid.innerHTML = '<div class="loader"></div>';

    // CONSTRUCCIÓN DE URL: Si hay género usamos browse, si no search
    let endpoint = "";
    if (currentGenre) {
        endpoint = `/browse?genre[]=${currentGenre}&page=${searchPage}&order=added`;
    } else if (currentQuery) {
        endpoint = `/search?query=${encodeURIComponent(currentQuery)}&page=${searchPage}`;
    } else {
        // "Lista Gigante" (Directorio completo por defecto)
        endpoint = `/browse?page=${searchPage}&order=added`;
    }

    const data = await fetchData(endpoint);
    
    if (limpiar) grid.innerHTML = '';
    
    // Ahmed API devuelve resultados en .media para search y directo o .data para browse
    const results = data?.media || data?.animes || data || [];
    
    if (results.length > 0) {
        results.forEach(item => crearTarjeta(item, grid, 'search'));
        searchPage++;
        // La API suele devolver hasNextPage o similar
        hasMoreResults = data.hasNextPage !== false && results.length >= 20;
    } else {
        hasMoreResults = false;
        if(limpiar) grid.innerHTML = '<p>No se encontraron resultados.</p>';
    }
    isLoadingMore = false;
}

// ... (Resto de funciones de tarjetas, detalles y reproducción se mantienen) ...

function crearTarjeta(item, container, ctx) {
    const card = document.createElement('div'); 
    card.className = 'anime-card';
    const meta = ctx === 'latest' ? `Ep ${item.number}` : (item.type || 'Anime');
    card.innerHTML = `<img src="${item.cover}"><div class="info"><span class="title">${item.title}</span><div class="meta">${meta}</div></div>`;
    
    card.onclick = () => {
        let slug = item.animeSlug || item.slug || item.id;
        if (!slug) return;
        slug = slug.replace(/-episodio-\d+$/, '').replace(/-\d+$/, '');
        cargarDetalles(slug);
    };
    container.appendChild(card);
}

// Carga automática al llegar al final
window.onscroll = () => {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
        if(document.getElementById('tab-search').classList.contains('active')) {
            cargarMasResultados(false);
        }
    }
};

// (Mantener funciones: cargarDetalles, playVideo, volverALista, etc. de la versión corregida anterior)