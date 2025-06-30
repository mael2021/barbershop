type FixedPriceService = {
  isCustomPriced?: false;
  price: number;
};

type CustomPricedService = {
  isCustomPriced: true;
  customPrice?: string;
  price?: never;
};

export type Service = {
  name: string;
  description: string;
  duration: string;
  image?: string;
  onBookNow?: () => void;
} & (FixedPriceService | CustomPricedService);
