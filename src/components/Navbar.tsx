import React, { useState } from 'react';

interface NavbarProps {
  onSearch: (query: string) => void;
  onFilter: (type: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onSearch, onFilter }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  return (
    <nav className="flex flex-col md:flex-row items-center justify-between p-4 bg-gray-900/50 backdrop-blur-md border-b border-cyan-500/30 sticky top-0 z-50">
      <div className="text-2xl font-bold tracking-tighter text-white cursor-pointer" onClick={() => window.location.reload()}>
        ANIME<span className="text-cyan-400">FREE</span>
      </div>

      <div className="flex gap-4 my-4 md:my-0">
        <button onClick={() => onFilter('anime')} className="hover:text-cyan-400 transition-colors">Animes</button>
        <button onClick={() => onFilter('movie')} className="hover:text-cyan-400 transition-colors">Películas</button>
        <button onClick={() => onFilter('ova')} className="hover:text-cyan-400 transition-colors">OVAs</button>
      </div>

      <form onSubmit={handleSearchSubmit} className="relative w-full md:w-64">
        <input
          type="text"
          placeholder="Buscar anime..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-black/40 border border-gray-700 rounded-full py-1 px-4 focus:outline-none focus:border-cyan-500 text-sm transition-all"
        />
      </form>
    </nav>
  );
};