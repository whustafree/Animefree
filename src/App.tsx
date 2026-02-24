import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { AnimeCard } from './components/AnimeCard';
import { AnimeDetail } from './components/AnimeDetail';
import { AnimeData } from './types'; 

const App: React.FC = () => {
  // Estados principales
  const [animes, setAnimes] = useState<AnimeData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedAnime, setSelectedAnime] = useState<AnimeData | null>(null);
  
  // Paginación y control de rutas
  const [page, setPage] = useState<number>(1);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [currentUrl, setCurrentUrl] = useState<string>('/api/on-air');

  // Función unificada para pedir datos (tanto carga inicial como "cargar más")
  const fetchAnimes = async (url: string, resetList = true) => {
    if (resetList) {
      setLoading(true);
      setPage(1); // Reiniciamos la página si es una nueva búsqueda
      setCurrentUrl(url); // Guardamos la URL base para el botón "Cargar más"
    } else {
      setIsLoadingMore(true);
    }

    try {
      const response = await fetch(url);
      const data = await response.json();
      
      // La API podría devolver un arreglo directo o un objeto con un array dentro.
      const newAnimes = Array.isArray(data) ? data : data.results || [];
      
      if (resetList) {
        setAnimes(newAnimes);
      } else {
        setAnimes(prev => [...prev, ...newAnimes]); // Anexamos al final
      }
    } catch (error) {
      console.error("Error interconectando con el servidor:", error);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  // 1. Carga inicial
  useEffect(() => {
    fetchAnimes('/api/on-air');
  }, []);

  // 2. Acciones del Navbar
  const handleSearch = (query: string) => {
    if (query.trim()) {
      fetchAnimes(`/api/search/${encodeURIComponent(query)}`);
    } else {
      fetchAnimes('/api/on-air'); // Vuelve al inicio si vacía el buscador
    }
  };

  const handleFilter = (type: string) => {
    fetchAnimes(`/api/filter?type=${type}`);
  };

  // 3. Acción de Paginación
  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    
    // Evaluamos si la URL ya tiene parámetros (ej: /api/filter?type=movie)
    // para saber si concatenamos con "?" o "&"
    const separator = currentUrl.includes('?') ? '&' : '?';
    fetchAnimes(`${currentUrl}${separator}page=${nextPage}`, false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 font-sans selection:bg-cyan-500 selection:text-black pb-12">
      {/* BARRA SUPERIOR */}
      <Navbar onSearch={handleSearch} onFilter={handleFilter} />

      <main className="max-w-7xl mx-auto p-6 mt-6">
        
        {/* ENCABEZADO DE SECCIÓN */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-2 h-8 bg-cyan-500 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>
          <h2 className="text-3xl font-bold text-white tracking-tight">
            Explorar Sistema
          </h2>
        </div>

        {/* CONTENIDO (LOADER O GRILLA) */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-cyan-500 rounded-full border-t-transparent animate-spin shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {animes.length > 0 ? (
                animes.map((anime) => (
                  <div 
                    key={anime.id || anime.title} 
                    onClick={() => setSelectedAnime(anime)}
                  >
                    <AnimeCard data={anime} />
                  </div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center flex flex-col items-center justify-center text-gray-500">
                  <span className="text-6xl mb-4 opacity-20">👾</span>
                  <p className="text-xl">No se encontraron resultados en los registros.</p>
                </div>
              )}
            </div>

            {/* BOTÓN CARGAR MÁS */}
            {animes.length > 0 && !loading && (
              <div className="flex justify-center mt-16">
                <button 
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="group relative px-10 py-3 bg-black border border-cyan-500/50 text-cyan-400 font-bold tracking-widest uppercase rounded-xl hover:bg-cyan-500 hover:text-black transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden shadow-[0_0_15px_rgba(34,211,238,0.15)] hover:shadow-[0_0_25px_rgba(34,211,238,0.4)]"
                >
                  <div className="absolute inset-0 w-full h-full bg-cyan-400/20 transform -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
                  <span className="relative z-10">
                    {isLoadingMore ? 'Procesando...' : 'Cargar Más'}
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL / REPRODUCTOR (Pop-up) */}
      {selectedAnime && (
        <AnimeDetail 
          anime={selectedAnime} 
          onClose={() => setSelectedAnime(null)} 
        />
      )}
    </div>
  );
};

export default App;