import * as Location from "expo-location";
import { useEffect, useState } from "react";

export default function useLocationServices() {
  const [servicesEnabled, setServicesEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let intervalId;

    const checkServices = async () => {
      try {
        const enabled = await Location.hasServicesEnabledAsync();
        setServicesEnabled(enabled);
      } catch (err) {
        console.log("Erro ao verificar serviços de localização:", err);
      }
    };

    // Checa imediatamente e depois a cada 2 segundos
    checkServices();
    intervalId = setInterval(checkServices, 2000);

    return () => clearInterval(intervalId);
  }, []);

  return servicesEnabled;
}
