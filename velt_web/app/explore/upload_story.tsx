import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Animated,
	Modal,
	Dimensions,
	FlatList,
	Image,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	TouchableWithoutFeedback,
	View,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from "@expo/vector-icons";
import { Audio, Video, ResizeMode } from "expo-av";
import type { Sound } from "expo-av/build/Audio/Sound";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { withSafeRouter } from '@/lib/navigation';
import * as Haptics from "expo-haptics";

import { useUploadStore } from "@/lib/store/uploadStore";
import { startStoryUpload } from "@/lib/upload/storyUploader";
import { supabase as projectSupabase } from "@/lib/supabase";
import { useTheme, VELT_ACCENT, BUTTON_COLORS, GRADIENTS } from "app/themes";
import PhotoEditorModal from "@/components/PhotoEditorModal";
import { LinearGradient } from "expo-linear-gradient";
import type {
	StoryUploadDraft,
	StoryUploadJob,
	StoryUploadSelectedMusic,
	StoryLocationCoords,
	StoryThumbnail,
	ExpiryChoice,
	StoryPartner,
} from "@/lib/types/storyUpload";

type ProfileShort = {
	id: string;
	full_name?: string | null;
	avatar_url?: string | null;
	username?: string | null;
};

type LocationSuggestion = {
	label: string;
	coords: StoryLocationCoords;
	placeId?: string | null;
};

type SoundtrackRow = {
	id: string;
	title: string;
	audio_url: string;
	artwork_url?: string | null;
	artist_name?: string | null;
	duration_ms?: number | null;
};

type ExpoSoundInstance = Sound | null;

const MAX_PARTNERS = 5;
const EXPIRY_OPTIONS: ExpiryChoice[] = ["24h", "2d", "3d", "7d", "30d", "custom"];

// Predefined labels for stories - covering lifestyle, content types, and common categories
const PREDEFINED_LABELS = [
	// Lifestyle & Personal
	"Lifestyle", "Daily Vlog", "Day in Life", "Morning Routine", "Night Routine",
	"Self Care", "Wellness", "Fitness", "Workout", "Health",
	// Fashion & Beauty
	"Fashion", "OOTD", "Style", "Beauty", "Makeup", "Skincare", "Hair",
	// Food & Drinks
	"Food", "Foodie", "Recipe", "Cooking", "Baking", "Drinks", "Coffee",
	// Travel & Places
	"Travel", "Adventure", "Explore", "Vacation", "Road Trip", "City Tour",
	// Entertainment
	"Music", "Dance", "Art", "Photography", "Film", "Gaming", "Movies",
	// Business & Work
	"Business", "Promo", "Drop", "Launch", "Sale", "Brand", "Work",
	// Events & Special
	"Event", "Party", "Celebration", "Birthday", "Wedding", "Holiday",
	// Mood & Vibe
	"Vibes", "Mood", "Chill", "Fun", "Inspiration", "Motivation",
	// Miscellaneous
	"DIY", "Tips", "Tutorial", "Review", "Unboxing", "Haul", "Other"
];

export default function UploadStoryScreen() {
	const params = useLocalSearchParams<{ jobId?: string }>();
	const jobId = params?.jobId ? String(params.jobId) : null;
	const jobs = useUploadStore((state) => state.jobs);
	const job = jobId ? jobs[jobId] : null;

	if (jobId) {
		return <UploadStoryProgress jobId={jobId} job={job ?? null} />;
	}

	return <UploadStoryComposer />;
}

