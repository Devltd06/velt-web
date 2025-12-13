import { supabase as projectSupabase } from "@/lib/supabase";
import { useUploadStore } from "@/lib/store/uploadStore";
import {
	StoryUploadJob,
	StoryUploadMedia,
	StoryUploadDraft,
	StoryMediaType,
	StoryThumbnail,
	StoryUploadSelectedMusic,
	expiryIsoFromChoice,
	generateUUID,
} from "@/lib/types/storyUpload";

const CLOUD_NAME = "dpejjmjxg";
const UPLOAD_PRESET_IMAGE = "explore_post";
const UPLOAD_PRESET_VIDEO = "explore_video";
const UPLOAD_PRESET_BUSINESS_IMAGE = "business_stories";
const UPLOAD_PRESET_BUSINESS_VIDEO = "business_stories";
const UPLOAD_PRESET_AUDIO = "explore_video"; // Use video preset for audio
const runningJobs = new Set<string>();

// Duration for images converted to video with music (15 seconds)
const IMAGE_WITH_MUSIC_DURATION_SEC = 15;

const pickPreset = (type: StoryMediaType, publishTarget: StoryUploadDraft["publishTarget"]) => {
	if (type === "image") {
		return publishTarget === "business" ? UPLOAD_PRESET_BUSINESS_IMAGE : UPLOAD_PRESET_IMAGE;
	}
	return publishTarget === "business" ? UPLOAD_PRESET_BUSINESS_VIDEO : UPLOAD_PRESET_VIDEO;
};

const uploadMediaAsset = (
	jobId: string,
	index: number,
	total: number,
	localUri: string,
	type: StoryMediaType,
	preset: string,
	compress?: boolean,
) => {
	const store = useUploadStore.getState();
	const updateJob = store.updateJob;
	const computeProgress = (loaded: number, totalBytes: number) => {
		const base = 20 + Math.round((index / Math.max(total, 1)) * 60);
		const pct = base + Math.round(((loaded / totalBytes) * 60) / Math.max(total, 1));
		return Math.min(95, pct);
	};

	return new Promise<string>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${type}/upload`);
		const form = new FormData();
		form.append(
			"file",
			{
				uri: localUri,
				type: type === "image" ? "image/jpeg" : "video/mp4",
				name: `story_${Date.now()}_${index}.${type === "image" ? "jpg" : "mp4"}`,
			} as any,
		);
		form.append("upload_preset", preset);
		// If this upload is marked for server-side compression (videos), request a basic transformation
		// Cloudinary will re-encode according to the transformation — note: this doesn't reduce upload size
		// but results in a transformed stored asset. For images we typically compress client-side.
		if (compress && type === 'video') {
			// Use a conservative transform: lower quality and cap width to 1280 to reduce final file size
			form.append('transformation', JSON.stringify([{ quality: 'auto:low' }, { width: 1280, crop: 'limit' }]));
		}

		xhr.upload.onprogress = (event) => {
			if (!event.lengthComputable) return;
			const progress = computeProgress(event.loaded, event.total);
			updateJob(jobId, {
				progress,
				status: "uploading",
				statusMessage: `Uploading media ${index + 1}/${total}`,
			});
		};

		xhr.onerror = () => reject(new Error("Network error"));
		xhr.onreadystatechange = () => {
			if (xhr.readyState !== 4) return;
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					const parsed = JSON.parse(xhr.responseText);
					resolve(parsed.secure_url ?? parsed.url);
				} catch (err) {
					reject(new Error("Invalid upload response"));
				}
			} else {
				reject(new Error("Upload failed"));
			}
		};

		xhr.send(form);
	});
};

// Upload audio file to Cloudinary and return the public_id
const uploadAudioAsset = (
	jobId: string,
	localUri: string,
): Promise<{ secure_url: string; public_id: string }> => {
	const store = useUploadStore.getState();
	const updateJob = store.updateJob;

	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`);
		const form = new FormData();
		form.append(
			"file",
			{
				uri: localUri,
				type: "audio/mpeg",
				name: `audio_${Date.now()}.mp3`,
			} as any,
		);
		form.append("upload_preset", UPLOAD_PRESET_AUDIO);
		form.append("resource_type", "video"); // Audio uses video resource type in Cloudinary

		xhr.upload.onprogress = (event) => {
			if (!event.lengthComputable) return;
			updateJob(jobId, {
				statusMessage: "Uploading audio track…",
			});
		};

		xhr.onerror = () => reject(new Error("Audio upload network error"));
		xhr.onreadystatechange = () => {
			if (xhr.readyState !== 4) return;
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					const parsed = JSON.parse(xhr.responseText);
					resolve({ 
						secure_url: parsed.secure_url ?? parsed.url,
						public_id: parsed.public_id 
					});
				} catch (err) {
					reject(new Error("Invalid audio upload response"));
				}
			} else {
				reject(new Error("Audio upload failed: " + xhr.responseText));
			}
		};

		xhr.send(form);
	});
};

