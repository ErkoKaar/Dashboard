import { useQuery } from "@tanstack/react-query";

const TALLINN = { latitude: 59.437, longitude: 24.7536 };

export interface WeatherData {
  temperature: number;
  description: string;
}

const WEATHER_CODE_DESCRIPTIONS: Record<number, string> = {
  0: "Selge taevas",
  1: "Enamasti selge",
  2: "Vahelduv pilvisus",
  3: "Pilves",
  45: "Udu",
  48: "Härmatav udu",
  51: "Nõrk uduvihm",
  53: "Uduvihm",
  55: "Tugev uduvihm",
  61: "Nõrk vihm",
  63: "Vihm",
  65: "Tugev vihm",
  71: "Nõrk lumesadu",
  73: "Lumesadu",
  75: "Tugev lumesadu",
  80: "Hoovihm",
  81: "Tugev hoovihm",
  82: "Väga tugev hoovihm",
  95: "Äike",
  96: "Äike rahega",
  99: "Tugev äike rahega",
};

export function useWeather() {
  return useQuery({
    queryKey: ["weather-tallinn"],
    queryFn: async (): Promise<WeatherData> => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${TALLINN.latitude}&longitude=${TALLINN.longitude}&current=temperature_2m,weather_code&timezone=Europe/Tallinn`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Ilma laadimine ebaõnnestus");

      const json = await res.json();
      const code: number = json.current.weather_code;

      return {
        temperature: json.current.temperature_2m,
        description: WEATHER_CODE_DESCRIPTIONS[code] ?? "Teadmata",
      };
    },
  });
}
