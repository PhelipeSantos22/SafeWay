import useLocationServices from "@/utils/useLocationService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import type { FeatureCollection, Polygon as GeoPolygon } from "geojson";
import { LocateFixed, Settings2 } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Polygon, PROVIDER_GOOGLE } from "react-native-maps";
import rawGridData from "../../assets/data/grid_ocorrencias15km.json";

const gridData = rawGridData as FeatureCollection;

// 🔔 handler global de notificação
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Hierarquia de risco para facilitar a comparação (quanto maior, maior o risco)
const RISK_HIERARCHY: Record<string, number> = {
  "pouco ou nenhum": -1,
  "muito baixo": 0, // very-low
  "baixo": 1, // low
  "moderado": 2, // moderate
  "alto": 3, // high
  "muito alto": 4, // very-high
};

// Mapeamento das configurações do usuário (em inglês) para o índice mínimo de risco (em português)
const USER_THRESHOLDS: Record<string, number> = {
  "none": 5, // Não notifica (índice maior que o máximo 4)
  "very-low": RISK_HIERARCHY["muito baixo"],
  "low": RISK_HIERARCHY["baixo"],
  "moderate": RISK_HIERARCHY["moderado"],
  "high": RISK_HIERARCHY["alto"],
  "very-high": RISK_HIERARCHY["muito alto"],
};

