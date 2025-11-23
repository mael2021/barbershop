export const InfoSection = () => {
  return (
    <section className="mx-auto max-w-5xl">
      <h2 className="graffiti-shadow mb-10 text-center font-anton text-4xl font-bold tracking-wide text-white uppercase">
        🎯 Encuéntranos y disfruta de un corte de calidad ✨
      </h2>
      <div className="flex flex-col items-center justify-center gap-y-10 md:flex-row md:gap-x-4">
        <article className="flex flex-col items-center gap-y-2">
          <h3 className="font-graffiti graffiti-shadow mb-2 text-3xl font-bold text-pretty text-electric-blue uppercase">
            📍 Ubicación
          </h3>
          <a
            href="https://maps.app.goo.gl/DP9atTbrUC1md4kT9"
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir en Google Maps"
            className="max-w-sm text-center text-sm text-balance text-gray-300 hover:underline hover:underline-offset-4"
          >
            🏠 1° de Mayo 1, Sexto Barrio Emiliano Zapata,
            <br />
            90150 Panotla, Tlax. 🇲🇽
          </a>
        </article>

        <article className="flex flex-col items-center gap-y-2">
          <h3 className="font-graffiti graffiti-shadow mb-2 text-3xl font-bold text-pretty text-spray-orange uppercase">
            🕒 Horarios
          </h3>
          <p className="text-center text-sm text-gray-300">⏰ Lunes a Jueves y Sábado: 10:00 AM - 8:00 PM</p>
          <p className="text-center text-sm text-gray-300">⏰ Martes: 10:00 AM - 8:00 PM</p>
          <p className="text-center text-sm text-gray-300">⏰ Viernes: 10:00 AM - 8:00 PM</p>
          <p className="text-center text-sm text-gray-300">🔒 Domingo: 11:00 AM - 5:00 PM</p>
        </article>

        <article className="flex flex-col items-center gap-y-2">
          <h3 className="font-graffiti graffiti-shadow mb-2 text-3xl font-bold text-pretty text-neon-green uppercase">
            📞 Contacto
          </h3>
          <a
            href="tel:+522462021022"
            className="text-center text-sm text-gray-300 hover:underline hover:underline-offset-4"
            target="_blank"
            rel="noopener noreferrer"
          >
            📱 +52 246 202 1022
          </a>
        </article>
      </div>
    </section>
  );
};