// Extract public_id from Cloudinary URL
const extractPublicIdFromUrl = (url: string): string | null => {
	try {
		// URL format: https://res.cloudinary.com/CLOUD_NAME/video/upload/v1234567890/PUBLIC_ID.ext
		// or: https://res.cloudinary.com/CLOUD_NAME/image/upload/v1234567890/PUBLIC_ID.ext
		const match = url.match(/\/(?:video|image|raw)\/upload\/(?:v\d+\/)?([^.]+)/);
		return match ? match[1] : null;
	} catch {
		return null;
	}
};

// Build Cloudinary URL with audio overlay for video
// This creates a transformed video URL that has the audio embedded
// Supports audio trimming via start offset and duration
const buildVideoWithAudioUrl = (
	videoUrl: string,
	audioPublicId: string,
	videoDurationSec?: number,
	audioTrimStartMs?: number | null,
	audioTrimEndMs?: number | null,
): string => {
	// Extract components from the original video URL
	const videoPublicId = extractPublicIdFromUrl(videoUrl);
	if (!videoPublicId) return videoUrl;
	
	// Build transformation: mute original video, overlay audio, loop audio if needed
	// l_video:PUBLIC_ID adds video/audio overlay
	// fl_layer_apply applies the overlay
	// ac_none mutes original audio
	// so_ (start offset) and eo_ (end offset) for trimming audio
	// Cloudinary transformation format for audio overlay on video:
	// /ac_none/l_video:AUDIO_PUBLIC_ID,so_X,eo_Y/fl_layer_apply/
	
	const encodedAudioId = audioPublicId.replace(/\//g, ':');
	
	// Build audio layer with optional trim parameters
	let audioLayerParams = `l_video:${encodedAudioId}`;
	if (audioTrimStartMs && audioTrimStartMs > 0) {
		// Convert ms to seconds for Cloudinary
		const startSec = (audioTrimStartMs / 1000).toFixed(2);
		audioLayerParams += `,so_${startSec}`;
	}
	if (audioTrimEndMs && audioTrimEndMs > 0) {
		const endSec = (audioTrimEndMs / 1000).toFixed(2);
		audioLayerParams += `,eo_${endSec}`;
	}
	
	const transformation = `ac_none/${audioLayerParams}/fl_layer_apply`;
	
	// Insert transformation into URL
	const transformedUrl = videoUrl.replace(
		'/video/upload/',
		`/video/upload/${transformation}/`
	);
	
	return transformedUrl;
};

// Build Cloudinary URL to create video from image with audio
// This converts a static image to a video with specified duration and audio
// Supports audio trimming via start offset
const buildImageToVideoWithAudioUrl = (
	imageUrl: string,
	audioPublicId: string,
	durationSec: number = IMAGE_WITH_MUSIC_DURATION_SEC,
	audioTrimStartMs?: number | null,
	audioTrimEndMs?: number | null,
): string => {
	const imagePublicId = extractPublicIdFromUrl(imageUrl);
	if (!imagePublicId) return imageUrl;
	
	const encodedAudioId = audioPublicId.replace(/\//g, ':');
	
	// Build audio layer with optional trim parameters
	let audioLayerParams = `l_video:${encodedAudioId}`;
	if (audioTrimStartMs && audioTrimStartMs > 0) {
		const startSec = (audioTrimStartMs / 1000).toFixed(2);
		audioLayerParams += `,so_${startSec}`;
	}
	if (audioTrimEndMs && audioTrimEndMs > 0) {
		const endSec = (audioTrimEndMs / 1000).toFixed(2);
		audioLayerParams += `,eo_${endSec}`;
	}
	
	// du_X sets duration, l_video:ID adds audio overlay
	// For image-to-video, we use the video endpoint with image transformation
	const transformation = `du_${durationSec}/${audioLayerParams}/fl_layer_apply`;
	
	// Change from image to video resource type and add transformation
	const transformedUrl = imageUrl
		.replace('/image/upload/', `/video/upload/${transformation}/`)
		.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '.mp4');
	
	return transformedUrl;
};

// Upload audio to Cloudinary if it's a local file, or extract public_id if it's already a URL
const prepareAudioForOverlay = async (
	jobId: string,
	music: StoryUploadSelectedMusic,
): Promise<string | null> => {
	if (!music.audioUrl) return null;
	
	// If it's already a Cloudinary URL, extract public_id
	if (music.audioUrl.includes('cloudinary.com')) {
		return extractPublicIdFromUrl(music.audioUrl);
	}
	
	// If it's a remote URL (not local file), we need to upload it to Cloudinary
	if (music.audioUrl.startsWith('http')) {
		// Upload remote URL to Cloudinary
		const store = useUploadStore.getState();
		const updateJob = store.updateJob;
		
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`);
			const form = new FormData();
			form.append("file", music.audioUrl!);
			form.append("upload_preset", UPLOAD_PRESET_AUDIO);
			form.append("resource_type", "video");

			xhr.onerror = () => reject(new Error("Audio upload network error"));
			xhr.onreadystatechange = () => {
				if (xhr.readyState !== 4) return;
				if (xhr.status >= 200 && xhr.status < 300) {
					try {
						const parsed = JSON.parse(xhr.responseText);
						resolve(parsed.public_id);
					} catch (err) {
						reject(new Error("Invalid audio upload response"));
					}
				} else {
					// If upload fails, return null (we'll skip audio overlay)
					console.warn("Audio upload failed, skipping overlay:", xhr.responseText);
					resolve(null);
				}
			};

			xhr.send(form);
		});
	}
	
	// Local file - upload to Cloudinary
	const result = await uploadAudioAsset(jobId, music.audioUrl);
	return result.public_id;
};
const mapMediaToUploadEntries = (media: StoryUploadMedia[]) =>
	media.map((item) => ({
		type: item.type,
		uri: item.editedUri ?? item.uri,
		compress: (item as any).compress ?? false,
	}));

const uploadThumbnail = async (
	jobId: string,
	thumbnail: StoryThumbnail,
	publishTarget: StoryUploadDraft["publishTarget"],
): Promise<{ url: string; type: "image" | "video" }> => {
	const store = useUploadStore.getState();
	const updateJob = store.updateJob;
	
	// If already a URL, return as-is
	if (thumbnail.uri.startsWith("http")) {
		return { url: thumbnail.uri, type: thumbnail.type };
	}
	
	const preset = thumbnail.type === "image"
		? (publishTarget === "business" ? UPLOAD_PRESET_BUSINESS_IMAGE : UPLOAD_PRESET_IMAGE)
		: (publishTarget === "business" ? UPLOAD_PRESET_BUSINESS_VIDEO : UPLOAD_PRESET_VIDEO);
	
	return new Promise<{ url: string; type: "image" | "video" }>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${thumbnail.type}/upload`);
		const form = new FormData();
		form.append(
			"file",
			{
				uri: thumbnail.uri,
				type: thumbnail.type === "image" ? "image/jpeg" : "video/mp4",
				name: `thumbnail_${Date.now()}.${thumbnail.type === "image" ? "jpg" : "mp4"}`,
			} as any,
		);
		form.append("upload_preset", preset);

		xhr.upload.onprogress = (event) => {
			if (!event.lengthComputable) return;
			const progress = Math.min(15, Math.round((event.loaded / event.total) * 15));
			updateJob(jobId, {
				progress,
				status: "uploading",
				statusMessage: "Uploading thumbnail…",
			});
		};

		xhr.onerror = () => reject(new Error("Thumbnail upload network error"));
		xhr.onreadystatechange = () => {
			if (xhr.readyState !== 4) return;
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					const parsed = JSON.parse(xhr.responseText);
					resolve({ url: parsed.secure_url ?? parsed.url, type: thumbnail.type });
				} catch (err) {
					reject(new Error("Invalid thumbnail upload response"));
				}
			} else {
				reject(new Error("Thumbnail upload failed"));
			}
		};

		xhr.send(form);
	});
};

