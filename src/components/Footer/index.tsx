export const Footer = () => {
  return (
    <footer className="py-12">
      <div className="flex flex-col gap-y-2 text-center text-sm text-gray-400">
        <span>✂️🔥 Master Cuts Barbería 🔥✂️</span>
        <p>© {new Date().getFullYear()} - Todos los derechos reservados.</p>
      </div>
    </footer>
  );
};
