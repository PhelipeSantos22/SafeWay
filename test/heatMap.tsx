import * as Location from "expo-location";
import { LocateFixed } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import MapView, { Heatmap, PROVIDER_GOOGLE } from "react-native-maps";
import rawHeatmapData from "../assets/data/heatmap_points.json";

export default function HeatMapScreen() {
  const [region, setRegion] = useState({
    latitude: -23.55052,
    longitude: -46.633308,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permissão negada para acessar localização");
        return;
      }

      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      });
    })();
  }, []);

  const centerOnUser = async () => {
    if (!location) return;
    setRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  // Converter JSON para formato que o Heatmap entende
  const heatmapPoints = rawHeatmapData.map(p => ({
    latitude: p.latitude,
    longitude: p.longitude,
    weight: p.weight,
  }));

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        showsUserLocation={true}
        showsCompass={true}
        zoomEnabled={false}       
        zoomControlEnabled={false}
      >
        <Heatmap
          points={heatmapPoints}
          opacity={0.6}
          radius={50}
          gradient={{
            colors: ["rgba(255, 215, 0)", "rgba(255, 140, 0)", "rgba(226, 88, 34)", "rgba(128, 0, 0)", "rgba(75, 0, 0)"], 
            startPoints: [0.1, 0.3, 0.5, 0.7, 1],
            colorMapSize: 256,
          }}
        />
      </MapView>

      <TouchableOpacity style={styles.locateButton} onPress={centerOnUser}>
        <LocateFixed size={28} color="#000" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  locateButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 50,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
});