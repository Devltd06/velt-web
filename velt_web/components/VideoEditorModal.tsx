import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";

type VideoEditorModalProps = {
	visible: boolean;
	onCancel: () => void;
};

/**
 * Legacy placeholder kept to avoid breaking imports.
 * Real trimming required native FFmpeg support, which is no longer bundled so Expo Go users can run the app.
 */
export default function VideoEditorModal({ visible, onCancel }: VideoEditorModalProps) {
	if (!visible) return null;
	return (
		<Modal visible transparent animationType="fade" onRequestClose={onCancel}>
			<View style={styles.overlay}>
				<View style={styles.card}>
					<Text style={styles.title}>Video trimming is unavailable</Text>
					<Text style={styles.subtitle}>Edit clips externally, then import them into your story.</Text>
					<TouchableOpacity style={styles.closeBtn} onPress={onCancel}>
						<Text style={styles.closeText}>Close</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.5)",
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
	},
	card: {
		width: "100%",
		borderRadius: 18,
		backgroundColor: "#111",
		padding: 20,
	},
	title: { color: "#fff", fontWeight: "800", fontSize: 18 },
	subtitle: { color: "#cbd5f5", marginTop: 8, lineHeight: 20 },
	closeBtn: {
		marginTop: 18,
		alignSelf: "flex-end",
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 999,
		backgroundColor: "#f5b700",
	},
	closeText: { color: "#111", fontWeight: "700" },
});