const runInsert = async (
	job: StoryUploadJob,
	uploadedUrls: { url: string; type: StoryMediaType }[],
	thumbnailResult?: { url: string; type: "image" | "video" } | null,
	audioEmbeddedInVideo?: boolean,
) => {
	const payload = job.payload;
	const storyId = generateUUID();
	const nowISO = new Date().toISOString();
	const expire_at = expiryIsoFromChoice(payload.expiryChoice, payload.customExpiryHours);
	const mediaUrls = uploadedUrls.map((item) => item.url);
	const primaryMedia = uploadedUrls[0];
	
	// Check if original was image (before potential conversion to video with music)
	const originalWasImage = payload.media[0]?.type === "image";
	// Check if final type is video (either originally video or image converted to video with music)
	const finalIsVideo = primaryMedia?.type === "video";

	// Audio is embedded if we have audioEmbeddedInVideo flag
	// In this case, we don't need separate music_audio_url since audio is in the video file
	const shouldClearAudioUrl = audioEmbeddedInVideo;
	
	// If publishing directly as a Location post, insert to 'location_posts' and return early
	if (payload.publishTarget === 'location') {
		const place = payload.location ?? payload.label ?? 'Shared location';
		let country = 'Unknown';
		if (typeof payload.location === 'string' && payload.location.includes(',')) {
			country = payload.location.split(',').slice(-1)[0].trim() || 'Unknown';
		} else if (payload.location) {
			country = payload.location;
		}
		let avatarUrl: string | null = null;
		try {
			const { data: profile } = await projectSupabase.from('profiles').select('avatar_url').eq('id', payload.userId).maybeSingle();
			if ((profile as any)?.avatar_url) avatarUrl = (profile as any).avatar_url;
		} catch (e) {
			// ignore avatar fetch errors
		}
		
		// Separate images and videos
		const imageUrls: string[] = [];
		const videoUrls: string[] = [];
		uploadedUrls.forEach((item) => {
			if (item.type === 'video') {
				videoUrls.push(item.url);
			} else {
				imageUrls.push(item.url);
			}
		});
		
		// Determine media type based on what was uploaded
		const mediaType = videoUrls.length > 0 ? 'video' : 'image';
		
		// Use server RPC so the DB assigns a computed, non-overlapping position
		const rpcParams: Record<string, any> = {
			p_place: place,
			p_country: country || 'Unknown',
			p_images: imageUrls,
			p_videos: videoUrls,
			p_media_type: mediaType,
			p_avatar_url: avatarUrl ?? null,
			p_caption: payload.caption?.trim() ?? null,
			// The server RPC expects normalized 0..1 coordinates for position
			// (x,y). Convert user-friendly latitude/longitude into normalized
			// coordinates expected by insert_location_post so pins map
			// deterministically and avoid server-side clamping.
			p_lat: payload.locationCoords ? Math.max(0, Math.min(1, ((payload.locationCoords.lng ?? 0) + 180) / 360)) : null,
			p_lng: payload.locationCoords ? Math.max(0, Math.min(1, ((payload.locationCoords.lat ?? 0) + 90) / 180)) : null,
		};
		// also pass raw geo coordinates (latitude / longitude) to persist
		// accurate geographic pin data on the server
		if (payload.locationCoords) {
			rpcParams.p_geo_latitude = payload.locationCoords.lat;
			rpcParams.p_geo_longitude = payload.locationCoords.lng;
		}

		console.log('[storyUploader] Creating location post with params:', JSON.stringify(rpcParams, null, 2));
		const { data: inserted, error: rpcErr } = await projectSupabase.rpc('insert_location_post', rpcParams);
		
		if (rpcErr) {
			console.error('[storyUploader] Location post RPC failed:', rpcErr);
			throw new Error(rpcErr.message || 'Failed to create location post');
		}
		
		if (!inserted) {
			console.error('[storyUploader] Location post RPC returned no data');
			throw new Error('Location post was not created');
		}
		
		console.log('[storyUploader] Location post created successfully:', inserted);
		return;
	}

	const storyRow: any = {
		id: storyId,
		user_id: payload.userId,
		media_url: mediaUrls[0],
		media_type: primaryMedia?.type ?? "image",
		caption: payload.caption?.trim() || null,
		created_at: nowISO,
		expire_at,
		label: payload.label ?? null,
		location: payload.location ?? null,
		// Keep music metadata for display (title, artist)
		// Clear audio_url since audio is embedded in the video
		music_title: payload.selectedMusic?.title ?? null,
		music_audio_url: shouldClearAudioUrl ? null : (payload.selectedMusic?.audioUrl ?? null),
		music_artist: payload.selectedMusic?.artist ?? null,
		music_duration_ms: payload.selectedMusic?.durationMs ?? null,
		// For images converted to video with music, set duration to 15 seconds
		// For original videos, use actual video duration
		duration: originalWasImage && payload.selectedMusic 
			? IMAGE_WITH_MUSIC_DURATION_SEC * 1000 
			: (payload.media[0]?.durationMs ?? null),
		is_deleted: false,
		visibility: "public",
		media_urls: mediaUrls.length > 1 ? JSON.stringify(mediaUrls) : null,
		thumbnail_url: thumbnailResult?.url ?? null,
		thumbnail_type: thumbnailResult?.type ?? null,
		// Mark story as HD if the primary media item requested HD
		is_hd: payload.media[0]?.isHD ?? null,
	};

	const tableName = payload.publishTarget === "business" ? "business_stories" : "stories";
	const { error } = await projectSupabase.from(tableName).insert([storyRow]);
	if (error) {
		// Some environments may not yet have the `is_hd` column in DB (migration not applied).
		// Supabase returns PGRST204 when column is missing; fall back to inserting without is_hd.
		try {
			const msg = String(error.message ?? "").toLowerCase();
			const code = String(error.code ?? "");
			if (code === "PGRST204" || msg.includes("could not find the 'is_hd'")) {
				console.warn("storyUploader: is_hd column missing in DB, retrying insert without is_hd");
				const fallback = { ...storyRow };
				delete fallback.is_hd;
				const { error: fallbackErr } = await projectSupabase.from(tableName).insert([fallback]);
				if (fallbackErr) throw fallbackErr;
			} else {
				throw error;
			}
		} catch (e) {
			throw e;
		}
	}

	if (payload.partners?.length) {
		const partnerRows = payload.partners.map((partner) => ({
			story_id: storyId,
			partner_profile: partner.id,
		}));
		const { error: partnerError } = await projectSupabase.from("story_partnerships").insert(partnerRows);
		if (partnerError) console.warn("storyUploader partner insert", partnerError);
	}

	// location target handled above
};

