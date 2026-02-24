import React, { useEffect, useState } from 'react';
import { AnimeData } from '../types';

interface AnimeDetailProps {
  anime: AnimeData;
  onClose: () => void;
}

export const AnimeDetail: React.FC<AnimeDetailProps> = ({ anime, onClose }) => {
  const [info, setInfo] = useState<any>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        // Llamada a tu API para obtener episodios y servidores
        const response = await fetch(`/api/anime/${anime.id}`);
        const data = await response.json();
        setInfo(data);
      } catch (error) {
        console.error("Error obteniendo episodios:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [anime.id]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-[#0a0a0a] border border-cyan-500/20 rounded-3xl overflow-hidden shadow-2xl my-auto">
        
        <button onClick={onClose} className="absolute top-6 right-6 z-[110] text-white/50 hover:text-cyan-400 text-2xl transition-colors">✕</button>

        <div className="flex flex-col lg:flex-row h-full max-h-[90vh]">
          
          {/* SECCIÓN IZQUIERDA: REPRODUCTOR O POSTER */}
          <div className="w-full lg:w-2/3 bg-black flex items-center justify-center border-r border-white/5">
            {selectedVideo ? (
              <div className="relative w-full h-full aspect-video">
                <iframe 
                  src={selectedVideo} 
                  className="w-full h-full border-0" 
                  allowFullScreen 
                  title="Reproductor"
                />
              </div>
            ) : (
              <img src={anime.image} className="h-full w-full object-cover opacity-40 blur-sm absolute" alt="" />
            )}
            {!selectedVideo && (
              <div className="relative z-10 text-center p-10">
                <img src={anime.image} className="w-48 rounded-xl shadow-2xl mx-auto mb-4 border-2 border-cyan-500/50" alt={anime.title} />
                <h2 className="text-2xl font-bold uppercase tracking-widest text-cyan-400">{anime.title}</h2>
                <p className="text-gray-400 mt-2 italic">Selecciona un episodio para comenzar</p>
              </div>
            )}
          </div>

          {/* SECCIÓN DERECHA: LISTA DE EPISODIOS (Estilo Apple List) */}
          <div className="w-full lg:w-1/3 flex flex-col bg-[#0f0f0f]">
            <div className="p-6 border-b border-white/5">
              <h3 className="text-sm font-black text-cyan-500 uppercase tracking-tighter">Episodios Disponibles</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {loading ? (
                <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500"></div></div>
              ) : info?.episodes?.length > 0 ? (
                <div className="grid gap-2">
                  {info.episodes.map((ep: any) => (
                    <button 
                      key={ep.id}
                      onClick={() => setSelectedVideo(ep.videoUrl)} // Aquí deberías manejar la lógica de servidores
                      className="flex items-center justify-between p-4 bg-white/5 hover:bg-cyan-500 hover:text-black rounded-2xl transition-all group text-left"
                    >
                      <span className="font-bold">Episodio {ep.number}</span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">▶</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-600 mt-10">No hay episodios listados aún.</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};