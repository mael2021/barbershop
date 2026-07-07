import confetti from "canvas-confetti";

const brandColors = ["#ff6b35", "#00bfff", "#39ff14", "#9d4edd", "#ff2d95"];

export function celebrateBooking() {
  const fire = (particleRatio: number, opts: confetti.Options) => {
    confetti({
      origin: { y: 0.7 },
      colors: brandColors,
      zIndex: 9999,
      ...opts,
      particleCount: Math.floor(200 * particleRatio),
    });
  };

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
}