export default function MapScreen() {
  const [region, setRegion] = useState({
    latitude: -23.55052,
    longitude: -46.633308,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  // Padrão 'moderate' como fallback
  const [notificationLevel, setNotificationLevel] = useState<string>("moderate");
  const servicesEnabled = useLocationServices();
  const navigation = useNavigation<any>();

  // Armazena o nível da última área de risco notificada.
  const lastNotifiedLevel = useRef<string | null>(null);
  // Armazena a inscrição do monitoramento de localização.
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // define cor por número de ocorrências
  const getColor = (oc: number) => {
    if (oc > 1500) return "rgba(75, 0, 0, 0.5)"; // Muito Alto
    else if (oc >= 1000) return "rgba(128, 0, 0, 0.5)"; // Alto
    else if (oc >= 500) return "rgba(226, 88, 34, 0.5)"; // Moderado
    else if (oc >= 250) return "rgba(255, 140, 0, 0.5)"; // Baixo
    else if (oc >= 50) return "rgba(255, 215, 0, 0.5)"; // Muito Baixo
    else return "transparent";
  };

  // define nível por cor
  const getLevel = (color: string) => {
    switch (color) {
      case "rgba(75, 0, 0, 0.5)": return "muito alto";
      case "rgba(128, 0, 0, 0.5)": return "alto";
      case "rgba(226, 88, 34, 0.5)": return "moderado";
      case "rgba(255, 140, 0, 0.5)": return "baixo";
      case "rgba(255, 215, 0, 0.5)": return "muito baixo";
      default: return "pouco ou nenhum";
    }
  };

  // ✅ Lógica de notificação CORRIGIDA.
  const shouldNotify = (userLevel: string, areaLevel: string) => {
    if (userLevel === "none") return false;

    const idxArea = RISK_HIERARCHY[areaLevel] ?? -1;
    const idxMin = USER_THRESHOLDS[userLevel] ?? 5; // Fallback para não notificar

    // Notifica se o nível da área for igual ou superior ao nível mínimo configurado pelo usuário.
    return idxArea >= idxMin;
  };

  const isPointInPolygon = (
    point: { latitude: number; longitude: number },
    vs: { latitude: number; longitude: number }[]
  ) => {
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i].longitude, yi = vs[i].latitude;
      const xj = vs[j].longitude, yj = vs[j].latitude;
      const intersect =
        yi > point.latitude !== yj > point.latitude &&
        point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const checkRiskArea = async (coords: { latitude: number; longitude: number }) => {
    let foundNotifiableArea = false;
    let currentAreaLevel: string | null = null;

    for (const [index, feature] of gridData.features.entries()) {
      const ocorrencias = feature.properties?.ocorrencias || 0;
      const color = getColor(ocorrencias);
      const level = getLevel(color);

      // Garante que é um polígono e extrai as coordenadas
      if (feature.geometry?.type !== 'Polygon') continue;
      const polygonCoords = (feature.geometry as GeoPolygon).coordinates[0].map(
        (c: number[]) => ({ latitude: c[1], longitude: c[0] })
      );

      if (isPointInPolygon(coords, polygonCoords)) {
        currentAreaLevel = level;
        
        if (shouldNotify(notificationLevel, level)) {
          foundNotifiableArea = true;

          // Se o usuário entrou em uma área com nível de risco diferente do último notificado, notifica.
          if (lastNotifiedLevel.current !== level) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "🚨 Área de risco detectada",
                body: `Você entrou em uma área de risco (${level}).`,
              },
              trigger: null,
            });
            lastNotifiedLevel.current = level;
          }
        }
        break; // Sai do loop assim que a célula atual é encontrada
      }
    }
    
    // Se não encontrou nenhuma área que exija notificação, limpa o estado
    // para que uma notificação possa ser enviada quando entrar em uma nova área de risco.
    if (!foundNotifiableArea && lastNotifiedLevel.current !== null) {
        lastNotifiedLevel.current = null;
    }
  };

  const getLocation = async () => {
    // ... (restante da função getLocation inalterada)
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setShowDialog(true);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissão negada",
          "Ative a permissão de localização para usar o mapa corretamente."
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (error) {
      console.log("Erro ao obter localização:", error);
    }
  };

  // Carrega permissões iniciais e localização
  useEffect(() => {
    getLocation();
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") console.log("Permissão de notificação negada");
    })();
  }, []);

  // ✅ NOVO: Recarrega o nível de notificação do AsyncStorage toda vez que a tela é focada
  useFocusEffect(
    useCallback(() => {
      const loadNotificationLevel = async () => {
        const saved = await AsyncStorage.getItem("notificationLevel");
        // Atualiza o estado para acionar o useEffect de monitoramento de localização
        if (saved) {
            setNotificationLevel(saved);
        }
      };

      loadNotificationLevel();
    }, [])
  );
  
  // Efeito que monitora a localização. É re-executado quando notificationLevel muda.
  useEffect(() => {
    // Limpa a assinatura anterior
    if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
    }
    
    // Configura a nova assinatura (watchPositionAsync)
    (async () => {
      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.LocationAccuracy.High, timeInterval: 5000, distanceInterval: 5 },
        (loc) => {
          setLocation(loc.coords);
          checkRiskArea(loc.coords);
        }
      );
    })();
    
    // Função de cleanup para remover a assinatura ao desmontar ou re-executar o useEffect
    return () => {
        if (locationSubscription.current) {
            locationSubscription.current.remove();
        }
    };
  }, [notificationLevel]); // Depende do nível de notificação para que a lógica de risco seja atualizada imediatamente

  useEffect(() => {
    setShowDialog(servicesEnabled === false);
  }, [servicesEnabled]);

  const centerOnUser = async () => {
    await getLocation();
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={region}
        showsUserLocation={true}
        showsCompass={true}
        showsMyLocationButton={false}
        mapPadding={{ top: 100, right: 0, bottom: 0, left: 0 }}
      >
        {gridData.features.map((feature, index) => {
          if (feature.geometry?.type !== 'Polygon') return null;
          
          const ocorrencias = feature.properties?.ocorrencias || 0;
          const color = getColor(ocorrencias);
          const coords = (feature.geometry as GeoPolygon).coordinates[0].map((c: number[]) => ({
            latitude: c[1],
            longitude: c[0],
          }));
          return (
            <Polygon
              key={index}
              coordinates={coords}
              tappable={true}
              strokeColor={selectedIndex === index ? "#1f1f1f" : "rgba(0,0,0,0.001)"}
              strokeWidth={0.5}
              fillColor={color}
              onPress={() => {
                setSelectedIndex(index);
                setSelectedLevel(getLevel(color));
              }}
            />
          );
        })}
      </MapView>

      {selectedLevel && (
        <View style={styles.levelBox}>
          <Text style={styles.levelText}>Risco: {selectedLevel}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.locateButton} onPress={centerOnUser}>
        <LocateFixed size={28} color="#d3d3d3ff" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => navigation.navigate("settings")}
      >
        <Settings2 size={28} color="#d3d3d3ff" />
      </TouchableOpacity>

      <Modal transparent={true} visible={showDialog} animationType="fade" onRequestClose={() => setShowDialog(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Localização desativada</Text>
            <Text style={styles.modalText}>
              Ative os serviços de localização para usar o mapa corretamente.
            </Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowDialog(false)}>
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  locateButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#1f1f1f",
    padding: 12,
    borderRadius: 50,
    elevation: 5,
    shadowColor: "#d3d3d3ff",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  settingsButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "#1f1f1f",
    borderRadius: 30,
    padding: 10,
    elevation: 5,
  },
  levelBox: {
    position: "absolute",
    bottom: 20,
    left: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  levelText: {
    color: "#d3d3d3ff",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContainer: {
    width: "80%",
    backgroundColor: "#1f1f1f",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#d3d3d3ff",
  },
  modalText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    color: "#d3d3d3ff",
  },
  modalButton: {
    backgroundColor: "#007bff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalButtonText: {
    color: "#d3d3d3ff",
    fontWeight: "bold",
  },
});