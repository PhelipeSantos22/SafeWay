import useLocationServices from "@/utils/useLocationService";
import { useNavigation } from '@react-navigation/native';
import * as Location from "expo-location";
import type { FeatureCollection } from "geojson";
import { LocateFixed, Settings2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Polygon } from "react-native-maps";
import rawGridData from "../../assets/data/grid_ocorrencias15km.json";

const gridData = rawGridData as FeatureCollection;

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
  const servicesEnabled = useLocationServices();
  const navigation = useNavigation<any>();

  const getLocation = async () => {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setShowDialog(true);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão negada", "Ative a permissão para acessar a localização.");
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
  }, []);

  useEffect(() => {
    if (servicesEnabled === false) {
      setShowDialog(true);
    } else if (servicesEnabled === true) {
      setShowDialog(false);
    }
  }, [servicesEnabled]);

  const centerOnUser = async () => {
    await getLocation();
  };

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

  return (
    <View style={styles.container}>
      <MapView
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
          const coords = (feature.geometry as any).coordinates[0].map((c: number[]) => ({
            latitude: c[1],
            longitude: c[0],
          }));

          return (
            <Polygon
              key={index}
              coordinates={coords}
              tappable={true}
              strokeColor={selectedIndex === index ? "#1f1f1f" : "rgba(0,0,0,0.001)"}
              strokeWidth={selectedIndex === index ? 0.5 : 0.5}
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

      {/* Dialog */}
      <Modal
        transparent={true}
        visible={showDialog}
        animationType="fade"
        onRequestClose={() => setShowDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Localização desativada</Text>
            <Text style={styles.modalText}>
              Ative os serviços de localização para usar o mapa corretamente.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowDialog(false)}
            >
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
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#1f1f1f',
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