function UploadStoryComposer() {
	const router = withSafeRouter(useRouter());
	const { colors } = useTheme();
	const consumeDraft = useUploadStore((state) => state.consumeDraft);
	const createJob = useUploadStore((state) => state.createJob);
	const setDraftStore = useUploadStore((state) => state.setDraft);

	const [draft, setDraft] = useState<ReturnType<typeof consumeDraft> | null>(null);
	const [caption, setCaption] = useState("");
	const [label, setLabel] = useState("");
	const [partnerSheetOpen, setPartnerSheetOpen] = useState(false);
	const [partnerSearch, setPartnerSearch] = useState("");
	const [partnerResults, setPartnerResults] = useState<ProfileShort[]>([]);
	const [selectedPartners, setSelectedPartners] = useState<ProfileShort[]>([]);
	const [locationSheetOpen, setLocationSheetOpen] = useState(false);
	const [locationQuery, setLocationQuery] = useState("");
	const [locationOptions, setLocationOptions] = useState<LocationSuggestion[]>([]);
	const [locationLoading, setLocationLoading] = useState(false);
	const [location, setLocation] = useState("");
	const [locationCoords, setLocationCoords] = useState<StoryLocationCoords | null>(null);
	// If the user selects a Google Place suggestion we'll store its Place ID here
	const [locationPlaceId, setLocationPlaceId] = useState<string | null>(null);
	// If the user selects an existing DB location post we'll store that id here
	const [locationPostId, setLocationPostId] = useState<string | null>(null);
	const [locationResults, setLocationResults] = useState<LocationSuggestion[] | any[]>([]);
	const [locationResultsLoading, setLocationResultsLoading] = useState(false);

	const [expiryChoice, setExpiryChoice] = useState<ExpiryChoice>("24h");
	const [customExpiryHours, setCustomExpiryHours] = useState<number | null>(null);
	const [musicSheetOpen, setMusicSheetOpen] = useState(false);
	const [selectedMusic, setSelectedMusic] = useState<StoryUploadSelectedMusic | null>(draft?.cameraSelectedMusic ?? null);
	const [soundtracks, setSoundtracks] = useState<SoundtrackRow[]>([]);
	const [trackSearch, setTrackSearch] = useState("");
	const [tracksLoading, setTracksLoading] = useState(false);
	const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
	const [playLoadingId, setPlayLoadingId] = useState<string | null>(null);
	const [publishing, setPublishing] = useState(false);
	// Publish quality: 'hd' will upload media as-is and mark isHD=true
	// 'compressed' will compress images locally and apply server-transform for videos
	const [publishQuality, setPublishQuality] = useState<'hd' | 'compressed'>('hd');
	// keep picker inline (visible) — no modal by default
	const [activeMediaIndex, setActiveMediaIndex] = useState(0);
	// Thumbnail state (image or video up to 10 seconds)
	const [thumbnail, setThumbnail] = useState<StoryThumbnail | null>(null);
	const [thumbnailSheetOpen, setThumbnailSheetOpen] = useState(false);
	// Label picker sheet state
	const [labelSheetOpen, setLabelSheetOpen] = useState(false);
	// Thumbnail editor state (for cropping images)
	const [thumbnailEditorOpen, setThumbnailEditorOpen] = useState(false);
	const [pendingThumbnailUri, setPendingThumbnailUri] = useState<string | null>(null);

	const previewSoundRef = useRef<ExpoSoundInstance>(null);
	const playbackAnim = useRef(new Animated.Value(0)).current;
	const eqScales = useMemo(() => [0.4, 0.8, 1, 0.65], []);

	const theme = useMemo(() => {
		const hair = colors.border || (colors.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)");
		return {
			bg: colors.bg,
			card: colors.card,
			text: colors.text,
			muted: colors.subtext,
			accent: colors.accent,
			hair,
			isDark: colors.isDark ?? false,
		};
	}, [colors]);

	useEffect(() => {
		setDraft((prev) => prev ?? consumeDraft());
	}, [consumeDraft]);

	useEffect(() => {
		if (!draft?.cameraSelectedMusic) return;
		setSelectedMusic((prev) => prev ?? draft.cameraSelectedMusic ?? null);
	}, [draft]);

	useEffect(() => {
		if (!partnerSheetOpen) return;
		const query = partnerSearch.trim();
		if (!query) {
			setPartnerResults([]);
			return;
		}
		const handle = setTimeout(async () => {
			try {
				const { data, error } = await projectSupabase
					.from("profiles")
					.select("id, full_name, avatar_url, username")
					.or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
					.limit(10);
				if (!error && data) setPartnerResults(data as ProfileShort[]);
			} catch (err) {
				console.warn("partner search", err);
			}
		}, 350);
		return () => clearTimeout(handle);
	}, [partnerSearch, partnerSheetOpen]);

	useEffect(() => {
		if (!locationSheetOpen) return;
		const term = locationQuery.trim();
		if (term.length < 3) {
			setLocationOptions([]);
			return;
		}

		let cancelled = false;
		setLocationLoading(true);

		(async () => {
			try {
				// Allow using Google Places Autocomplete when API key is available
				const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? '';
				if (GOOGLE_KEY) {
					// Autocomplete predictions
					const autoUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(term)}&key=${GOOGLE_KEY}&types=geocode&language=en`;
					try {
						const autoRes = await fetch(autoUrl);
						const autoJson = await autoRes.json();
						if (autoJson && autoJson.status === 'OK' && Array.isArray(autoJson.predictions)) {
							const preds = autoJson.predictions.slice(0, 6);
							const suggestions = await Promise.all(
								preds.map(async (p: any) => {
									try {
										const placeId = p.place_id;
										// Get place details for coordinates
										const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_KEY}&fields=geometry,formatted_address,name`;
										const detRes = await fetch(detUrl);
										const detJson = await detRes.json();
										if (detJson && detJson.status === 'OK' && detJson.result && detJson.result.geometry && detJson.result.geometry.location) {
											const loc = detJson.result.geometry.location;
											const coords = { lat: Number(loc.lat), lng: Number(loc.lng) } as StoryLocationCoords;
											const label = detJson.result.formatted_address ?? detJson.result.name ?? p.structured_formatting?.main_text ?? p.description;
											return { label, coords, placeId } as LocationSuggestion;
										}
									} catch (e) {
										console.warn('place details error', e);
									}
									return null;
								}),
							);
							if (!cancelled) setLocationOptions(suggestions.filter(Boolean) as LocationSuggestion[]);
							return;
						}
						// fall through to geocode fallback if autocomplete fails
					} catch (e) {
						console.warn('places autocomplete error', e);
						// continue to fallback
					}
				}

				// Fallback: use device geocode and reverse-geocode
				try {
					const results = await Location.geocodeAsync(term);
					const limited = results.slice(0, 5);
					const suggestions = await Promise.all(
						limited.map(async (entry) => {
							const coords = { lat: entry.latitude, lng: entry.longitude } as StoryLocationCoords;
							let labelGuess = `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`;
							try {
								const [address] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
								labelGuess = formatLocationLabel(address, coords);
							} catch (err) {
								console.warn("reverse geocode", err);
							}
							return { label: labelGuess, coords } as LocationSuggestion;
						}),
					);
					if (!cancelled) setLocationOptions(suggestions.filter(Boolean));
				} catch (err) {
					console.warn("location search fallback", err);
				}
			} catch (err) {
				console.warn("location search error", err);
			} finally {
				if (!cancelled) setLocationLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [locationQuery, locationSheetOpen]);

	// When publishTarget === 'location' show existing DB location posts so user can pick one
	useEffect(() => {
		let cancelled = false;
		async function fetch() {
			if (draft?.publishTarget !== 'location') return setLocationResults([]);
			setLocationResultsLoading(true);
			try {
				let query = projectSupabase.from('location_posts').select('id, place, caption, country, images, avatar_url, position').order('created_at', { ascending: false }).limit(24);
				const term = (locationQuery || '').trim();
				if (term.length > 0) {
					// search by place or country
						query = projectSupabase
						.from('location_posts')
						.select('id, place, caption, country, images, avatar_url, position')
						.or(`place.ilike.%${term}%,country.ilike.%${term}%`)
						.order('created_at', { ascending: false })
						.limit(24);
				}
				const { data, error } = await query;
				if (!cancelled) {
					if (error) {
						console.warn('fetch location_posts', error);
						setLocationResults([]);
					} else {
						setLocationResults((data ?? []) as any[]);
					}
				}
			} catch (err) {
				if (!cancelled) {
					console.warn('fetch location_posts error', err);
					setLocationResults([]);
				}
			} finally {
				if (!cancelled) setLocationResultsLoading(false);
			}
		}
		fetch();
		return () => { cancelled = true; };
	}, [draft?.publishTarget, locationQuery]);

	const stopPreviewPlayback = useCallback(async () => {
		try {
			await previewSoundRef.current?.stopAsync();
			await previewSoundRef.current?.unloadAsync();
		} catch (err) {
			console.warn("preview stop", err);
		}
		previewSoundRef.current = null;
		setPlayingTrackId(null);
		setPlayLoadingId(null);
	}, []);

	useEffect(() => {
		let loop: Animated.CompositeAnimation | null = null;
		if (playingTrackId) {
			loop = Animated.loop(
				Animated.sequence([
					Animated.timing(playbackAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
					Animated.timing(playbackAnim, { toValue: 0, duration: 420, useNativeDriver: true }),
				]),
			);
			loop.start();
		} else {
			playbackAnim.stopAnimation(() => playbackAnim.setValue(0));
		}
		return () => loop?.stop();
	}, [playbackAnim, playingTrackId]);

	const fetchSoundtracks = useCallback(async (query: string) => {
		const term = query.trim();
		setTracksLoading(true);
		try {
			let request = projectSupabase
				.from("soundtracks")
				.select("id,title,audio_url,artwork_url,artist_name,duration_ms")
				.order("created_at", { ascending: false })
				.limit(60);
			if (term) {
				request = projectSupabase
					.from("soundtracks")
					.select("id,title,audio_url,artwork_url,artist_name,duration_ms")
					.or(`title.ilike.%${term}%,artist_name.ilike.%${term}%`)
					.order("created_at", { ascending: false })
					.limit(60);
			}
			const { data, error } = await request;
			if (!error && data) setSoundtracks(data as SoundtrackRow[]);
		} catch (err) {
			console.warn("soundtrack fetch", err);
		} finally {
			setTracksLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!musicSheetOpen) return;
		const handle = setTimeout(() => {
			fetchSoundtracks(trackSearch);
		}, 250);
		return () => clearTimeout(handle);
	}, [fetchSoundtracks, musicSheetOpen, trackSearch]);

	useEffect(() => {
		if (!musicSheetOpen) {
			setTrackSearch("");
			stopPreviewPlayback();
		}
	}, [musicSheetOpen, stopPreviewPlayback]);

	useEffect(() => {
		return () => {
			stopPreviewPlayback();
		};
	}, [stopPreviewPlayback]);

	const toggleSelectPartner = useCallback((partner: ProfileShort) => {
		setSelectedPartners((prev) => {
			const exists = prev.some((p) => p.id === partner.id);
			if (exists) {
				Haptics.selectionAsync().catch(() => {});
				return prev.filter((p) => p.id !== partner.id);
			}
			if (prev.length >= MAX_PARTNERS) {
				Alert.alert("Limit reached", `You can only tag up to ${MAX_PARTNERS} partners.`);
				return prev;
			}
			Haptics.selectionAsync().catch(() => {});
			return [...prev, partner];
		});
	}, []);

	const clearPartners = useCallback(() => {
		setSelectedPartners([]);
		setPartnerSearch("");
		Haptics.selectionAsync().catch(() => {});
	}, []);

	const handleUseCurrentLocation = useCallback(async () => {
		try {
			const { status } = await Location.requestForegroundPermissionsAsync();
			if (status !== "granted") {
				Alert.alert("Permission needed", "Allow location access to tag where you are.");
				return;
			}
			const current = await Location.getCurrentPositionAsync({});
			const coords = { lat: current.coords.latitude, lng: current.coords.longitude };
			let resolvedLabel = `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`;
			try {
				const [address] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
				resolvedLabel = formatLocationLabel(address, coords);
			} catch (err) {
				console.warn("reverse geocode current", err);
			}
			setLocationCoords(coords);
			setLocation(resolvedLabel);
			setLocationSheetOpen(false);
			setLocationOptions([]);
			setLocationQuery(resolvedLabel);
		} catch (err) {
			Alert.alert("Location", "Unable to fetch your current location.");
			console.warn("use current location", err);
		}
	}, []);

	const toggleTrackPreview = useCallback(
		async (track: SoundtrackRow) => {
			if (!track?.audio_url) return;
			try {
				Haptics.selectionAsync().catch(() => {});
				if (playingTrackId === track.id) {
					setPlayLoadingId(null);
					await stopPreviewPlayback();
					return;
				}
				setPlayLoadingId(track.id);
				await previewSoundRef.current?.unloadAsync().catch(() => {});
				const { sound } = await Audio.Sound.createAsync({ uri: track.audio_url }, { shouldPlay: true, volume: 1 });
				previewSoundRef.current = sound;
				setPlayLoadingId(null);
				setPlayingTrackId(track.id);
				sound.setOnPlaybackStatusUpdate((status: any) => {
					if (!status || !status.isLoaded) return;
					if (status.didJustFinish) {
						stopPreviewPlayback();
					}
				});
			} catch (err) {
				console.warn("track preview", err);
				setPlayLoadingId(null);
				Alert.alert("Playback", "Unable to preview that track right now.");
				stopPreviewPlayback();
			}
		},
		[playingTrackId, stopPreviewPlayback],
	);

	const handleSelectTrack = useCallback(
		(track: SoundtrackRow) => {
			setSelectedMusic({
				id: track.id,
				title: track.title,
				audioUrl: track.audio_url,
				artworkUrl: track.artwork_url ?? null,
				artist: track.artist_name ?? null,
				durationMs: track.duration_ms ?? null,
			});
			setMusicSheetOpen(false);
			stopPreviewPlayback();
			Haptics.selectionAsync().catch(() => {});
		},
		[stopPreviewPlayback],
	);

	const handleClearMusic = useCallback(() => {
		setSelectedMusic(null);
		stopPreviewPlayback();
		Haptics.selectionAsync().catch(() => {});
	}, [stopPreviewPlayback]);

	const handleOpenSoundGallery = useCallback(() => {
		Haptics.selectionAsync().catch(() => {});
		setMusicSheetOpen(false);
		stopPreviewPlayback();
		setTimeout(() => {
			try {
				router.push("/home/soundgallery");
			} catch (err) {
				console.warn("soundgallery nav", err);
			}
		}, 180);
	}, [router, stopPreviewPlayback]);

	const payloadMedia = draft?.media ?? [];
	const publishTargetLabel = draft?.publishTarget === "business" ? "Business" : draft?.publishTarget === 'location' ? 'Location' : 'Stories';
	// Label is now required
	const publishDisabled =
		!draft || !payloadMedia.length || publishing || !label.trim() || (expiryChoice === "custom" && !customExpiryHours) || (draft?.publishTarget === 'location' && !location && !locationCoords);

	// Thumbnail picker handlers
	const handlePickThumbnailImage = useCallback(async () => {
		try {
			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Images,
				allowsEditing: false, // Don't use native editing, we'll use our custom editor
				quality: 1,
			});
			if (!result.canceled && result.assets?.[0]) {
				// Open our custom photo editor for cropping
				setPendingThumbnailUri(result.assets[0].uri);
				setThumbnailSheetOpen(false);
				setThumbnailEditorOpen(true);
				Haptics.selectionAsync().catch(() => {});
			}
		} catch (err) {
			console.warn("thumbnail image pick", err);
			Alert.alert("Error", "Unable to select image for thumbnail.");
		}
	}, []);

	// Handle edited thumbnail from PhotoEditorModal
	const handleThumbnailEdited = useCallback((editedUri: string) => {
		setThumbnail({
			uri: editedUri,
			type: "image",
		});
		setThumbnailEditorOpen(false);
		setPendingThumbnailUri(null);
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
	}, []);

	const handlePickThumbnailVideo = useCallback(async () => {
		try {
			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Videos,
				allowsEditing: true,
				videoMaxDuration: 10, // Max 10 seconds for thumbnail video
				quality: 0.8,
			});
			if (!result.canceled && result.assets?.[0]) {
				const asset = result.assets[0];
				// Ensure video is max 10 seconds
				const durationMs = asset.duration ? asset.duration * 1000 : null;
				if (durationMs && durationMs > 10000) {
					Alert.alert("Video too long", "Thumbnail video must be 10 seconds or less. Please trim the video.");
					return;
				}
				setThumbnail({
					uri: asset.uri,
					type: "video",
					durationMs: durationMs ? Math.min(durationMs, 10000) : 10000,
				});
				setThumbnailSheetOpen(false);
				Haptics.selectionAsync().catch(() => {});
			}
		} catch (err) {
			console.warn("thumbnail video pick", err);
			Alert.alert("Error", "Unable to select video for thumbnail.");
		}
	}, []);

	const handleClearThumbnail = useCallback(() => {
		setThumbnail(null);
		Haptics.selectionAsync().catch(() => {});
	}, []);

	const readImageSize = async (uri: string) =>
		new Promise<{ width: number; height: number }>((resolve) => {
			Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), () => resolve({ width: 0, height: 0 }));
		});

	const compressImageUri = async (uri: string) => {
		try {
			// Resize to max width 1280 and compress to 0.7
			const { width, height } = await readImageSize(uri);
			const maxW = 1280;
			let actions: any[] = [];
			if (width && width > maxW) {
				const scale = maxW / width;
				actions.push({ resize: { width: Math.round(width * scale), height: Math.round(height * scale) } });
			}
			const res = await ImageManipulator.manipulateAsync(uri, actions, { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
			return res.uri;
		} catch (err) {
			console.warn('compress image failed', err);
			return uri;
		}
	};

	const handlePublish = useCallback(async () => {
		if (!draft) return;
		if (!payloadMedia.length) {
			Alert.alert("Media missing", "Capture something first.");
			return;
		}
		try {
			setPublishing(true);
			// Make a deep copy first so we don't corrupt local state
			const mediaCopy = payloadMedia.map((it) => ({ ...it }));

			// If user chose compressed, try compressing images locally and mark videos to be transformed server-side
			if (publishQuality === 'compressed') {
				for (let i = 0; i < mediaCopy.length; i += 1) {
					const it = mediaCopy[i];
					// Always ensure HD flag is false for compressed uploads
					it.isHD = false;
					// For local images, compress on-device
					if (it.type === 'image' && !it.uri.startsWith('http')) {
						try {
							const compressed = await compressImageUri(it.editedUri ?? it.uri);
							it.editedUri = compressed;
							// try to update size if available
							try {
								const size = await readImageSize(compressed);
								it.editedWidth = size.width || it.editedWidth;
								it.editedHeight = size.height || it.editedHeight;
							} catch {}
						} catch (e) {
							// compression failed, keep original
						}
					}
					// For videos we set a compress flag which uploader will use to request server-side transformation
					if (it.type === 'video') {
						// add a transient flag the uploader understands
						(it as any).compress = true;
						it.isHD = false;
					}
				}
			} else {
				// HD selected — mark all clips as HD
				for (let it of mediaCopy) {
					it.isHD = true;
					// ensure no compress flags left
					delete (it as any).compress;
				}
			}

			const payload: StoryUploadDraft = {
				userId: draft.userId,
				caption: caption.trim(),
				media: mediaCopy,
				thumbnail: thumbnail ?? undefined,
				label: label.trim() || undefined,
				partners: selectedPartners.map((partner) => ({
					id: partner.id,
					full_name: partner.full_name,
					avatar_url: partner.avatar_url,
					username: partner.username,
				}) as StoryPartner),
				selectedMusic,
				expiryChoice,
				customExpiryHours,
				location: location.trim() || undefined,
				locationCoords,
				locationPlaceId: locationPlaceId ?? undefined,
				locationPostId: locationPostId ?? undefined,
				// publishTarget will control whether this goes to stories / business_stories / location_posts
				publishTarget: draft.publishTarget,
			};
			const jobId = createJob(payload);
			startStoryUpload(jobId);
			router.replace({ pathname: "/explore/upload_story", params: { jobId } });
		} catch (err) {
			console.error("publish story", err);
			Alert.alert("Upload", err instanceof Error ? err.message : "Unable to start upload right now.");
		} finally {
			setPublishing(false);
		}
	}, [caption, createJob, draft, expiryChoice, label, location, locationCoords, payloadMedia, router, selectedMusic, selectedPartners, customExpiryHours, thumbnail]);

	if (!draft) {
		return (
			<SafeAreaView style={[composerStyles.container, { backgroundColor: colors.bg }]}> 
				<View style={composerStyles.header}> 
					<TouchableOpacity onPress={() => router.replace("/explore/create_story")} style={composerStyles.headerBtn}>
						<Ionicons name="arrow-back" size={20} color={colors.text} />
					</TouchableOpacity>
					<Text style={[composerStyles.headerTitle, { color: colors.text }]}>Story details</Text>
					<View style={{ width: 32 }} />
				</View>
				<View style={[composerStyles.emptyState, { borderColor: colors.border }]}> 
					<Ionicons name="camera" size={42} color={colors.subtext} />
					<Text style={[composerStyles.emptyTitle, { color: colors.text }]}>Nothing to edit yet</Text>
					<Text style={[composerStyles.emptyBody, { color: colors.subtext }]}>Capture a photo or video first, then we will bring you back here.</Text>
					<TouchableOpacity style={[composerStyles.ctaPrimary, { backgroundColor: colors.accent }]} onPress={() => router.replace("/explore/create_story")}>
						<Text style={composerStyles.ctaPrimaryText}>Back to camera</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={[composerStyles.container, { backgroundColor: theme.bg }]}> 
			<View style={composerStyles.header}> 
				<TouchableOpacity onPress={() => router.replace("/explore/create_story")} style={composerStyles.headerBtn}>
					<Ionicons name="arrow-back" size={20} color={theme.text} />
				</TouchableOpacity>
				<Text style={[composerStyles.headerTitle, { color: theme.text }]}>Story details</Text>
				<View style={{ width: 32 }} />
			</View>

			<ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
				{/* Publish Target Section - modern pill buttons */}
				<View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
					<Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 12 }}>PUBLISH TO</Text>
					<View style={{ flexDirection: 'row', gap: 10 }}>
						{(['stories', 'business', 'location'] as const).map((target) => {
							const isActive = draft?.publishTarget === target;
							const icon = target === 'stories' ? 'sparkles' : target === 'business' ? 'briefcase' : 'location';
							const label = target.charAt(0).toUpperCase() + target.slice(1);
							return (
								<TouchableOpacity
									key={target}
									style={[
										composerStyles.targetPill,
										isActive && composerStyles.targetPillActive,
									]}
									onPress={() => {
										Haptics.selectionAsync().catch(() => {});
										if (!draft) return;
										const next = { ...draft, publishTarget: target };
										setDraft(next);
										setDraftStore(next);
									}}
								>
									<Ionicons name={icon as any} size={16} color={isActive ? '#000' : theme.muted} />
									<Text style={[composerStyles.targetPillText, isActive && composerStyles.targetPillTextActive]}>{label}</Text>
								</TouchableOpacity>
							);
						})}
					</View>
				</View>

				{/* Hero Preview & Thumbnail Row - side by side modern layout */}
				<View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
					<View style={{ flexDirection: 'row', gap: 16 }}>
						{/* Main Preview */}
						<View style={{ flex: 2 }}>
							{payloadMedia.length ? (
								<View style={composerStyles.heroPreviewModern}>
									{payloadMedia[activeMediaIndex]?.type === "video" ? (
										<Video
											source={{ uri: payloadMedia[activeMediaIndex]?.editedUri ?? payloadMedia[activeMediaIndex]?.uri }}
											style={composerStyles.heroPreviewMedia}
											resizeMode={ResizeMode.COVER}
											shouldPlay
											isLooping
											isMuted
										/>
									) : (
										<Image
											source={{ uri: payloadMedia[activeMediaIndex]?.editedUri ?? payloadMedia[activeMediaIndex]?.uri }}
											style={composerStyles.heroPreviewMedia}
											resizeMode="cover"
										/>
									)}
									{/* Media count badge */}
									{payloadMedia.length > 1 && (
										<View style={composerStyles.mediaCountBadge}>
											<Ionicons name="layers" size={12} color="#fff" />
											<Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 4 }}>{payloadMedia.length}</Text>
										</View>
									)}
								</View>
							) : (
								<View style={composerStyles.heroEmptyModern}>
									<Ionicons name="images" size={32} color={theme.muted} />
									<Text style={{ color: theme.muted, marginTop: 8, fontSize: 13 }}>No media</Text>
								</View>
							)}
						</View>

						{/* Thumbnail Preview */}
						<TouchableOpacity 
							onPress={() => {
								Haptics.selectionAsync().catch(() => {});
								setThumbnailSheetOpen(true);
							}}
							style={{ flex: 1 }}
						>
							<View style={composerStyles.thumbnailPreviewBox}>
								{thumbnail ? (
									<>
										{thumbnail.type === "video" ? (
											<Video
												source={{ uri: thumbnail.uri }}
												style={{ width: "100%", height: "100%", borderRadius: 16 }}
												resizeMode={ResizeMode.COVER}
												shouldPlay
												isLooping
												isMuted
											/>
										) : (
											<Image source={{ uri: thumbnail.uri }} style={{ width: "100%", height: "100%", borderRadius: 16 }} resizeMode="cover" />
										)}
										{thumbnail.type === 'video' && (
											<View style={composerStyles.thumbnailVideoBadge}>
												<Ionicons name="play" size={8} color="#fff" />
											</View>
										)}
									</>
								) : (
									<View style={composerStyles.thumbnailEmpty}>
										<Ionicons name="image-outline" size={24} color={theme.muted} />
										<Text style={{ color: theme.muted, fontSize: 10, marginTop: 6, fontWeight: '600' }}>THUMBNAIL</Text>
									</View>
								)}
							</View>
							<Text style={{ color: theme.muted, fontSize: 11, textAlign: 'center', marginTop: 6 }}>
								{thumbnail ? 'Tap to change' : 'Add thumbnail'}
							</Text>
						</TouchableOpacity>
					</View>

					{/* Media Thumbnails Strip */}
					{payloadMedia.length > 1 ? (
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={{ paddingTop: 16, gap: 10 }}
						>
							{payloadMedia.map((item, index) => (
								<TouchableOpacity
									key={`${item.id}-composer-thumb`}
									onPress={() => {
										Haptics.selectionAsync().catch(() => {});
										setActiveMediaIndex(index);
									}}
									style={[composerStyles.thumbWrapModern, activeMediaIndex === index && composerStyles.thumbActiveModern]}
								>
									{item.type === "image" ? (
										<Image source={{ uri: item.editedUri ?? item.uri }} style={composerStyles.thumbImgModern} />
									) : (
										<View style={{ position: 'relative' }}>
											<Video
												source={{ uri: item.editedUri ?? item.uri }}
												style={composerStyles.thumbImgModern}
												resizeMode={ResizeMode.COVER}
												shouldPlay={false}
												isLooping={false}
												isMuted
											/>
											<View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: 3 }}>
												<Ionicons name="videocam" size={10} color="#fff" />
											</View>
										</View>
									)}
								</TouchableOpacity>
							))}
						</ScrollView>
					) : null}
				</View>

				{/* Form Fields Card */}
				<View style={[composerStyles.formCard, { backgroundColor: theme.card }]}>
					{/* Caption */}
					<View style={composerStyles.fieldBlockModern}>
						<Text style={[composerStyles.fieldLabelModern, { color: theme.muted }]}>Caption</Text>
						<TextInput
							value={caption}
							onChangeText={setCaption}
							placeholder={draft?.publishTarget === 'location' ? 'Describe this place for others...' : 'Write something memorable…'}
							placeholderTextColor={theme.muted}
							multiline
							style={[composerStyles.captionInputModern, { color: theme.text, borderColor: theme.hair }]}
						/>
					</View>

					{/* Label & Quality Row - two fields side by side */}
					<View style={{ flexDirection: 'row', gap: 16 }}>
						<View style={[composerStyles.fieldBlockModern, { flex: 1 }]}>
							<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
								<Text style={[composerStyles.fieldLabelModern, { color: theme.muted }]}>
									Label <Text style={{ color: '#FF4D4F' }}>*</Text>
								</Text>
							</View>
							<TouchableOpacity
								onPress={() => {
									Haptics.selectionAsync().catch(() => {});
									setLabelSheetOpen(true);
								}}
								style={[composerStyles.inlineInputModern, { borderColor: !label.trim() ? '#FF4D4F40' : theme.hair, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
							>
								<Text style={{ color: label ? theme.text : theme.muted, flex: 1 }} numberOfLines={1}>
									{label || 'Select a label...'}
								</Text>
								<Ionicons name="chevron-down" size={16} color={theme.muted} />
							</TouchableOpacity>
						</View>
						<View style={[composerStyles.fieldBlockModern, { flex: 1 }]}>
							<Text style={[composerStyles.fieldLabelModern, { color: theme.muted }]}>Quality</Text>
							<View style={{ flexDirection: 'row', gap: 8 }}>
								<TouchableOpacity 
									onPress={() => {
										Haptics.selectionAsync().catch(() => {});
										setPublishQuality('compressed');
									}} 
									style={[composerStyles.qualityBtnModern, publishQuality === 'compressed' && composerStyles.qualityBtnActiveModern]}
								>
									<Text style={{ color: publishQuality === 'compressed' ? '#000' : theme.muted, fontWeight: '700', fontSize: 13 }}>Compressed</Text>
								</TouchableOpacity>
								<TouchableOpacity 
									onPress={() => {
										Haptics.selectionAsync().catch(() => {});
										setPublishQuality('hd');
									}} 
									style={[composerStyles.qualityBtnModern, publishQuality === 'hd' && composerStyles.qualityBtnActiveModern]}
								>
									<Text style={{ color: publishQuality === 'hd' ? '#000' : theme.muted, fontWeight: '700', fontSize: 13 }}>HD</Text>
								</TouchableOpacity>
							</View>
						</View>
					</View>

					{/* Partners & Expiry Row - two fields side by side */}
					<View style={{ flexDirection: 'row', gap: 16 }}>
						<View style={[composerStyles.fieldBlockModern, { flex: 1 }]}>
							<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
								<Text style={[composerStyles.fieldLabelModern, { color: theme.muted }]}>Partners</Text>
								<TouchableOpacity onPress={() => {
									setPartnerSearch("");
									setPartnerResults([]);
									setPartnerSheetOpen(true);
									Haptics.selectionAsync().catch(() => {});
								}}>
									<Ionicons name="add-circle" size={20} color={theme.accent} />
								</TouchableOpacity>
							</View>
							{selectedPartners.length ? (
								<View style={composerStyles.partnerRowModern}>
									{selectedPartners.slice(0, 3).map((partner) => (
										partner.avatar_url ? (
											<Image key={partner.id} source={{ uri: partner.avatar_url }} style={composerStyles.partnerAvatarModern} />
										) : (
											<View key={partner.id} style={[composerStyles.partnerAvatarModern, composerStyles.partnerFallbackModern]}>
												<Ionicons name="person" size={12} color="#fff" />
											</View>
										)
									))}
									{selectedPartners.length > 3 && (
										<View style={[composerStyles.partnerAvatarModern, { backgroundColor: theme.accent }]}>
											<Text style={{ color: '#000', fontSize: 10, fontWeight: '800' }}>+{selectedPartners.length - 3}</Text>
										</View>
									)}
									<TouchableOpacity onPress={clearPartners}>
										<Ionicons name="close-circle" size={18} color="#FF4D4F" />
									</TouchableOpacity>
								</View>
							) : (
								<Text style={{ color: theme.muted, fontSize: 12 }}>Tag collaborators</Text>
							)}
						</View>

						<View style={[composerStyles.fieldBlockModern, { flex: 1 }]}>
							<Text style={[composerStyles.fieldLabelModern, { color: theme.muted }]}>Expires</Text>
							<ScrollView horizontal showsHorizontalScrollIndicator={false}>
								<View style={{ flexDirection: 'row', gap: 6 }}>
									{EXPIRY_OPTIONS.map((choice) => {
										const active = expiryChoice === choice;
										const displayLabel = choice === 'custom' ? '⏱' : choice;
										return (
											<TouchableOpacity
												key={choice}
												onPress={() => {
													Haptics.selectionAsync().catch(() => {});
													setExpiryChoice(choice);
												}}
												style={[composerStyles.expiryChipModern, active && composerStyles.expiryChipActiveModern]}
											>
												<Text style={{ color: active ? '#000' : theme.muted, fontWeight: '700', fontSize: 12 }}>{displayLabel}</Text>
											</TouchableOpacity>
										);
									})}
								</View>
							</ScrollView>
							{/* Custom hours input */}
							{expiryChoice === 'custom' && (
								<View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
									<TextInput
										value={customExpiryHours ? String(customExpiryHours) : ''}
										onChangeText={(text) => {
											const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
											setCustomExpiryHours(isNaN(num) ? null : Math.min(720, Math.max(1, num)));
										}}
										placeholder="Hours"
										placeholderTextColor={theme.muted}
										keyboardType="number-pad"
										style={[composerStyles.customHoursInput, { color: theme.text, borderColor: theme.hair }]}
										maxLength={3}
									/>
									<Text style={{ color: theme.muted, fontSize: 12 }}>hours (1-720)</Text>
								</View>
							)}
						</View>
					</View>

					{/* Location Field */}
					<View style={composerStyles.fieldBlockModern}>
						<Text style={[composerStyles.fieldLabelModern, { color: theme.muted }]}>Location</Text>
						<TouchableOpacity
							style={[composerStyles.inlineInputModern, { borderColor: theme.hair, flexDirection: "row", alignItems: "center" }]}
							onPress={() => setLocationSheetOpen(true)}
						>
							<Ionicons name="location-outline" size={18} color={theme.accent} />
							<Text style={{ marginLeft: 10, color: location ? theme.text : theme.muted, flex: 1 }} numberOfLines={1}>
								{location ? location : (draft?.publishTarget === 'location' ? 'Pick or search locations (required)' : 'Add a place')}
							</Text>
							<Ionicons name="chevron-forward" size={16} color={theme.muted} />
						</TouchableOpacity>
						{location ? (
							<TouchableOpacity
								onPress={() => {
									setLocation("");
									setLocationCoords(null);
									setLocationQuery("");
									setLocationPlaceId(null);
									setLocationPostId(null);
								}}
								style={{ marginTop: 8 }}
							>
								<Text style={{ color: "#FF4D4F", fontWeight: "700", fontSize: 12 }}>Clear location</Text>
							</TouchableOpacity>
						) : null}
						{/* When publishing to Location, show recent/searchable entries from DB so user can choose an existing location */}
						{draft?.publishTarget === 'location' ? (
							<View style={{ marginTop: 12, borderRadius: 12, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: 12 }}>
								{locationResultsLoading ? (
									<View style={{ paddingVertical: 12, alignItems: 'center' }}>
										<ActivityIndicator />
									</View>
								) : locationResults.length ? (
									<View style={{ maxHeight: 200 }}>
										<ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
											{locationResults.map((item: any) => (
												<TouchableOpacity
													key={String(item.id)}
													onPress={() => {
														setLocation(String(item.place ?? item.label ?? ''));
														setLocationPostId(String(item.id));
														setLocationPlaceId(null);
														if (typeof item.latitude === 'number' && typeof item.longitude === 'number') {
															setLocationCoords({ lat: Number(item.latitude), lng: Number(item.longitude) });
														} else {
															const pos = item.position ?? null;
															if (pos && (typeof pos.x === 'number' || typeof pos.y === 'number')) {
																const nx = Number(pos.x);
																const ny = Number(pos.y);
																const lat = Math.max(-85, Math.min(85, (ny * 180) - 90));
																const lng = Math.max(-180, Math.min(180, (nx * 360) - 180));
																setLocationCoords({ lat, lng });
															} else {
																setLocationCoords(null);
															}
														}
														setLocationSheetOpen(false);
													}}
													style={{ paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, marginBottom: 8, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', flexDirection: 'row', alignItems: 'center', gap: 10 }}
												>
													{item.images?.[0] ? (
														<Image source={{ uri: item.images?.[0] }} style={{ width: 48, height: 64, borderRadius: 8 }} />
													) : (
														<View style={{ width: 48, height: 64, borderRadius: 8, backgroundColor: theme.hair, alignItems: 'center', justifyContent: 'center' }}>
															<Ionicons name="location" size={20} color={theme.muted} />
														</View>
													)}
													<View style={{ flex: 1 }}>
														<Text style={{ fontWeight: '700', color: theme.text, fontSize: 14 }}>{item.place}</Text>
														<Text style={{ color: theme.muted, fontSize: 12 }}>{item.country}</Text>
													</View>
													<Ionicons name="chevron-forward" size={16} color={theme.muted} />
												</TouchableOpacity>
											))}
										</ScrollView>
									</View>
								) : (
									<View style={{ paddingVertical: 8, alignItems: 'center' }}>
										<Text style={{ color: theme.muted, fontSize: 12, textAlign: 'center' }}>No matching locations. Search above to add a new place.</Text>
									</View>
								)}
							</View>
						) : null}
					</View>

					{/* Soundtrack Field */}
					<View style={composerStyles.fieldBlockModern}>
						<Text style={[composerStyles.fieldLabelModern, { color: theme.muted }]}>Soundtrack</Text>
						<TouchableOpacity
							style={[composerStyles.inlineInputModern, { borderColor: theme.hair, flexDirection: "row", alignItems: "center" }]}
							onPress={() => {
								setMusicSheetOpen(true);
								Haptics.selectionAsync().catch(() => {});
							}}
							activeOpacity={0.9}
						>
							<Ionicons name="musical-notes-outline" size={18} color={theme.accent} />
							<View style={{ marginLeft: 10, flex: 1 }}>
								{selectedMusic ? (
									<>
										<Text style={{ color: theme.text, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>{selectedMusic.title}</Text>
										{selectedMusic.artist ? (
											<Text style={{ color: theme.muted, fontSize: 12 }} numberOfLines={1}>{selectedMusic.artist}</Text>
										) : null}
									</>
								) : (
									<Text style={{ color: theme.muted }}>Choose from Sound Gallery</Text>
								)}
							</View>
							<Ionicons name="chevron-forward" size={16} color={theme.muted} />
						</TouchableOpacity>
						{selectedMusic ? (
							<View style={composerStyles.selectedMusicModern}>
								<Image
									source={{ uri: selectedMusic.artworkUrl || "https://via.placeholder.com/80x80.png?text=VELT" }}
									style={composerStyles.selectedMusicArtworkModern}
								/>
								<View style={{ flex: 1, marginLeft: 12 }}>
									<Text style={{ color: theme.text, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>{selectedMusic.title}</Text>
									{selectedMusic.artist ? (
										<Text style={{ color: theme.muted, fontSize: 12 }} numberOfLines={1}>{selectedMusic.artist}</Text>
									) : null}
								</View>
								<TouchableOpacity style={composerStyles.clearMusicBtnModern} onPress={handleClearMusic}>
									<Ionicons name="close" size={14} color="#fff" />
								</TouchableOpacity>
							</View>
						) : null}
					</View>
				</View>
			</ScrollView>

			<View style={[composerStyles.bottomBarModern, { borderTopColor: theme.hair, backgroundColor: theme.bg }]}> 
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
					<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' }} />
					<Text style={{ color: theme.muted, fontSize: 13 }}>{payloadMedia.length} clip{payloadMedia.length !== 1 ? 's' : ''} ready</Text>
				</View>
				<TouchableOpacity
					disabled={publishDisabled || publishing}
					onPress={() => {
						Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
						handlePublish();
					}}
					style={[(publishDisabled || publishing) && { opacity: 0.5 }]}
				>
					<LinearGradient
						colors={GRADIENTS.accent}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={composerStyles.publishBtnModern}
					>
						<Text style={composerStyles.publishTextModern}>{publishing ? "Starting…" : "Publish"}</Text>
						<Ionicons name="arrow-forward" size={16} color="#000" />
					</LinearGradient>
				</TouchableOpacity>
			</View>

			<PartnerSheet
				visible={partnerSheetOpen}
				onClose={() => setPartnerSheetOpen(false)}
				searchValue={partnerSearch}
				onSearchChange={setPartnerSearch}
				results={partnerResults}
				selected={selectedPartners}
				onToggle={toggleSelectPartner}
				colors={theme}
			/>

			<LocationSheet
				visible={locationSheetOpen}
				onClose={() => setLocationSheetOpen(false)}
				query={locationQuery}
				onQueryChange={setLocationQuery}
				options={locationOptions}
				loading={locationLoading}
				onSelect={(option) => {
					setLocation(option.label);
					setLocationCoords(option.coords);
					setLocationQuery(option.label);
					// record google Place ID when present; clear any DB post selection
					setLocationPlaceId(option.placeId ?? null);
					setLocationPostId(null);
					setLocationSheetOpen(false);
				}}
				onUseCurrent={handleUseCurrentLocation}
				colors={theme}
			/>

			<MusicSheet
				visible={musicSheetOpen}
				onClose={() => setMusicSheetOpen(false)}
				trackSearch={trackSearch}
				onSearchChange={setTrackSearch}
				soundtracks={soundtracks}
				tracksLoading={tracksLoading}
				selectedMusic={selectedMusic}
				playingTrackId={playingTrackId}
				playLoadingId={playLoadingId}
				onTogglePreview={toggleTrackPreview}
				onSelectTrack={handleSelectTrack}
				onOpenGallery={handleOpenSoundGallery}
				eqScales={eqScales}
				playbackAnim={playbackAnim}
				colors={theme}
			/>

												{/* Thumbnail Picker Sheet */}
												<Modal visible={thumbnailSheetOpen} transparent animationType="none" onRequestClose={() => setThumbnailSheetOpen(false)}>
													<TouchableWithoutFeedback onPress={() => setThumbnailSheetOpen(false)}>
														<View style={composerStyles.sheetOverlay} />
													</TouchableWithoutFeedback>
													<Animated.View style={[composerStyles.bottomSheet, { backgroundColor: theme.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 }]}>
								<View style={{ alignItems: "center", paddingVertical: 12 }}>
									<View style={{ width: 40, height: 4, backgroundColor: theme.hair, borderRadius: 2 }} />
								</View>
								<Text style={{ color: theme.text, fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 20 }}>
									Choose Thumbnail
								</Text>
								<Text style={{ color: theme.muted, fontSize: 13, textAlign: "center", marginBottom: 20, paddingHorizontal: 20 }}>
									Add a thumbnail that will appear on the home screen. Video thumbnails will loop for 5 seconds.
								</Text>
								<TouchableOpacity 
									onPress={handlePickThumbnailImage}
									style={{ 
										flexDirection: "row", 
										alignItems: "center", 
										paddingVertical: 16, 
										paddingHorizontal: 20,
										borderTopWidth: 1,
										borderTopColor: theme.hair,
									}}
								>
									<View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: theme.accent + "20", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
										<Ionicons name="image" size={22} color={theme.accent} />
									</View>
									<View style={{ flex: 1 }}>
										<Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>Image Thumbnail</Text>
										<Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>Use a static image as thumbnail</Text>
									</View>
									<Ionicons name="chevron-forward" size={20} color={theme.muted} />
								</TouchableOpacity>
								<TouchableOpacity 
									onPress={handlePickThumbnailVideo}
									style={{ 
										flexDirection: "row", 
										alignItems: "center", 
										paddingVertical: 16, 
										paddingHorizontal: 20,
										borderTopWidth: 1,
										borderTopColor: theme.hair,
									}}
								>
									<View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#FF6B35" + "20", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
										<Ionicons name="videocam" size={22} color="#FF6B35" />
									</View>
									<View style={{ flex: 1 }}>
										<Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>Video Thumbnail</Text>
										<Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>Use a 5-second looping video</Text>
									</View>
									<Ionicons name="chevron-forward" size={20} color={theme.muted} />
								</TouchableOpacity>
								{thumbnail && (
									<TouchableOpacity 
										onPress={() => { handleClearThumbnail(); setThumbnailSheetOpen(false); }}
										style={{ 
											flexDirection: "row", 
											alignItems: "center", 
											paddingVertical: 16, 
											paddingHorizontal: 20,
											borderTopWidth: 1,
											borderTopColor: theme.hair,
										}}
									>
										<View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#FF4D4F" + "20", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
											<Ionicons name="trash" size={22} color="#FF4D4F" />
										</View>
										<View style={{ flex: 1 }}>
											<Text style={{ color: "#FF4D4F", fontSize: 16, fontWeight: "700" }}>Remove Thumbnail</Text>
											<Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>Use default media as preview</Text>
										</View>
									</TouchableOpacity>
								)}
								<TouchableOpacity 
									onPress={() => setThumbnailSheetOpen(false)}
									style={{ 
										marginHorizontal: 20,
										marginTop: 16,
										paddingVertical: 14,
										borderRadius: 12,
										backgroundColor: theme.hair,
										alignItems: "center",
									}}
								>
									<Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>Cancel</Text>
								</TouchableOpacity>
							</Animated.View>
						</Modal>

			{/* Label Picker Sheet */}
			<Modal visible={labelSheetOpen} transparent animationType="slide" onRequestClose={() => setLabelSheetOpen(false)}>
				<TouchableWithoutFeedback onPress={() => setLabelSheetOpen(false)}>
					<View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
						<TouchableWithoutFeedback>
							<View style={{ 
								backgroundColor: theme.card, 
								borderTopLeftRadius: 24, 
								borderTopRightRadius: 24,
								paddingTop: 12,
								paddingBottom: 34,
								maxHeight: '70%',
							}}>
								{/* Handle */}
								<View style={{ alignItems: 'center', marginBottom: 12 }}>
									<View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.hair }} />
								</View>
								
								{/* Title */}
								<View style={{ paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.hair }}>
									<Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Select a Label</Text>
									<Text style={{ fontSize: 13, color: theme.muted, marginTop: 4 }}>
										Choose what best describes your story
									</Text>
								</View>
								
								{/* Labels Grid */}
								<ScrollView 
									contentContainerStyle={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}
									showsVerticalScrollIndicator={false}
								>
									{PREDEFINED_LABELS.map((labelOption) => {
										const isSelected = label === labelOption;
										return (
											<TouchableOpacity
												key={labelOption}
												onPress={() => {
													Haptics.selectionAsync().catch(() => {});
													setLabel(labelOption);
													setLabelSheetOpen(false);
												}}
												style={{
													paddingHorizontal: 16,
													paddingVertical: 10,
													borderRadius: 20,
													backgroundColor: isSelected ? VELT_ACCENT : theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
													borderWidth: 1,
													borderColor: isSelected ? VELT_ACCENT : theme.hair,
												}}
											>
												<Text style={{ 
													color: isSelected ? '#000' : theme.text, 
													fontWeight: isSelected ? '700' : '500',
													fontSize: 14,
												}}>
													{labelOption}
												</Text>
											</TouchableOpacity>
										);
									})}
								</ScrollView>
								
								{/* Cancel Button */}
								<TouchableOpacity 
									onPress={() => setLabelSheetOpen(false)}
									style={{ 
										marginHorizontal: 20,
										marginTop: 12,
										paddingVertical: 14,
										borderRadius: 12,
										backgroundColor: theme.hair,
										alignItems: 'center',
									}}
								>
									<Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>Cancel</Text>
								</TouchableOpacity>
							</View>
						</TouchableWithoutFeedback>
					</View>
				</TouchableWithoutFeedback>
			</Modal>

			{/* Photo Editor Modal for Thumbnail */}
			{pendingThumbnailUri && (
				<PhotoEditorModal
					visible={thumbnailEditorOpen}
					asset={pendingThumbnailUri ? { uri: pendingThumbnailUri, localUri: pendingThumbnailUri, width: 0, height: 0 } : null}
					mode="cover"
					onCancel={() => {
						setThumbnailEditorOpen(false);
						setPendingThumbnailUri(null);
					}}
					onApply={handleThumbnailEdited}
					aspectPresetsOverride={[{ id: 'story', label: '9:16', ratio: 9/16 }]}
					title="Edit Thumbnail"
				/>
			)}
		</SafeAreaView>
	);
}

function UploadStoryProgress({ jobId, job }: { jobId: string; job: StoryUploadJob | null }) {
	const rawRouter = useRouter();
	const router = withSafeRouter(rawRouter);
	const { colors } = useTheme();
	const clearJob = useUploadStore((state) => state.clearJob);
	const hasRedirectedRef = useRef(false);

	const progress = job?.progress ?? 0;
	const status = job?.status ?? "pending";
	const statusMessage = job?.statusMessage ?? "Waiting to upload";
	const isSuccess = status === "success";
	const isError = status === "error";

	useEffect(() => {
		if (!jobId || !job) return;
		if (job.status === "pending") {
			startStoryUpload(jobId);
		}
	}, [jobId, job]);

	// Auto-redirect to home after 6 seconds so user can do other things while upload continues in background
	useEffect(() => {
		if (hasRedirectedRef.current) return; // Already redirected or timer started
		if (!job || isError) return; // Don't redirect if there's an error
		
		hasRedirectedRef.current = true;
		console.log('[UploadStoryProgress] Starting 6 second timer for auto-redirect');
		
		const timer = setTimeout(() => {
			console.log('[UploadStoryProgress] Timer fired, navigating to home');
			try {
				// Go back to previous screen (home) instead of creating new route
				if (rawRouter.dismissAll) {
					rawRouter.dismissAll();
				} else if (rawRouter.canGoBack?.()) {
					rawRouter.back();
				} else {
					rawRouter.replace("/(tabs)/home");
				}
			} catch (err) {
				console.warn('[UploadStoryProgress] Navigation error:', err);
				try { rawRouter.replace("/(tabs)/home"); } catch {}
			}
		}, 6000);

		return () => {
			clearTimeout(timer);
		};
	}, [rawRouter, job, isError]);

	const renderMetadata = useMemo(() => {
		if (!job) return null;
		const payload = job.payload;
		return (
			<View style={progressStyles.metaCard}> 
				<MetaRow label="Target" value={payload.publishTarget === "business" ? "Business" : payload.publishTarget === 'location' ? 'Location' : 'Stories'} colors={colors} />
				{!!payload.caption && <MetaRow label="Caption" value={payload.caption} colors={colors} />}
				{!!payload.label && <MetaRow label="Label" value={payload.label} colors={colors} />}
				{!!payload.location && <MetaRow label="Location" value={payload.location} colors={colors} />}
				{!!payload.selectedMusic?.title && <MetaRow label="Music" value={payload.selectedMusic.title} colors={colors} />}
				{payload.partners.length ? (
					<MetaRow
						label="Partners"
						value={payload.partners.map((p) => p.username || p.full_name || "@user").join(", ")}
						colors={colors}
					/>
				) : null}
			</View>
		);
	}, [job, colors]);

	const handleDone = useCallback(() => {
		// Only clear job if upload is complete (success or error)
		if (isSuccess || isError) {
			clearJob(jobId);
		}
		// Go back to previous screen (home) instead of creating new route
		// Use dismissAll to clear the stack and go back, or just back() if that fails
		try {
			if (rawRouter.dismissAll) {
				rawRouter.dismissAll();
			} else if (rawRouter.canGoBack?.()) {
				rawRouter.back();
			} else {
				rawRouter.replace("/(tabs)/home");
			}
		} catch {
			rawRouter.replace("/(tabs)/home");
		}
	}, [clearJob, jobId, rawRouter, isSuccess, isError]);

	const handleRetry = useCallback(() => {
		Haptics.selectionAsync().catch(() => {});
		startStoryUpload(jobId, { force: true });
	}, [jobId]);

	if (!job) {
		return (
			<SafeAreaView style={[progressStyles.container, { backgroundColor: colors.bg }]}> 
				<View style={progressStyles.header}> 
					<TouchableOpacity onPress={() => router.back()} style={progressStyles.headerBtn}>
						<Ionicons name="arrow-back" size={20} color={colors.text} />
					</TouchableOpacity>
					<Text style={[progressStyles.headerTitle, { color: colors.text }]}>Story upload</Text>
					<View style={{ width: 32 }} />
				</View>
				<View style={[progressStyles.emptyState, { borderColor: colors.border }]}> 
					<Ionicons name="alert-circle" size={48} color={colors.subtext} />
					<Text style={[progressStyles.emptyTitle, { color: colors.text }]}>Upload not found</Text>
					<Text style={[progressStyles.emptyBody, { color: colors.subtext }]}>Your upload session expired. Please go back and try again.</Text>
					<TouchableOpacity style={[progressStyles.ctaPrimary, { backgroundColor: colors.accent }]} onPress={() => router.replace("/explore/create_story")}>
						<Text style={progressStyles.ctaPrimaryText}>Back to camera</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={[progressStyles.container, { backgroundColor: colors.bg }]}> 
			<View style={progressStyles.header}> 
				<TouchableOpacity onPress={() => router.back()} style={progressStyles.headerBtn}>
					<Ionicons name="arrow-back" size={20} color={colors.text} />
				</TouchableOpacity>
				<Text style={[progressStyles.headerTitle, { color: colors.text }]}>Uploading story</Text>
				<View style={{ width: 32 }} />
			</View>

			<ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
				<View style={[progressStyles.progressCard, { backgroundColor: colors.card }]}> 
					<Text style={[progressStyles.statusLabel, { color: colors.subtext }]}>{status.toUpperCase()}</Text>
					<Text style={[progressStyles.statusMessage, { color: colors.text }]}>{statusMessage}</Text>
					<View style={[progressStyles.progressTrack, { backgroundColor: colors.border }]}> 
						<View style={[progressStyles.progressFill, { backgroundColor: colors.accent, width: `${Math.min(100, Math.max(0, progress))}%` }]} />
					</View>
					<View style={progressStyles.progressFooter}> 
						<Text style={{ color: colors.subtext, fontWeight: "700" }}>{Math.round(progress)}%</Text>
						{status === "uploading" ? <ActivityIndicator color={colors.accent} /> : null}
					</View>
				</View>

				{renderMetadata}

				<View style={progressStyles.actionsBlock}> 
					{isSuccess ? (
						<TouchableOpacity style={[progressStyles.ctaPrimary, { backgroundColor: colors.accent }]} onPress={handleDone}>
							<Text style={progressStyles.ctaPrimaryText}>Go to home</Text>
						</TouchableOpacity>
					) : isError ? (
						<>
							<TouchableOpacity style={[progressStyles.ctaPrimary, { backgroundColor: colors.accent }]} onPress={handleRetry}>
								<Text style={progressStyles.ctaPrimaryText}>Retry upload</Text>
							</TouchableOpacity>
							<TouchableOpacity style={[progressStyles.ctaGhost, { borderColor: colors.border }]} onPress={handleDone}>
								<Text style={[progressStyles.ctaGhostText, { color: colors.text }]}>Discard upload</Text>
							</TouchableOpacity>
						</>
					) : (
						<>
							<Text style={[progressStyles.helperText, { color: colors.subtext, marginBottom: 16 }]}>Your upload will continue in the background. Feel free to go home and do other things.</Text>
							<TouchableOpacity style={[progressStyles.ctaPrimary, { backgroundColor: colors.accent }]} onPress={handleDone}>
								<Text style={progressStyles.ctaPrimaryText}>Go to home</Text>
							</TouchableOpacity>
						</>
					)}
					{/* Publish quality selector (removed - moved into composer UI) */}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const formatLocationLabel = (address: Location.LocationGeocodedAddress, coords: StoryLocationCoords) => {
	const parts = [address.name, address.city, address.country].filter(Boolean);
	if (parts.length) return parts.join(", ");
	return `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`;
};

const formatDuration = (durationMs?: number | null) => {
	if (!durationMs || Number.isNaN(durationMs)) return "";
	const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const MetaRow = ({ label, value, colors }: { label: string; value: string; colors: any }) => (
	<View style={[progressStyles.metaRow, { borderColor: colors.border }]}> 
		<Text style={[progressStyles.metaLabel, { color: colors.subtext }]}>{label}</Text>
		<Text style={[progressStyles.metaValue, { color: colors.text }]} numberOfLines={2}>
			{value}
		</Text>
	</View>
);

type SheetBaseProps = {
	visible: boolean;
	onClose: () => void;
	colors: {
		card: string;
		bg: string;
		text: string;
		muted: string;
		accent: string;
		hair: string;
		isDark: boolean;
	};
};

function PartnerSheet({ visible, onClose, searchValue, onSearchChange, results, selected, onToggle, colors }: SheetBaseProps & {
	searchValue: string;
	onSearchChange: (value: string) => void;
	results: ProfileShort[];
	selected: ProfileShort[];
	onToggle: (partner: ProfileShort) => void;
}) {
	return (
		<Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
			<TouchableWithoutFeedback onPress={onClose}>
				<View style={composerStyles.sheetOverlay} />
			</TouchableWithoutFeedback>
			<Animated.View style={[composerStyles.bottomSheet, { backgroundColor: colors.card }]}> 
				<View style={composerStyles.sheetHandle} />
				<Text style={composerStyles.sheetTitle}>Tag partners</Text>
					<View style={[composerStyles.inlineInput, { borderColor: colors.hair, flexDirection: "row", alignItems: "center" }]}> 
						<Ionicons name="search" size={16} color={colors.muted} />
						<TextInput
							value={searchValue}
							onChangeText={onSearchChange}
							placeholder="Search name or username"
							placeholderTextColor={colors.muted}
							style={{ flex: 1, marginLeft: 8, color: colors.text }}
						/>
					</View>
					{results.length === 0 ? (
						<Text style={{ color: colors.muted, textAlign: "center", marginTop: 24 }}>Start typing to search users.</Text>
					) : (
						<FlatList
							data={results}
							keyExtractor={(item) => item.id}
							keyboardShouldPersistTaps="handled"
							renderItem={({ item }) => {
								const selectedState = selected.some((p) => p.id === item.id);
								return (
									<TouchableOpacity style={composerStyles.partnerItem} onPress={() => onToggle(item)}>
										{item.avatar_url ? (
											<Image source={{ uri: item.avatar_url }} style={composerStyles.partnerAvatar} />
										) : (
											<View style={[composerStyles.partnerAvatar, composerStyles.partnerFallback]}>
												<Ionicons name="person" size={16} color="#fff" />
											</View>
										)}
										<View style={{ flex: 1 }}>
											<Text style={{ fontWeight: "700", color: colors.text }}>{item.full_name ?? item.username ?? "User"}</Text>
											{item.username ? <Text style={{ color: colors.muted }}>@{item.username}</Text> : null}
										</View>
										<Ionicons name={selectedState ? "checkmark-circle" : "ellipse-outline"} size={20} color={selectedState ? colors.accent : colors.muted} />
									</TouchableOpacity>
								);
							}}
						/>
					)}
			</Animated.View>
		</Modal>
	);
}

function LocationSheet({ visible, onClose, query, onQueryChange, options, loading, onSelect, onUseCurrent, colors }: SheetBaseProps & {
	query: string;
	onQueryChange: (value: string) => void;
	options: LocationSuggestion[];
	loading: boolean;
	onSelect: (option: LocationSuggestion) => void;
	onUseCurrent: () => void;
}) {
	return (
		<Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
			<TouchableWithoutFeedback onPress={onClose}>
				<View style={composerStyles.sheetOverlay} />
			</TouchableWithoutFeedback>
			<Animated.View style={[composerStyles.bottomSheet, { backgroundColor: colors.card, maxHeight: Dimensions.get("window").height * 0.7 }]}> 
				<View style={composerStyles.sheetHandle} />
				<Text style={composerStyles.sheetTitle}>Location</Text>
					<View style={[composerStyles.inlineInput, { borderColor: colors.hair, flexDirection: "row", alignItems: "center" }]}> 
						<Ionicons name="search" size={16} color={colors.muted} />
						<TextInput
							value={query}
							onChangeText={onQueryChange}
							placeholder="Search places"
							placeholderTextColor={colors.muted}
							style={{ flex: 1, marginLeft: 8, color: colors.text }}
						/>
					</View>
					<TouchableOpacity style={composerStyles.sheetLinkRow} onPress={onUseCurrent}>
						<Ionicons name="locate" size={18} color={colors.accent} />
						<Text style={{ color: colors.accent, marginLeft: 8 }}>Use current location</Text>
					</TouchableOpacity>
					{loading ? (
						<ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
					) : options.length ? (
						<FlatList
							data={options}
							keyExtractor={(item) => item.label}
							keyboardShouldPersistTaps="handled"
							renderItem={({ item }) => (
								<TouchableOpacity style={composerStyles.locationOption} onPress={() => onSelect(item)}>
									<Ionicons name="location-outline" size={16} color={colors.muted} />
									<Text style={{ marginLeft: 8, color: colors.text }}>{item.label}</Text>
								</TouchableOpacity>
							)}
						/>
					) : (
						<Text style={{ color: colors.muted, marginTop: 12 }}>No suggestions yet.</Text>
					)}
			</Animated.View>
		</Modal>
	);
}

function MusicSheet({
	visible,
	onClose,
	trackSearch,
	onSearchChange,
	soundtracks,
	tracksLoading,
	selectedMusic,
	playingTrackId,
	playLoadingId,
	onTogglePreview,
	onSelectTrack,
	onOpenGallery,
	eqScales,
	playbackAnim,
	colors,
}: SheetBaseProps & {
	trackSearch: string;
	onSearchChange: (value: string) => void;
	soundtracks: SoundtrackRow[];
	tracksLoading: boolean;
	selectedMusic: StoryUploadSelectedMusic | null;
	playingTrackId: string | null;
	playLoadingId: string | null;
	onTogglePreview: (track: SoundtrackRow) => void;
	onSelectTrack: (track: SoundtrackRow) => void;
	onOpenGallery: () => void;
	eqScales: number[];
	playbackAnim: Animated.Value;
}) {
	return (
		<Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
			<TouchableWithoutFeedback onPress={onClose}>
				<View style={composerStyles.sheetOverlay} />
			</TouchableWithoutFeedback>
			<Animated.View style={[composerStyles.bottomSheet, { backgroundColor: colors.card }]}> 
					<View style={composerStyles.sheetHandle} />
					<View style={composerStyles.musicSheetHeader}>
						<Text style={[composerStyles.sheetTitle, { marginBottom: 0 }]}>Soundtrack</Text>
						<TouchableOpacity style={[composerStyles.uploadChip, { borderColor: colors.hair }]} onPress={onOpenGallery}>
							<Ionicons name="musical-notes" size={16} color={colors.accent} />
							<Text style={{ color: colors.accent, marginLeft: 6 }}>Open gallery</Text>
						</TouchableOpacity>
					</View>
					<View style={[composerStyles.musicSearchRow, { borderColor: colors.hair, backgroundColor: colors.bg }]}> 
						<Ionicons name="search" size={16} color={colors.muted} />
						<TextInput
							value={trackSearch}
							onChangeText={onSearchChange}
							placeholder="Search title or artist"
							placeholderTextColor={colors.muted}
							style={{ flex: 1, marginLeft: 8, color: colors.text }}
							returnKeyType="search"
						/>
						{trackSearch ? (
							<TouchableOpacity onPress={() => onSearchChange("")}>
								<Ionicons name="close-circle" size={16} color={colors.muted} />
							</TouchableOpacity>
						) : null}
						{/* Share to Location moved to the Publishing row */}
					</View>
					{tracksLoading ? (
						<View style={composerStyles.musicEmptyState}>
							<ActivityIndicator color={colors.accent} />
							<Text style={{ color: colors.muted, marginTop: 12 }}>Loading sounds…</Text>
						</View>
					) : soundtracks.length === 0 ? (
						<View style={composerStyles.musicEmptyState}>
							<Ionicons name="musical-notes-outline" size={22} color={colors.muted} />
							<Text style={{ color: colors.muted, marginTop: 8, textAlign: "center" }}>
								Upload a soundtrack from Sound Gallery to reuse here.
							</Text>
						</View>
					) : (
						<FlatList
							data={soundtracks}
							keyExtractor={(item) => item.id}
							keyboardShouldPersistTaps="handled"
							showsVerticalScrollIndicator={false}
							contentContainerStyle={{ paddingBottom: 60 }}
							ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
							renderItem={({ item }) => {
								const active = selectedMusic?.id === item.id;
								const playing = playingTrackId === item.id;
								const durationLabel = formatDuration(item.duration_ms);
								return (
									<TouchableOpacity
										activeOpacity={0.85}
										onPress={() => onSelectTrack(item)}
										style={[
											composerStyles.trackRow,
											{
												borderColor: active ? colors.accent : colors.hair,
												backgroundColor: colors.isDark ? "rgba(255,255,255,0.04)" : "#fff",
											},
										]}
									>
										<View style={composerStyles.trackRowMain}>
											<Image
												source={{ uri: item.artwork_url || selectedMusic?.artworkUrl || "https://via.placeholder.com/120x120.png?text=VELT" }}
												style={composerStyles.trackArtwork}
											/>
											<View style={{ flex: 1, marginLeft: 12 }}>
												<Text style={{ color: colors.text, fontWeight: "800" }} numberOfLines={1}>{item.title}</Text>
												<Text style={{ color: colors.muted, marginTop: 2 }} numberOfLines={1}>
													{item.artist_name ?? "Unknown artist"}
												</Text>
												{durationLabel ? (
													<Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{durationLabel}</Text>
												) : null}
											</View>
											<View style={composerStyles.trackRowActions}>
												<TouchableOpacity
													onPress={(event) => {
														event.stopPropagation();
														onTogglePreview(item);
													}}
													style={[
														composerStyles.previewBtn,
														{
															backgroundColor: playing ? colors.accent : "transparent",
															borderColor: playing ? colors.accent : colors.hair,
														},
													]}
												>
													{playLoadingId === item.id ? (
														<ActivityIndicator size="small" color={playing ? colors.card : colors.accent} />
													) : (
														<Ionicons name={playing ? "pause" : "play"} size={16} color={playing ? colors.card : colors.accent} />
													)}
												</TouchableOpacity>
												{active ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} style={{ marginLeft: 8 }} /> : null}
											</View>
										</View>
										{playing ? (
											<View style={composerStyles.eqWrap}>
												{eqScales.map((scale, idx) => (
													<Animated.View
														key={`${item.id}-${idx}`}
														style={[
															composerStyles.eqBar,
															{
																backgroundColor: colors.accent,
																transform: [
																	{
																		scaleY: playbackAnim.interpolate({ inputRange: [0, 1], outputRange: [scale * 0.45, scale] }),
																	},
																],
															},
														]}
													/>
												))}
											</View>
										) : null}
								</TouchableOpacity>
							);
						}}
						/>
					)}
			</Animated.View>
		</Modal>
	);
}

const composerStyles = StyleSheet.create({
	container: { flex: 1 },
	header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
	headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
	headerTitle: { fontSize: 18, fontWeight: "800" },
	emptyState: { flex: 1, margin: 24, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
	emptyTitle: { fontSize: 20, fontWeight: "800", marginTop: 12 },
	emptyBody: { textAlign: "center", marginTop: 6 },
	ctaPrimary: { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 8 },
	ctaPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
	
	// Modern Publish Target Pills
	targetPill: { 
		flexDirection: 'row', 
		alignItems: 'center', 
		gap: 6, 
		paddingVertical: 10, 
		paddingHorizontal: 14, 
		borderRadius: 12, 
		borderWidth: 1, 
		borderColor: 'rgba(255,255,255,0.1)',
		backgroundColor: 'rgba(255,255,255,0.03)',
	},
	targetPillActive: { 
		borderColor: '#f5b700', 
		backgroundColor: '#f5b700',
	},
	targetPillText: { fontWeight: '700', fontSize: 13, color: 'rgba(255,255,255,0.6)' },
	targetPillTextActive: { color: '#000' },
	
	// Modern Hero Preview
	heroPreviewModern: { 
		height: 280, 
		borderRadius: 20, 
		overflow: "hidden", 
		backgroundColor: '#111',
	},
	heroPreviewMedia: { width: "100%", height: "100%" },
	heroEmptyModern: { 
		height: 280, 
		borderRadius: 20, 
		borderWidth: 1, 
		borderColor: "rgba(255,255,255,0.08)", 
		justifyContent: "center", 
		alignItems: "center",
		backgroundColor: 'rgba(255,255,255,0.02)',
	},
	mediaCountBadge: {
		position: 'absolute',
		top: 12,
		left: 12,
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: 'rgba(0,0,0,0.7)',
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 20,
	},
	
	// Modern Thumbnail Preview
	thumbnailPreviewBox: {
		height: 160,
		borderRadius: 16,
		overflow: 'hidden',
		backgroundColor: 'rgba(255,255,255,0.03)',
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.08)',
	},
	thumbnailEmpty: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	thumbnailVideoBadge: {
		position: 'absolute',
		bottom: 8,
		right: 8,
		backgroundColor: 'rgba(0,0,0,0.7)',
		paddingHorizontal: 6,
		paddingVertical: 4,
		borderRadius: 6,
	},
	
	// Modern Media Thumbnails
	thumbWrapModern: { 
		width: 56, 
		height: 56, 
		borderRadius: 10, 
		overflow: "hidden", 
		borderWidth: 2, 
		borderColor: "transparent",
		backgroundColor: '#111',
	},
	thumbActiveModern: { borderColor: "#f5b700" },
	thumbImgModern: { width: "100%", height: "100%" },
	
	// Modern Form Card
	formCard: { 
		marginHorizontal: 16, 
		borderRadius: 24, 
		padding: 20,
	},
	
	// Modern Field Blocks
	fieldBlockModern: { marginBottom: 20 },
	fieldLabelModern: { fontWeight: "600", fontSize: 12, letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' },
	
	// Modern Inputs
	captionInputModern: { 
		minHeight: 80, 
		fontSize: 15, 
		borderWidth: 1, 
		borderRadius: 14, 
		paddingHorizontal: 14, 
		paddingVertical: 12,
		textAlignVertical: 'top',
	},
	inlineInputModern: { 
		borderWidth: 1, 
		borderRadius: 12, 
		paddingHorizontal: 14, 
		paddingVertical: 12,
	},
	
	// Modern Quality Buttons
	qualityBtnModern: { 
		flex: 1, 
		paddingVertical: 10, 
		paddingHorizontal: 12, 
		borderRadius: 10, 
		borderWidth: 1, 
		borderColor: 'rgba(255,255,255,0.1)',
		alignItems: 'center',
	},
	qualityBtnActiveModern: { 
		backgroundColor: '#f5b700', 
		borderColor: '#f5b700',
	},
	
	// Modern Partners Row
	partnerRowModern: { 
		flexDirection: "row", 
		alignItems: "center", 
		gap: 6, 
		marginTop: 8,
	},
	partnerAvatarModern: { 
		width: 32, 
		height: 32, 
		borderRadius: 16, 
		backgroundColor: "#333", 
		alignItems: 'center',
		justifyContent: 'center',
	},
	partnerFallbackModern: { backgroundColor: "#555" },
	
	// Modern Expiry Chips
	expiryChipModern: { 
		paddingHorizontal: 12, 
		paddingVertical: 8, 
		borderRadius: 10, 
		borderWidth: 1, 
		borderColor: "rgba(255,255,255,0.1)",
	},
	expiryChipActiveModern: { 
		backgroundColor: '#f5b700', 
		borderColor: '#f5b700',
	},
	customHoursInput: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 10,
		borderWidth: 1,
		fontSize: 14,
		fontWeight: '700',
		minWidth: 70,
		textAlign: 'center',
	},
	
	// Modern Selected Music
	selectedMusicModern: {
		marginTop: 12,
		padding: 12,
		borderRadius: 14,
		backgroundColor: 'rgba(255,255,255,0.04)',
		flexDirection: 'row',
		alignItems: 'center',
	},
	selectedMusicArtworkModern: { 
		width: 44, 
		height: 44, 
		borderRadius: 10, 
		backgroundColor: "#222",
	},
	clearMusicBtnModern: { 
		width: 28, 
		height: 28, 
		borderRadius: 14, 
		backgroundColor: '#FF4D4F',
		alignItems: "center", 
		justifyContent: "center",
	},
	
	// Modern Bottom Bar
	bottomBarModern: { 
		position: "absolute", 
		left: 0, 
		right: 0, 
		bottom: 0, 
		paddingHorizontal: 20, 
		paddingVertical: 16, 
		borderTopWidth: StyleSheet.hairlineWidth, 
		flexDirection: "row", 
		justifyContent: "space-between", 
		alignItems: "center",
	},
	publishBtnModern: { 
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingHorizontal: 20, 
		paddingVertical: 12, 
		borderRadius: 24, 
		overflow: 'hidden',
	},
	publishTextModern: { color: "#000", fontWeight: "800", fontSize: 15 },
	
	// Legacy styles kept for compatibility
	heroCard: { margin: 16, padding: 16, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.02)" },
	targetBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.35)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
	targetOption: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent', marginBottom: 8 },
	targetOptionActive: { borderColor: '#f5b700', backgroundColor: 'rgba(245,183,0,0.06)' },
	targetOptionText: { fontWeight: '700' },
	qualityBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.06)' },
	targetBadgeText: { color: "#fff", fontWeight: "700", marginLeft: 6, fontSize: 12 },
	heroPreview: { height: 260, borderRadius: 20, overflow: "hidden" },
	heroEmpty: { height: 240, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.14)", justifyContent: "center", alignItems: "center" },
	thumbWrap: { width: 72, height: 72, borderRadius: 12, overflow: "hidden", marginRight: 12, borderWidth: 2, borderColor: "transparent" },
	thumbActive: { borderColor: "#f5b700" },
	thumbImg: { width: "100%", height: "100%" },
	card: { marginHorizontal: 16, marginTop: 16, borderRadius: 20, padding: 16 },
	captionInput: { flex: 1, minHeight: 90, fontSize: 16 },
	fieldBlock: { marginTop: 18 },
	fieldLabel: { fontWeight: "700", marginBottom: 6 },
	inlineInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
	musicInputRow: { flexDirection: "row", alignItems: "center" },
	musicInputContent: { marginLeft: 10, flex: 1 },
	partnerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
	partnerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#d1d5db", marginRight: 8 },
	partnerFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#6b7280" },
	expiryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
	expiryChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.18)" },
	customExpiryRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
	customExpiryInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, width: 90, height: 40 },
	selectedMusicRow: { marginTop: 12, padding: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	selectedMusicArtwork: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#222" },
	clearMusicBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
	bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
	publishBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, overflow: 'hidden' },
	publishBtnDisabled: { opacity: 0.5 },
	publishText: { color: "#000", fontWeight: "800", fontSize: 15 },
	sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
	bottomSheet: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: Dimensions.get("window").height * 0.92, minHeight: Dimensions.get("window").height * 0.8 },
	sheetHandle: { width: 56, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 12 },
	sheetTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
	partnerItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
	sheetLinkRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
	locationOption: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
	musicSheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
	uploadChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
	musicSearchRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
	musicEmptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
	trackRow: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
	trackRowMain: { flexDirection: "row", alignItems: "center" },
	trackArtwork: { width: 56, height: 56, borderRadius: 14, backgroundColor: "#1f1f1f" },
	trackRowActions: { flexDirection: "row", alignItems: "center", marginLeft: 8 },
	previewBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
	eqWrap: { flexDirection: "row", alignItems: "flex-end", height: 24, marginTop: 10 },
	eqBar: { flex: 1, marginHorizontal: 2, borderRadius: 4 },
});

const progressStyles = StyleSheet.create({
	container: { flex: 1 },
	header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
	headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
	headerTitle: { fontSize: 18, fontWeight: "800" },
	progressCard: { borderRadius: 20, padding: 20, marginBottom: 20 },
	statusLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
	statusMessage: { fontSize: 20, fontWeight: "900", marginTop: 4 },
	progressTrack: { height: 14, borderRadius: 999, overflow: "hidden", marginTop: 18 },
	progressFill: { height: "100%", borderRadius: 999 },
	progressFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
	metaCard: { borderRadius: 20, padding: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 24 },
	metaRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
	metaLabel: { fontSize: 12, textTransform: "uppercase", fontWeight: "700" },
	metaValue: { fontSize: 16, fontWeight: "600", marginTop: 3 },
	actionsBlock: { marginTop: 12 },
	ctaPrimary: { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 8 },
	ctaPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
	ctaGhost: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 12 },
	ctaGhostText: { fontWeight: "700" },
	helperText: { fontSize: 14, lineHeight: 20 },
	emptyState: { flex: 1, margin: 24, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
	emptyTitle: { fontSize: 20, fontWeight: "800", marginTop: 12 },
	emptyBody: { textAlign: "center", marginTop: 6 },
});
