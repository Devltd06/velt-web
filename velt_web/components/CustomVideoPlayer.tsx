import React, { useRef, useState } from "react";
import { View, TouchableOpacity, ActivityIndicator } from "react-native";
import { Video } from "expo-av";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  source: string;
}

export default function CustomVideoPlayer({ source }: Props) {
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<any>({});
  const [loading, setLoading] = useState(true);

  return (
    <View style={{ width: "100%", aspectRatio: 9 / 16, backgroundColor: "#000" }}>
      <Video
        ref={videoRef}
        source={{ uri: source }}
        style={{ width: "100%", height: "100%" }}
        resizeMode="cover"
        shouldPlay={false}
        useNativeControls={false}
        onLoadStart={() => setLoading(true)}
        onLoad={() => setLoading(false)}
        onPlaybackStatusUpdate={(s) => setStatus(() => s)}
      />

      {loading && (
        <View style={{ position: "absolute", top: "50%", left: "50%", marginLeft: -15, marginTop: -15 }}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}

      <TouchableOpacity
        style={{ position: "absolute", bottom: 20, left: 20 }}
        onPress={() =>
          status.isPlaying ? videoRef.current?.pauseAsync() : videoRef.current?.playAsync()
        }
      >
        <Ionicons name={status.isPlaying ? "pause" : "play"} size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
