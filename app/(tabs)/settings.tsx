import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Divider, RadioButton, Text } from "react-native-paper";

export default function SettingsScreen() {
  const [notificationLevel, setNotificationLevel] = useState("moderate");
  const navigation = useNavigation<any>();

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("notificationLevel");
      if (saved) setNotificationLevel(saved);
    })();
  }, []);

  const handleChange = async (value: string) => {
    setNotificationLevel(value);
    await AsyncStorage.setItem("notificationLevel", value);
    console.log("Nível escolhido:", value);
  };

  return (
    <View style={styles.container}>
      <View style={styles.containerTitle}>
        <ArrowLeft color="#d3d3d3ff" onPress={() => navigation.navigate("map")} />
        <Text style={styles.title}>Configurações</Text>
      </View>
      <Divider style={styles.divider} />
      <Text style={styles.sectionTitle}>Notificações</Text>
      <Text style={{ color: "#d3d3d3ff", marginBottom: 10 }}>Escolha quando você quer ser avisado ao entrar em uma região de risco</Text>
      <RadioButton.Group
        onValueChange={(value) => handleChange(value)}
        value={notificationLevel}
      >
        <View style={styles.option}>
          <RadioButton value="very-high" />
          <Text style={styles.optionText}>Muito Alta</Text>
        </View>
        <View style={styles.option}>
          <RadioButton value="high" />
          <Text style={styles.optionText}>Alta</Text>
        </View>
        <View style={styles.option}>
          <RadioButton value="moderate" />
          <Text style={styles.optionText}>Moderada</Text>
        </View>
        <View style={styles.option}>
          <RadioButton value="low" />
          <Text style={styles.optionText}>Baixa</Text>
        </View>
        <View style={styles.option}>
          <RadioButton value="very-low" />
          <Text style={styles.optionText}>Muito Baixa</Text>
        </View>
        <View style={styles.option}>
          <RadioButton value="none" />
          <Text style={styles.optionText}>Nenhuma</Text>
        </View>
      </RadioButton.Group>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#1f1f1f",
  },
  containerTitle: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
    marginTop: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#d3d3d3ff",
  },
  divider: {
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginVertical: 10,
    color: "#d3d3d3ff",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 5,
  },
  optionText: {
    fontSize: 16,
    color: "#d3d3d3ff",
  },
});
