export type StoryMediaType = "image" | "video";

export type StoryStickerInstance = {
	id: string;
	uri: string;
	x: number;
	y: number;
	scale: number;
	rotation: number;
};

export type StoryThumbnail = {
	uri: string;
	type: "image" | "video";
	durationMs?: number | null; // for video thumbnails, should be max 5000ms (5 seconds)
};

export type StoryUploadMedia = {
	id: string;
	type: StoryMediaType;
	uri: string;
	width?: number | null;
	height?: number | null;
	durationMs?: number | null;
	editedUri?: string;
	editedWidth?: number | null;
	editedHeight?: number | null;
	trim?: { startSec: number; endSec: number; durationMs: number };
	stickers?: StoryStickerInstance[];
	filterId?: string | null;
	isHD?: boolean;
	/**
	 * Optional transient flag used by upload flow to request client or server
	 * compression. Not persisted in DB schema (transient DURING upload job).
	 */
	compress?: boolean;
};

export type StoryPartner = {
	id: string;
	full_name?: string | null;
	avatar_url?: string | null;
	username?: string | null;
};

export type StoryUploadSelectedMusic = {
	id: string;
	title: string;
	audioUrl?: string | null;
	artworkUrl?: string | null;
	artist?: string | null;
	durationMs?: number | null; // Music duration in milliseconds
	// Audio trim positions (for selecting a portion of the track)
	trimStartMs?: number | null; // Start position in milliseconds
	trimEndMs?: number | null; // End position in milliseconds
};

export type StoryLocationCoords = { lat: number; lng: number };

export type ExpiryChoice = "24h" | "2d" | "3d" | "7d" | "30d" | "custom";

export type StoryUploadDraft = {
	userId: string;
	caption: string;
	media: StoryUploadMedia[];
	thumbnail?: StoryThumbnail | null;
	label?: string;
	partners: StoryPartner[];
	selectedMusic?: StoryUploadSelectedMusic | null;
	expiryChoice: ExpiryChoice;
	customExpiryHours?: number | null;
	location?: string;
	locationCoords?: StoryLocationCoords | null;
	// Optional place id (Google Place ID) when user selects a place via Google Places
	locationPlaceId?: string | null;
	// Optional pointer to an existing location post id (if user selects an existing DB location)
	locationPostId?: string | null;
	publishTarget: "stories" | "business" | "location";
};

export type UploadJobStatus = "pending" | "uploading" | "success" | "error";

export type StoryUploadJob = {
	id: string;
	payload: StoryUploadDraft;
	progress: number;
	status: UploadJobStatus;
	statusMessage?: string | null;
	error?: string | null;
	createdAt: number;
	updatedAt: number;
};

export function generateUUID() {
	const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

export function expiryIsoFromChoice(choice: ExpiryChoice, customHours?: number | null) {
	const now = Date.now();
	let durationMs = 24 * 60 * 60 * 1000;
	switch (choice) {
		case "2d":
			durationMs = 2 * 24 * 60 * 60 * 1000;
			break;
		case "3d":
			durationMs = 3 * 24 * 60 * 60 * 1000;
			break;
		case "7d":
			durationMs = 7 * 24 * 60 * 60 * 1000;
			break;
		case "30d":
			durationMs = 30 * 24 * 60 * 60 * 1000;
			break;
		case "custom":
			if (customHours && customHours > 0) durationMs = customHours * 60 * 60 * 1000;
			break;
		default:
			durationMs = 24 * 60 * 60 * 1000;
	}
	return new Date(now + durationMs).toISOString();
}