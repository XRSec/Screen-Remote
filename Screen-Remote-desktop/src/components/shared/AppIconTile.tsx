import React from 'react';

export interface AppIconTileProps {
  icon: React.ReactNode;
  size?: number;
  className?: string;
  onClick?: () => void;
  active?: boolean;
}

export const AppIconTile: React.FC<AppIconTileProps> = ({ 
  icon, 
  size = 42, 
  className = '', 
  onClick,
  active = false
}) => {
  return (
    <div 
      onClick={onClick}
      style={{ width: size, height: size }}
      className={`
        flex items-center justify-center
        rounded-xl transition-all duration-150
        ${active ? 'bg-blue-500 text-white shadow-md' : 'bg-[#2e2e32] text-[#8e8e93] hover:bg-white/10 hover:text-white'}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {icon}
    </div>
  );
};
