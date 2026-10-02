"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  RefreshCw,
  Sun,
  Wind,
  type LucideIcon,
} from "lucide-react";

type WeatherData = {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    weather_code: number;
    is_day: number;
  };
  units: Record<string, string>;
};

type WeatherState = "loading" | "ready" | "error";

function weatherPresentation(code: number, isDay: number): { label: string; Icon: LucideIcon } {
  if (code === 0) return { label: isDay ? "Despejado" : "Cielo despejado", Icon: Sun };
  if (code <= 3) return { label: "Parcialmente nublado", Icon: CloudSun };
  if (code <= 48) return { label: "Niebla", Icon: CloudFog };
  if (code <= 57 || (code >= 80 && code <= 82)) return { label: "Lluvia", Icon: CloudRain };
  if (code >= 95) return { label: "Tormenta", Icon: CloudLightning };
  return { label: "Nublado", Icon: Cloud };
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData>();
  const [state, setState] = useState<WeatherState>("loading");
  const [isExpanded, setIsExpanded] = useState(false);

  async function loadWeather() {
    setState("loading");
    try {
      const response = await fetch("/api/weather");
      if (!response.ok) throw new Error("weather request failed");
      setWeather(await response.json());
      setState("ready");
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    void loadWeather();
  }, []);

  if (state === "loading" && !weather) {
    return <div className="weather-widget weather-widget--loading" aria-label="Cargando el tiempo" />;
  }

  if (state === "error" && !weather) {
    return (
      <button className="weather-widget weather-widget--error" type="button" onClick={loadWeather}>
        <RefreshCw size={16} aria-hidden="true" />
        <span>Tiempo no disponible</span>
      </button>
    );
  }

  if (!weather) return null;

  const { current, units } = weather;
  const { label, Icon } = weatherPresentation(current.weather_code, current.is_day);
  const updatedAt = new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(current.time));

  return (
    <div className={`weather-widget${isExpanded ? " is-expanded" : ""}`}>
      <button
        className="weather-widget-summary"
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((value) => !value)}
      >
        <span className="weather-widget-icon" aria-hidden="true"><Icon size={28} /></span>
        <span className="weather-widget-main">
          <strong>{Math.round(current.temperature_2m)}{units.temperature_2m}</strong>
          <small>{label} · El Hierro</small>
        </span>
        <span className="weather-widget-chevron" aria-hidden="true">{isExpanded ? "−" : "+"}</span>
      </button>
      {isExpanded && (
        <div className="weather-widget-details">
          <div><Wind size={15} aria-hidden="true" /><span>Viento <strong>{Math.round(current.wind_speed_10m)} {units.wind_speed_10m}</strong></span></div>
          <div><Droplets size={15} aria-hidden="true" /><span>Humedad <strong>{current.relative_humidity_2m}{units.relative_humidity_2m}</strong></span></div>
          <p>Sensación de {Math.round(current.apparent_temperature)}{units.apparent_temperature} · actualizado a las {updatedAt}</p>
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Datos meteorológicos: Open-Meteo</a>
        </div>
      )}
    </div>
  );
}
