// BootScreen.tsx
import React, { useEffect } from "react";
import { View, StyleSheet, ImageSourcePropType, Text } from "react-native";
import * as Animatable from "react-native-animatable";
import { useFonts } from "expo-font";

type BootScreenProps = {
  onFinish?: () => void;
  totalDuration?: number; // ms
  image?: ImageSourcePropType; // optional override for the boot image
  imageSize?: number;
  creditText?: string; // optional override for credit text
};

export default function BootScreen({
  onFinish,
  totalDuration = 3200,
  image,
  imageSize = 160,
  creditText = "by Atmosdev",
}: BootScreenProps) {
  // Load a "cool" font from assets/fonts. You can swap this file or name.
  // Put a font file at: ./assets/fonts/Pacifico-Regular.ttf (or change the require path below).
  const [fontsLoaded] = useFonts({
    // If you prefer a different font, replace the file and the key name here.
  });

  useEffect(() => {
    const safety = setTimeout(() => {
      if (typeof onFinish === "function") onFinish();
    }, totalDuration + 300);
    return () => clearTimeout(safety);
  }, [onFinish, totalDuration]);

  useEffect(() => {
    console.log("BootScreen mounted");
  }, []);

  // Back-and-forth + in-and-out keyframes:
  //   - translateX moves left <-> right
  //   - scale animates in/out (slightly forward/back)
  //   - subtle opacity for polish
  const oscillation = {
    0: { translateX: -16, scale: 0.96, opacity: 0.92 },
    0.35: { translateX: 8, scale: 1.02, opacity: 1 },
    0.65: { translateX: 10, scale: 1.04, opacity: 1 },
    1: { translateX: -16, scale: 0.96, opacity: 0.92 },
  };

  const defaultImage = image ?? require("../assets/boot-logo.jpg");

  return (
    <Animatable.View
      animation={{ 0: { opacity: 1 }, 0.95: { opacity: 1 }, 1: { opacity: 0 } }}
      duration={totalDuration}
      onAnimationEnd={() => {
        console.log("BootScreen finished");
        if (typeof onFinish === "function") onFinish();
      }}
      style={styles.overlay}
    >
      <View style={styles.center}>
        <Animatable.Image
          animation={oscillation}
          iterationCount="infinite"
          easing="ease-in-out"
          duration={1200}
          source={defaultImage}
          style={[styles.logo, { width: imageSize, height: imageSize, borderRadius: Math.round(imageSize / 8) }]}
          resizeMode="contain"
        />

        {/* credit / byline at bottom */}
        <Animatable.Text
          animation={{ 0: { opacity: 0 }, 0.8: { opacity: 1 }, 1: { opacity: 1 } }}
          duration={Math.min(1200, totalDuration)}
          style={[
            styles.credit,
            // apply the custom font only when loaded, otherwise fall back.
            fontsLoaded ? { fontFamily: "AtmosCool" } : {},
          ]}
        >
          {creditText}
        </Animatable.Text>
      </View>
    </Animatable.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
  },
  logo: {
    // subtle shadow so the image pops on dark background
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 12,
  },
  credit: {
    marginTop: 18,
    color: "#dbe9ff",
    fontSize: 14,
    opacity: 0.95,
    letterSpacing: 0.6,
    // small glassy glow:
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});


