import React from 'react';
import { AnimeData } from '../types';

interface AnimeCardProps {
  data: AnimeData;
}

export const AnimeCard: React.FC<AnimeCardProps> = ({ data }) => {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-[#1a1a1a]/60 backdrop-blur-xl border border-white/10 shadow-lg hover:shadow-cyan-500/30 hover:border-cyan-500/50 transition-all duration-300 cursor-pointer">
      
      {/* Contenedor de la Imagen */}
      <div className="relative aspect-[3/4] overflow-hidden">
        <img 
          src={data.image} 
          alt={data.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Degradado oscuro en la parte inferior para que el texto sea legible */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300"></div>
        
        {/* Etiqueta del tipo (Anime, Película, OVA) con toque Cyberpunk */}
        <div className="absolute top-3 right-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded-md text-[10px] font-bold tracking-widest text-cyan-400 border border-cyan-500/30 uppercase shadow-[0_0_10px_rgba(34,211,238,0.2)]">
          {data.type || 'Anime'}
        </div>
      </div>

      {/* Contenido (Título y botón) */}
      <div className="absolute bottom-0 w-full p-4 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
        <h3 className="text-white font-semibold text-sm md:text-base line-clamp-2 leading-tight drop-shadow-md">
          {data.title}
        </h3>
        
        {/* Elemento que aparece al hacer hover */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 mt-3 flex items-center gap-2">
          <span className="text-xs text-gray-300 uppercase tracking-wider font-semibold">Ver ahora</span>
          <svg className="w-4 h-4 text-cyan-500 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
          </svg>
        </div>
      </div>
      
    </div>
  );
};