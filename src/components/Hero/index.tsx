import { Calendar, Scissors } from "lucide-react";

export const Hero = ({ onBookingClick }: { onBookingClick: () => void }) => {
  return (
    <section className="relative grid min-h-screen place-content-center items-center overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-10 h-32 w-32 rounded-full bg-electric-blue blur-3xl"></div>
        <div className="absolute right-10 bottom-20 h-40 w-40 rounded-full bg-hot-pink blur-3xl"></div>
        <div className="absolute top-1/2 left-1/3 h-24 w-24 rounded-full bg-neon-green blur-2xl"></div>
      </div>

      <div className="z-10 flex flex-col items-center justify-center gap-8 text-center pb-16">
        <div className="animate-fade-in flex flex-col justify-center gap-4">
          <h1 className="font-anton leading-7 uppercase">
            <span className="graffiti-shadow animate-gradient-shift bg-gradient-to-r from-electric-blue via-neon-green to-hot-pink bg-size-[400%_400%] bg-clip-text text-8xl text-transparent">
              Master
            </span>
            <span className="graffiti-shadow mt-1 block text-6xl text-white">Cuts</span>
          </h1>
        </div>
        <div className="flex items-center justify-center gap-4">
          <div className="h-8 w-1 bg-gradient-to-b from-electric-blue to-transparent"></div>
          <Scissors className="animate-glow h-8 w-8 text-electric-blue" />
          <div className="h-8 w-1 bg-gradient-to-b from-neon-green to-transparent"></div>
        </div>
        <button
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-gradient-to-r from-urban-purple to-spray-orange px-8 py-4 text-center text-sm font-bold tracking-wide text-nowrap text-white uppercase transition-all duration-300 hover:scale-110 hover:from-spray-orange hover:to-urban-purple"
          onClick={onBookingClick}
        >
          <Calendar className="h-5 w-5" />
          Reservar ahora
        </button>

        <p className="font-mono text-sm tracking-wider text-gray-400">🔥 CORTES • ESTILO • BARBERÍA 🔥</p>
      </div>
    </section>
  );
};
