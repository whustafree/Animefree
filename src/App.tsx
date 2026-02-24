import React, { useEffect, useState } from 'react';
import { AnimeCard } from './components/AnimeCard';
import { Navbar } from './components/Navbar';
import { AnimeData } from './types';

const App: React.FC = () => {
  const [animes, setAnimes] = useState<AnimeData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAnimes = async (url: string) => {
    setLoading(true);
    try {
      const response = await fetch(url);
      const data = await response.json();
      // Si la API devuelve un objeto con resultados (como en tu backend), extraemos el array
      setAnimes(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Carga inicial
  useEffect(() => {
    fetchAnimes('/api/on-air');
  }, []);

  const handleSearch = (query: string) => {
    if (query.trim()) {
      fetchAnimes(`/api/search/${encodeURIComponent(query)}`);
    }
  };

  const handleFilter = (type: string) => {
    // Aquí puedes usar tu lógica de filtros de la API
    fetchAnimes(`/api/filter?type=${type}`);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 font-sans">
      <Navbar onSearch={handleSearch} onFilter={handleFilter} />

      <main className="max-w-7xl mx-auto p-6">
        <h2 className="text-xl font-semibold mb-6 text-white border-l-4 border-cyan-500 pl-3">
          Explorar Contenido
        </h2>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-cyan-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {animes.length > 0 ? (
              animes.map((anime) => (
                <AnimeCard key={anime.id || anime.title} data={anime} />
              ))
            ) : (
              <p className="col-span-full text-center text-gray-500">No se encontraron resultados.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;