export async function startStoryUpload(jobId: string, opts?: { force?: boolean }) {
	if (!jobId) return;
	if (!opts?.force && runningJobs.has(jobId)) return;
	runningJobs.add(jobId);
	const release = () => runningJobs.delete(jobId);

	const store = useUploadStore.getState();
	const job = store.jobs[jobId];
	if (!job) {
		release();
		return;
	}

	const updateJob = store.updateJob;

	try {
		const target = job.payload.publishTarget;
		updateJob(jobId, { status: "uploading", statusMessage: target === 'location' ? 'Preparing location post…' : 'Preparing media…', progress: 5, error: null });

		// Upload thumbnail first if provided
		let thumbnailResult: { url: string; type: "image" | "video" } | null = null;
		if (job.payload.thumbnail) {
			updateJob(jobId, { statusMessage: "Uploading thumbnail…", progress: 8 });
			thumbnailResult = await uploadThumbnail(jobId, job.payload.thumbnail, job.payload.publishTarget);
		}

		// Prepare audio for embedding if music is selected
		let audioPublicId: string | null = null;
		const hasMusic = !!job.payload.selectedMusic?.audioUrl;
		if (hasMusic) {
			updateJob(jobId, { statusMessage: "Preparing audio track…", progress: 12 });
			try {
				audioPublicId = await prepareAudioForOverlay(jobId, job.payload.selectedMusic!);
			} catch (audioErr) {
				console.warn("Failed to prepare audio, continuing without music embedding:", audioErr);
			}
		}

		const prepared = mapMediaToUploadEntries(job.payload.media);
		const uploaded: { url: string; type: StoryMediaType }[] = [];

		for (let i = 0; i < prepared.length; i += 1) {
			const entry = prepared[i];
			let finalUrl: string;
			let finalType: StoryMediaType = entry.type;
			
			if (entry.uri.startsWith("http")) {
				finalUrl = entry.uri;
			} else {
				const preset = pickPreset(entry.type, job.payload.publishTarget);
				finalUrl = await uploadMediaAsset(jobId, i, prepared.length, entry.uri, entry.type, preset, !!(entry as any).compress);
			}
			
			// Apply audio overlay if we have audio and this is the primary media
			if (audioPublicId && i === 0) {
				if (entry.type === "video") {
					updateJob(jobId, { statusMessage: "Embedding audio into video…", progress: 85 });
					
					// For video: mute original and overlay audio with optional trim
					finalUrl = buildVideoWithAudioUrl(
						finalUrl, 
						audioPublicId,
						job.payload.media[0]?.durationMs ? job.payload.media[0].durationMs / 1000 : undefined,
						job.payload.selectedMusic?.trimStartMs,
						job.payload.selectedMusic?.trimEndMs
					);
					// Type stays as video, but now has embedded audio
				} else if (entry.type === "image") {
					updateJob(jobId, { statusMessage: "Creating video with audio…", progress: 85 });
					
					// For image: convert to video with audio (15 seconds duration)
					finalUrl = buildImageToVideoWithAudioUrl(
						finalUrl,
						audioPublicId,
						IMAGE_WITH_MUSIC_DURATION_SEC,
						job.payload.selectedMusic?.trimStartMs,
						job.payload.selectedMusic?.trimEndMs
					);
					// Type becomes video since we're creating a video from image
					finalType = "video";
				}
			}
			
			uploaded.push({ url: finalUrl, type: finalType });
			updateJob(jobId, { progress: 20 + Math.round(((i + 1) / prepared.length) * 60), statusMessage: `Uploading media ${i + 1}/${prepared.length}` });
		}

		updateJob(jobId, { progress: 92, statusMessage: job.payload.publishTarget === 'location' ? 'Saving location post…' : 'Saving story…' });
		// Pass audioEmbedded flag so we don't store separate music_audio_url
		const audioWasEmbedded = !!audioPublicId;
		await runInsert(job, uploaded, thumbnailResult, audioWasEmbedded);

		updateJob(jobId, { progress: 100, status: "success", statusMessage: job.payload.publishTarget === 'location' ? 'Location published' : 'Story published' });
	} catch (err) {
		console.error("storyUploader", err);
		const message = err instanceof Error ? err.message : "Upload failed";
		updateJob(jobId, { status: "error", statusMessage: message, error: message });
	} finally {
		release();
	}
}
