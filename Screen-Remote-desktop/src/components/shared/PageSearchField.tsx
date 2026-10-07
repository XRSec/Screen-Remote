import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

export interface PageSearchFieldProps {
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export const PageSearchField: React.FC<PageSearchFieldProps> = ({
  placeholder = 'Search',
  value,
  onChange,
  className = ''
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div 
      className={`
        relative flex items-center bg-[#2e2e32] border 
        ${isFocused ? 'border-blue-500 shadow-[0_0_0_2px_rgba(10,132,255,0.3)]' : 'border-white/10'} 
        rounded-md px-2 py-1 transition-all duration-150
        ${className}
      `}
    >
      <Search size={14} className="text-[#8e8e93] mr-2" />
      <input 
        type="text"
        className="bg-transparent border-none outline-none text-[12px] text-white w-full placeholder-[#8e8e93]"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {value && (
        <button 
          onClick={() => onChange('')}
          className="ml-2 text-[#8e8e93] hover:text-white bg-black/20 rounded-full p-0.5"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};
