// ... (imports anteriores)
import { AnimeDetail } from './components/AnimeDetail';

const App: React.FC = () => {
  const [animes, setAnimes] = useState<AnimeData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // NUEVO: Estado para el anime seleccionado
  const [selectedAnime, setSelectedAnime] = useState<AnimeData | null>(null);

  // ... (useEffect y funciones handleSearch/handleFilter se mantienen igual)

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 font-sans">
      <Navbar onSearch={handleSearch} onFilter={handleFilter} />

      <main className="max-w-7xl mx-auto p-6">
        {/* ... (título y loader) */}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {animes.map((anime) => (
            <div 
              key={anime.id || anime.title} 
              onClick={() => setSelectedAnime(anime)} // Seleccionar al hacer clic
              className="cursor-pointer"
            >
              <AnimeCard data={anime} />
            </div>
          ))}
        </div>
      </main>

      {/* MOSTRAR DETALLE SI HAY SELECCIÓN */}
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