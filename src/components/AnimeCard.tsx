import Link from "next/link";
import { PlayCircle } from "lucide-react";

interface AnimeProps {
  id: string;
  title: string;
  image: string;
  type: string;
  episode?: string;
}

export default function AnimeCard({ anime }: { anime: AnimeProps }) {
  return (
    <Link 
      href={`/anime/${anime.id}`} 
      className="group relative block w-full aspect-[3/4] rounded-2xl overflow-hidden glass-panel hover:border-accent/50 hover:shadow-neon transition-all duration-300 transform hover:-translate-y-2"
    >
      {/* Etiqueta de tipo/episodio */}
      <div className="absolute top-3 left-3 z-20 bg-accent/90 text-white text-xs font-black px-3 py-1 rounded-full backdrop-blur-md shadow-lg">
        {anime.episode ? `Episodio ${anime.episode}` : anime.type}
      </div>

      {/* Imagen de fondo (usamos la etiqueta img normal para links externos) */}
      <img
        src={anime.image}
        alt={anime.title}
        className="object-cover w-full h-full opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"
        loading="lazy"
      />
      
      {/* Overlay oscuro difuminado en la parte inferior para que resalte el texto */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent z-10" />

      {/* Botón de play central (oculto hasta hacer hover) */}
      <div className="absolute inset-0 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <PlayCircle size={64} className="text-white drop-shadow-[0_0_15px_rgba(229,54,55,0.8)]" strokeWidth={1.5} />
      </div>

      {/* Título del Anime */}
      <div className="absolute bottom-0 w-full p-4 z-20">
        <h3 className="text-white font-bold text-[15px] leading-tight line-clamp-2 group-hover:text-accent transition-colors">
          {anime.title}
        </h3>
      </div>
    </Link>
  );
}