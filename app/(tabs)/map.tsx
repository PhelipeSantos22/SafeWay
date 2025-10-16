import useLocationServices from "@/utils/useLocationService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import type { FeatureCollection, Polygon as GeoPolygon } from "geojson";
import { LocateFixed, Settings2 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
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
  const [notificationLevel, setNotificationLevel] = useState<string>("moderate");
  const servicesEnabled = useLocationServices();
  const navigation = useNavigation<any>();

  const lastNotifiedLevel = useRef<string | null>(null);

  // define cor por número de ocorrências
  const getColor = (oc: number) => {
    if (oc > 1500) return "rgba(75, 0, 0, 0.5)";
    else if (oc >= 1000) return "rgba(128, 0, 0, 0.5)";
    else if (oc >= 500) return "rgba(226, 88, 34, 0.5)";
    else if (oc >= 250) return "rgba(255, 140, 0, 0.5)";
    else if (oc >= 50) return "rgba(255, 215, 0, 0.5)";
    else return "transparent";
  };

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

  // ✅ respeita o "none" e ajusta thresholds coerentes
  const shouldNotify = (userLevel: string, areaLevel: string) => {
    if (userLevel === "none") return false;

    const hierarchy = ["muito baixo", "baixo", "moderado", "alto", "muito alto"];
    const thresholds: Record<string, number> = {
      "very-low": 0,        // notifica qualquer risco
      low: 2,               // de moderado pra cima
      moderate: 3,          // de alto pra cima
      high: 4,              // só muito alto
      "very-high": 5,       // nunca (exagero de segurança)
    };

    const idxArea = hierarchy.indexOf(areaLevel);
    const idxMin = thresholds[userLevel] ?? Infinity;
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
    for (const feature of gridData.features) {
      const ocorrencias = feature.properties?.ocorrencias || 0;
      const color = getColor(ocorrencias);
      const level = getLevel(color);

      if (!shouldNotify(notificationLevel, level)) continue;

      const polygonCoords = (feature.geometry as GeoPolygon).coordinates[0].map(
        (c: number[]) => ({ latitude: c[1], longitude: c[0] })
      );

      if (isPointInPolygon(coords, polygonCoords)) {
        if (lastNotifiedLevel.current !== level) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Área de risco detectada",
              body: `Você entrou em uma área de risco (${level}).`,
            },
            trigger: null,
          });
          lastNotifiedLevel.current = level;
        }
        break;
      }
    }
  };

  const getLocation = async () => {
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

  useEffect(() => {
    getLocation();
    (async () => {
      const saved = await AsyncStorage.getItem("notificationLevel");
      if (saved) setNotificationLevel(saved);
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") console.log("Permissão de notificação negada");
    })();
  }, []);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      sub = await Location.watchPositionAsync(
        { accuracy: Location.LocationAccuracy.High, timeInterval: 5000, distanceInterval: 5 },
        (loc) => {
          setLocation(loc.coords);
          checkRiskArea(loc.coords);
        }
      );
    })();
    return () => {
      if (sub) sub.remove();
    };
  }, [notificationLevel]);

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
