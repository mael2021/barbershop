import { useState } from "react";
import { Footer, Hero, ServiceSection, SupportiveCTA, BookingForm, InfoSection } from "@/components";

export const HomePage = () => {
  const [isBookingOpen, setIsBookingOpen] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<string>("");

  const handleBookingClick = () => {
    setSelectedService("");
    setIsBookingOpen(true);
  };

  const handleBookService = (service: string) => {
    setSelectedService(service);
    setIsBookingOpen(true);
  };

  const handleCloseBooking = () => {
    setIsBookingOpen(false);
    setSelectedService("");
  };

  return (
    <div className="bg-gradient-to-br from-graffiti-dark via-graffiti-gray to-black px-4">
      <Hero onBookingClick={handleBookingClick} />
      <ServiceSection onBookService={handleBookService} />
      <SupportiveCTA />
      <InfoSection />
      <Footer />
      <BookingForm
        isOpen={isBookingOpen}
        onClose={handleCloseBooking}
        preSelectedService={selectedService}
      />
    </div>
  );
};
