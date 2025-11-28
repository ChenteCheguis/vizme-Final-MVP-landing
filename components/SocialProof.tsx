import React from 'react';
import { Activity, Anchor, Box, CircleDollarSign, Command, Hexagon } from 'lucide-react';

const SocialProof: React.FC = () => {
  return (
    <section className="border-y border-slate-800 bg-slate-950/50 py-10">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-center text-xs font-medium text-slate-500 mb-8 uppercase tracking-widest">
          Empresas que ya toman decisiones con datos
        </p>
        <div className="flex flex-wrap justify-center items-center gap-10 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
          {/* Mock Logos using Lucide Icons with text */}
          <div className="flex items-center gap-2 group">
            <Hexagon className="h-6 w-6 text-slate-300 group-hover:text-white" />
            <span className="font-bold text-lg text-slate-300 group-hover:text-white">Acme Corp</span>
          </div>
          <div className="flex items-center gap-2 group">
            <Command className="h-6 w-6 text-slate-300 group-hover:text-white" />
            <span className="font-bold text-lg text-slate-300 group-hover:text-white">StarkInd</span>
          </div>
          <div className="flex items-center gap-2 group">
            <Activity className="h-6 w-6 text-slate-300 group-hover:text-white" />
            <span className="font-bold text-lg text-slate-300 group-hover:text-white">PulseMedia</span>
          </div>
          <div className="flex items-center gap-2 group">
            <Box className="h-6 w-6 text-slate-300 group-hover:text-white" />
            <span className="font-bold text-lg text-slate-300 group-hover:text-white">BlockChain</span>
          </div>
           <div className="flex items-center gap-2 group">
            <CircleDollarSign className="h-6 w-6 text-slate-300 group-hover:text-white" />
            <span className="font-bold text-lg text-slate-300 group-hover:text-white">Ventus</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialProof;