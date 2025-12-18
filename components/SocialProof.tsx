import React from 'react';
import { Activity, Anchor, Box, CircleDollarSign, Command, Hexagon } from 'lucide-react';

const SocialProof: React.FC = () => {
  return (
    <section className="border-y border-vizme-navy/5 bg-white py-12">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-center text-[10px] font-bold text-vizme-greyblue mb-10 uppercase tracking-[0.2em]">
          Empresas que ya operan con claridad
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
          <div className="flex items-center gap-2 group cursor-default">
            <Hexagon className="h-5 w-5 text-vizme-navy group-hover:text-vizme-red" />
            <span className="font-bold text-base text-vizme-navy">InnovaCorp</span>
          </div>
          <div className="flex items-center gap-2 group cursor-default">
            <Command className="h-5 w-5 text-vizme-navy group-hover:text-vizme-red" />
            <span className="font-bold text-base text-vizme-navy">NexusMedia</span>
          </div>
          <div className="flex items-center gap-2 group cursor-default">
            <Activity className="h-5 w-5 text-vizme-navy group-hover:text-vizme-red" />
            <span className="font-bold text-base text-vizme-navy">GrowthStack</span>
          </div>
          <div className="flex items-center gap-2 group cursor-default">
            <Box className="h-5 w-5 text-vizme-navy group-hover:text-vizme-red" />
            <span className="font-bold text-base text-vizme-navy">DataFlow</span>
          </div>
          <div className="flex items-center gap-2 group cursor-default">
            <CircleDollarSign className="h-5 w-5 text-vizme-navy group-hover:text-vizme-red" />
            <span className="font-bold text-base text-vizme-navy">VenturaCapital</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialProof;