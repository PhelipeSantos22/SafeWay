import 'dotenv/config';

export default {
  expo: {
    name: "SafeWay",
    slug: "SafeWay",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/iconSafeWay.png",
    scheme: "safeway",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/iconSafeWay.png",
      },
      notification: {
        icon: "./assets/images/iconNotification.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.phelipenunes.SafeWay",
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    splash: {
      image: "./assets/images/splashSafeWay.png",
      resizeMode: "contain",
    },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-web-browser",
      [
        "expo-notifications",
        {
          "icon": "./assets/images/iconNotification.png", 
        }
      ]
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      router: {},
      eas: {
        projectId: "f6c57861-3c11-4ec4-9ded-447819c250be",
      },
    },
  },
};
