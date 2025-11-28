import React from 'react';

interface LogoProps {
  className?: string;
}

const VizmeLogo: React.FC<LogoProps> = ({ className = "h-8 w-8" }) => {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="50" cy="50" r="50" fill="white"/>
      <path d="M25 50L45 70L75 30" stroke="#F54A43" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

export default VizmeLogo;