export const Footer = () => {
  return (
    <footer className="py-12">
      <div className="flex flex-col gap-y-2 text-center text-sm text-gray-400">
        <span>✂️🔥 Master Cuts Barbería 🔥✂️</span>
        <p>© {new Date().getFullYear()} Bloom - Todos los derechos reservados.</p>
        <p className="text-xs text-gray-500">Desarrollado por IFerretAI</p>
      </div>
    </footer>
  );
};
