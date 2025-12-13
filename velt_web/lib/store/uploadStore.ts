import { create } from "zustand";

import type { StoryUploadDraft, StoryUploadJob, StoryUploadMedia, StoryUploadSelectedMusic } from "@/lib/types/storyUpload";
import { generateUUID } from "@/lib/types/storyUpload";

type UploadJobPatch = Partial<Omit<StoryUploadJob, "id" | "payload" | "createdAt" | "updatedAt" | "progress" >> & {
	progress?: number;
};

interface UploadDraftState {
	userId: string;
	media: StoryUploadMedia[];
	publishTarget: "stories" | "business" | "location";
	cameraSelectedMusic?: StoryUploadSelectedMusic | null;
}

interface UploadStoreState {
	jobs: Record<string, StoryUploadJob>;
	currentJobId: string | null;
	draft: UploadDraftState | null;
	createJob: (payload: StoryUploadDraft) => string;
	updateJob: (id: string, patch: UploadJobPatch) => void;
	clearJob: (id: string) => void;
	setCurrentJob: (id: string | null) => void;
	setDraft: (draft: UploadDraftState) => void;
	consumeDraft: () => UploadDraftState | null;
}

export const useUploadStore = create<UploadStoreState>((set, get) => ({
	jobs: {},
	currentJobId: null,
	draft: null,
	createJob: (payload) => {
		const id = generateUUID();
		const now = Date.now();
		set((state) => ({
			jobs: {
				...state.jobs,
				[id]: {
					id,
					payload,
					progress: 0,
					status: "pending",
					statusMessage: "Waiting to upload",
					error: null,
					createdAt: now,
					updatedAt: now,
				},
			},
			currentJobId: id,
		}));
		return id;
	},
	updateJob: (id, patch) => {
		set((state) => {
			const job = state.jobs[id];
			if (!job) return state;
			const { progress: patchProgress, ...rest } = patch;
			const nextProgress = typeof patchProgress === "number"
				? Math.min(100, Math.max(0, patchProgress))
				: job.progress;
			return {
				jobs: {
					...state.jobs,
					[id]: {
						...job,
						...rest,
						progress: nextProgress,
						updatedAt: Date.now(),
					},
				},
			};
		});
	},
	clearJob: (id) => {
		set((state) => {
			if (!state.jobs[id]) return state;
			const nextJobs = { ...state.jobs };
			delete nextJobs[id];
			return {
				jobs: nextJobs,
				currentJobId: state.currentJobId === id ? null : state.currentJobId,
			};
		});
	},
	setCurrentJob: (id) => set({ currentJobId: id }),
	setDraft: (draft) => set({ draft }),
	consumeDraft: () => {
		const current = get().draft;
		set({ draft: null });
		return current;
	},
}));
