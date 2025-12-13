import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Image,
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';
import type { FlexAlignType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { pickMediaAsync } from '@/utils/pickmedia';
import { useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';

import TabSwipeContainer from '@/components/TabSwipeContainer';
import { useTheme } from 'app/themes';
import type { ThemeColors } from 'app/themes';
import { useProfileStore } from '@/lib/store/profile';
import { supabase } from '@/lib/supabase';
import { uploadToCloudinaryLocal } from '@/utils/cloudinary';

dayjs.extend(relativeTime);

const CLOUDINARY_PRESET = 'space_upload';
const CLOUDINARY_CLOUD = 'dpejjmjxg';
const MAX_MESSAGES = 200;

type MindspaceMessage = {
	id: string;
	sender_id: string;
	sender_name: string;
	sender_avatar_url?: string | null;
	body?: string | null;
	media_url?: string | null;
	media_type?: 'image' | 'video' | null;
	created_at: string;
	reply_to?: {
		id: string;
		sender_name: string;
		body?: string | null;
	} | null;
	callout_story?: StorySummary | null;
	local?: boolean;
};

type AttachmentDraft = {
	uri: string;
	type: 'image' | 'video';
	uploadedUrl?: string | null;
};

type StorySummary = {
	id: string;
	title: string;
	cover_url?: string | null;
	author_name?: string | null;
	created_at?: string | null;
};

type BubbleColors = {
	ownBg: string;
	ownText: string;
	mutualBg: string;
	mutualText: string;
	mutualBorder: string;
	card: string;
};

const MindspaceTab: React.FC = () => {
	const { colors } = useTheme();
	const { profile } = useProfileStore();
	const router = withSafeRouter(useRouter());

	const [messages, setMessages] = useState<MindspaceMessage[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [draft, setDraft] = useState('');
	const [replyingTo, setReplyingTo] = useState<MindspaceMessage | null>(null);
	const [attachment, setAttachment] = useState<AttachmentDraft | null>(null);
	const [storyCallout, setStoryCallout] = useState<StorySummary | null>(null);
	const [storyOptions, setStoryOptions] = useState<StorySummary[]>([]);
	const [storyRowCollapsed, setStoryRowCollapsed] = useState(false);
	const [sending, setSending] = useState(false);
	const [uploadingAsset, setUploadingAsset] = useState(false);

	const listRef = useRef<FlatList<MindspaceMessage>>(null);

	const bubbleColors = useMemo<BubbleColors>(() => {
		const ownText = colors.isDark ? '#050505' : '#0f0f0f';
		return {
			ownBg: colors.accent,
			ownText,
			mutualBg: colors.card,
			mutualText: colors.text,
			mutualBorder: colors.border,
			card: colors.card,
		};
	}, [colors]);

	const normalizeMessage = useCallback((row: any): MindspaceMessage => {
		if (!row) {
			return {
				id: `local-${Date.now()}`,
				sender_id: 'unknown',
				sender_name: 'Unknown',
				body: '',
				created_at: new Date().toISOString(),
			};
		}

		const replyPresence = row.reply_to_message_id || row.reply_to_body || row.reply_to_sender_name || row.reply_to;
		const replyPayload = replyPresence
			? {
					id: String(row.reply_to_message_id ?? row.reply_to?.id ?? ''),
					sender_name: String(row.reply_to_sender_name ?? row.reply_to?.sender_name ?? 'Mutual'),
					body: row.reply_to_body ?? row.reply_to?.body ?? null,
				}
			: null;

		const calloutPresence = row.callout_story_id || row.callout_story || row.story;
		const calloutPayload = calloutPresence
			? {
					id: String(row.callout_story_id ?? row.callout_story?.id ?? row.story?.id ?? ''),
					title: row.callout_story_title ?? row.callout_story?.title ?? row.story?.caption ?? 'Story',
					cover_url:
						row.callout_story_cover_url ??
						row.callout_story?.cover_url ??
						row.callout_story?.media_url ??
						row.story?.cover_url ??
						row.story?.media_url ??
						null,
					author_name: row.callout_story_author_name ?? row.callout_story?.author_name ?? row.story?.profiles?.full_name ?? null,
					created_at: row.story?.created_at ?? row.callout_story?.created_at ?? null,
				}
			: null;

		return {
			id: String(row.id),
			sender_id: String(row.sender_id ?? row.sender?.id ?? ''),
			sender_name: row.sender_name ?? row.profiles?.full_name ?? row.sender?.full_name ?? 'Friend',
			sender_avatar_url: row.sender_avatar_url ?? row.profiles?.avatar_url ?? row.sender?.avatar_url ?? null,
			body: row.body ?? row.content ?? '',
			media_url: row.media_url ?? row.attachment_url ?? null,
			media_type: row.media_type ?? row.attachment_type ?? null,
			created_at: row.created_at ?? row.inserted_at ?? new Date().toISOString(),
			reply_to: replyPayload,
			callout_story: calloutPayload,
		};
	}, []);

	const fetchMessages = useCallback(async () => {
		try {
			const { data, error } = await supabase
				.from('mindspace_messages_view')
				.select('*')
				.order('created_at', { ascending: true })
				.limit(MAX_MESSAGES);

			if (error) {
				console.warn('[Mindspace] load error', error);
				return;
			}

			const normalized = (data ?? []).map(normalizeMessage);
			setMessages(normalized);
		} finally {
			setLoading(false);
		}
	}, [normalizeMessage]);

	const loadStoryOptions = useCallback(async () => {
		if (!profile?.id) return;
		const { data, error } = await supabase
			.from('stories')
			.select('id, caption, media_url, cover_url, created_at, profiles(full_name)')
			.eq('user_id', profile.id)
			.order('created_at', { ascending: false })
			.limit(8);

		if (error) {
			console.warn('[Mindspace] story load error', error);
			return;
		}

		const normalized = (data ?? []).map((story: any) => ({
			id: String(story.id),
			title: story.caption ?? 'Untitled story',
			cover_url: story.cover_url ?? story.media_url ?? null,
			author_name: story.profiles?.full_name ?? profile.full_name ?? 'You',
			created_at: story.created_at ?? null,
		}));
		setStoryOptions(normalized);
	}, [profile?.id, profile?.full_name]);

	useEffect(() => {
		fetchMessages();
	}, [fetchMessages]);

	useEffect(() => {
		loadStoryOptions();
	}, [loadStoryOptions]);

	useEffect(() => {
		const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
			listRef.current?.scrollToEnd({ animated: true });
		});
		const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
			listRef.current?.scrollToEnd({ animated: true });
		});
		return () => {
			showSub.remove();
			hideSub.remove();
		};
	}, []);

	useEffect(() => {
		const channel = supabase
			.channel('mindspace-feed')
			.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mindspace_messages_view' }, (payload) => {
				const incoming = normalizeMessage(payload.new);
				setMessages((prev) => {
					const exists = prev.some((msg) => msg.id === incoming.id);
					if (exists) return prev;
					const next = [...prev, incoming];
					return next.slice(-MAX_MESSAGES);
				});
			});

		channel.subscribe((status) => {
			if (status === 'CHANNEL_ERROR') {
				console.warn('[Mindspace] realtime subscribe failed due to channel error');
			}
		});

		return () => {
			channel.unsubscribe();
		};
	}, [normalizeMessage]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		await fetchMessages();
		setRefreshing(false);
	}, [fetchMessages]);

	const handlePickMedia = useCallback(async () => {
		const picked = await pickMediaAsync();
		if (!picked) return;
		setAttachment({ uri: picked.uri, type: picked.type });
	}, []);

	const openStoryPreview = useCallback(
		(story?: Pick<StorySummary, 'id'> | StorySummary | null) => {
			if (!story?.id) return;
			router.push({ pathname: '/story/preview', params: { storyId: story.id } });
		},
		[router]
	);

	const handleSend = useCallback(async () => {
		if (sending || uploadingAsset) return;
		const trimmed = draft.trim();
		if (!trimmed && !attachment && !storyCallout) return;
		if (!profile?.id) {
			Alert.alert('Profile missing', 'Please wait for your profile to finish loading.');
			return;
		}

		setSending(true);

		const attachmentSnapshot = attachment;
		const replySnapshot = replyingTo;
		const storySnapshot = storyCallout;

		let remoteMediaUrl = attachmentSnapshot?.uploadedUrl ?? null;

		try {
			if (attachmentSnapshot && !attachmentSnapshot.uploadedUrl) {
				setUploadingAsset(true);
				const uploaded = await uploadToCloudinaryLocal(
					attachmentSnapshot.uri,
					attachmentSnapshot.type,
					CLOUDINARY_PRESET,
					undefined,
					CLOUDINARY_CLOUD
				);
				remoteMediaUrl = uploaded.secure_url;
			}
		} catch (error) {
			console.warn('[Mindspace] upload failed', error);
			Alert.alert('Upload failed', 'Could not upload your media. Try again.');
			setUploadingAsset(false);
			setSending(false);
			return;
		} finally {
			setUploadingAsset(false);
		}

		const localId = `local-${Date.now()}`;
		const optimistic: MindspaceMessage = {
			id: localId,
			sender_id: profile.id,
			sender_name: profile.full_name ?? 'You',
			body: trimmed || (remoteMediaUrl ? null : ''),
			media_url: remoteMediaUrl,
			media_type: attachmentSnapshot?.type ?? null,
			created_at: new Date().toISOString(),
			reply_to: replySnapshot
				? {
						id: replySnapshot.id,
						sender_name: replySnapshot.sender_name,
						body: replySnapshot.body,
					}
				: null,
			callout_story: storySnapshot,
			local: true,
		};

		const fallbackAttachment = attachmentSnapshot && remoteMediaUrl ? { ...attachmentSnapshot, uploadedUrl: remoteMediaUrl } : attachmentSnapshot;

		setMessages((prev) => [...prev, optimistic]);
		setDraft('');
		setAttachment(null);
		setReplyingTo(null);
		setStoryCallout(null);

		const payload = {
			body: trimmed,
			sender_id: profile.id,
			media_url: remoteMediaUrl,
			media_type: attachmentSnapshot?.type ?? null,
			reply_to_message_id: replySnapshot && !replySnapshot.id.startsWith('local-') ? replySnapshot.id : null,
			callout_story_id: storySnapshot?.id ?? null,
		};

		const { error } = await supabase.from('mindspace_messages').insert([payload]);

		if (error) {
			console.warn('[Mindspace] send failed', error);
			Alert.alert('Send failed', error.message || 'Please try again.');
			setMessages((prev) => prev.filter((msg) => msg.id !== localId));
			setDraft(trimmed);
			setAttachment(fallbackAttachment);
			setStoryCallout(storySnapshot);
		} else {
			fetchMessages();
			listRef.current?.scrollToEnd({ animated: true });
		}

		setSending(false);
	}, [attachment, draft, fetchMessages, profile?.id, replyingTo, sending, storyCallout, uploadingAsset]);

	const stats = useMemo(() => {
		const contributorIds = new Set(messages.map((msg) => msg.sender_id));
		const last = messages[messages.length - 1];
		return {
			contributors: contributorIds.size,
			lastPost: last?.created_at ?? null,
			total: messages.length,
		};
	}, [messages]);

	const canSend = Boolean(draft.trim() || attachment || storyCallout) && !sending && !uploadingAsset;

	if (!profile) {
		return (
			<TabSwipeContainer swipeEnabled={false} style={{ flex: 1, backgroundColor: colors.bg }}>
				<SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
					<View style={styles.emptyState}>
						<Ionicons name="cloud-offline-outline" size={32} color={colors.subtext} />
						<Text style={[styles.emptyTitle, { color: colors.text }]}>Mind Space requires a profile</Text>
						<Text style={[styles.emptySubtitle, { color: colors.subtext }]}>Sign in to see what your mutuals are sharing.</Text>
					</View>
				</SafeAreaView>
			</TabSwipeContainer>
		);
	}

	return (
		<TabSwipeContainer swipeEnabled={false} style={{ flex: 1, backgroundColor: colors.bg }}>
			<SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}
				edges={['top', 'left', 'right']}>
				<KeyboardAvoidingView
					style={{ flex: 1 }}
					behavior={Platform.OS === 'ios' ? 'padding' : undefined}
					keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
				>
						<View style={styles.listWrapper}>
						<FlatList
							ref={listRef}
							data={messages}
							keyExtractor={(item) => item.id}
							renderItem={({ item, index }) => (
								<MindspaceBubble
									message={item}
									isOwn={item.sender_id === profile.id}
									showName={index === 0 || messages[index - 1]?.sender_id !== item.sender_id}
										colors={bubbleColors}
										onReply={() => setReplyingTo(item)}
										onOpenStory={openStoryPreview}
								/>
							)}
							contentContainerStyle={{
								paddingHorizontal: 16,
								paddingTop: 16,
								paddingBottom: 220,
							}}
							ListHeaderComponent={<MutualHeader colors={colors} stats={stats} refreshing={refreshing} onRefresh={handleRefresh} />}
							ListEmptyComponent={
								loading ? (
									<View style={styles.emptyState}>
										<ActivityIndicator color={colors.accent} />
										<Text style={[styles.emptySubtitle, { color: colors.subtext, marginTop: 12 }]}>Loading your mutual feed…</Text>
									</View>
								) : (
									<View style={styles.emptyState}>
										<Ionicons name="sparkles-outline" size={38} color={colors.subtext} />
										<Text style={[styles.emptyTitle, { color: colors.text }]}>Mind Space is quiet</Text>
										<Text style={[styles.emptySubtitle, { color: colors.subtext }]}>Ping a mutual to get the conversation moving.</Text>
									</View>
								)
							}
								refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
								keyboardShouldPersistTaps="handled"
								keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
								onScrollBeginDrag={() => Keyboard.dismiss()}
							showsVerticalScrollIndicator={false}
							onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
						/>
						<View style={[styles.composerWrapper, { backgroundColor: colors.bg }]}> 
								{storyOptions.length > 0 ? (
									<StoryCarousel
										options={storyOptions}
										selected={storyCallout}
										onSelect={(story) => setStoryCallout(story)}
										collapsed={storyRowCollapsed}
										onToggleCollapsed={() => setStoryRowCollapsed((prev) => !prev)}
										onOpenStory={openStoryPreview}
										colors={colors}
									/>
								) : null}
							<View style={[styles.composerCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
								{replyingTo ? (
									<ReplyBanner
										message={replyingTo}
										colors={colors}
										onCancel={() => setReplyingTo(null)}
									/>
								) : null}

								{attachment ? (
									<AttachmentPreview attachment={attachment} colors={colors} onRemove={() => setAttachment(null)} />
								) : null}

									{storyCallout ? (
										<StoryCalloutPreview
											story={storyCallout}
											colors={colors}
											onClear={() => setStoryCallout(null)}
											onOpen={() => openStoryPreview(storyCallout)}
										/>
									) : null}

								<View style={styles.inputRow}>
									<TextInput
										value={draft}
										onChangeText={setDraft}
										placeholder="Share a thought with mutuals…"
										placeholderTextColor={withAlpha(colors.subtext, 0.7)}
										multiline
										style={[styles.input, { color: colors.text }]}
										onFocus={() => listRef.current?.scrollToEnd({ animated: true })}
									/>
									<View style={styles.actionRow}>
										<Pressable onPress={handlePickMedia} style={styles.iconButton}>
											<Ionicons name="image-outline" size={20} color={colors.subtext} />
										</Pressable>
										<Pressable onPress={() => loadStoryOptions()} style={styles.iconButton}>
											<Ionicons name="book-outline" size={19} color={colors.subtext} />
										</Pressable>
									</View>
								</View>

								<View style={styles.bottomRow}>
									<View style={[styles.mutualPill, { borderColor: colors.border, backgroundColor: colors.faint }]}> 
										<Ionicons name="link" size={16} color={colors.accent} />
										<Text style={[styles.mutualText, { color: colors.accent }]}>Mutual stream</Text>
									</View>
									<Pressable
										style={[styles.sendButton, { backgroundColor: canSend ? colors.accent : colors.border }]}
										disabled={!canSend}
										onPress={handleSend}
									>
										{sending ? (
											<ActivityIndicator color="#fff" />
										) : (
											<Text style={[styles.sendLabel, { color: canSend ? '#fff' : colors.subtext }]}>Drop it</Text>
										)}
									</Pressable>
								</View>
							</View>
						</View>
					</View>
				</KeyboardAvoidingView>
			</SafeAreaView>
		</TabSwipeContainer>
	);
};

type MindspaceBubbleProps = {
	message: MindspaceMessage;
	isOwn: boolean;
	showName: boolean;
	colors: BubbleColors;
	onReply: () => void;
	onOpenStory: (story?: StorySummary | null) => void;
};

const MindspaceBubble: React.FC<MindspaceBubbleProps> = ({ message, isOwn, showName, colors, onReply, onOpenStory }) => {
	const bubbleAlignment = (isOwn ? 'flex-end' : 'flex-start') as FlexAlignType;
	const bubbleStyle = [
		styles.bubble,
		{
			backgroundColor: isOwn ? colors.ownBg : colors.mutualBg,
			borderColor: isOwn ? withAlpha(colors.ownBg, 0.4) : colors.mutualBorder,
			alignSelf: bubbleAlignment,
		},
	];

	const textColor = isOwn ? colors.ownText : colors.mutualText;
	const mediaOnly = Boolean(message.media_url && !message.body && !message.callout_story && !message.reply_to);

	const renderMediaAttachment = () => {
		if (!message.media_url) return null;
		if (message.media_type === 'video') {
			return (
				<View style={[styles.inlineVideo, { backgroundColor: withAlpha(colors.mutualText, 0.25) }]}> 
					<Ionicons name="play" size={30} color="#fff" />
				</View>
			);
		}
		return <Image source={{ uri: message.media_url }} style={styles.inlineImage} />;
	};

	return (
		<Pressable style={styles.bubbleWrapper} onLongPress={onReply} delayLongPress={120}>
			{!isOwn && showName ? (
				<Text style={[styles.senderName, { color: colors.mutualText }]}>{message.sender_name}</Text>
			) : null}
			{mediaOnly ? (
				<View style={{ alignSelf: bubbleAlignment }}>{renderMediaAttachment()}</View>
			) : (
				<View style={bubbleStyle}>
					{message.reply_to ? (
						<View style={[styles.replyGhost, { borderColor: isOwn ? withAlpha(colors.ownBg, 0.4) : colors.mutualBorder }]}> 
							<Text style={[styles.replyGhostAuthor, { color: textColor }]}>Replying to {message.reply_to.sender_name}</Text>
							<Text style={[styles.replyGhostBody, { color: textColor }]} numberOfLines={2}>
								{message.reply_to.body || 'Attachment'}
							</Text>
						</View>
					) : null}

					{message.body ? <Text style={[styles.bodyText, { color: textColor }]}>{message.body}</Text> : null}

					{message.media_url ? renderMediaAttachment() : null}

					{message.callout_story ? (
						<Pressable
							onPress={() => onOpenStory(message.callout_story)}
							style={[
								styles.calloutBubble,
								{ backgroundColor: isOwn ? withAlpha(colors.ownBg, 0.2) : withAlpha(colors.card, 0.9) },
							]}
						> 
							{message.callout_story.cover_url ? (
								<Image source={{ uri: message.callout_story.cover_url }} style={styles.calloutImage} />
							) : (
								<View style={styles.calloutImageFallback}>
									<Ionicons name="book-outline" size={20} color={textColor} />
								</View>
							)}
							<View style={{ flex: 1 }}>
								<Text style={[styles.calloutLabel, { color: textColor }]}>Story callout</Text>
								<Text style={[styles.calloutTitle, { color: textColor }]} numberOfLines={2}>
									{message.callout_story.title}
								</Text>
								<Text style={[styles.calloutAuthor, { color: textColor }]} numberOfLines={1}>
									{message.callout_story.author_name || 'Mutual story'}
								</Text>
							</View>
						</Pressable>
					) : null}
				</View>
			)}
			<View style={[styles.metaRow, { alignSelf: bubbleAlignment }]}>
				<Text style={[styles.timestamp, { color: withAlpha(colors.mutualText, 0.7) }]}>{dayjs(message.created_at).fromNow()}</Text>
				<Pressable onPress={onReply} hitSlop={12}>
					<Ionicons name="return-up-forward" size={16} color={withAlpha(colors.mutualText, 0.7)} />
				</Pressable>
			</View>
		</Pressable>
	);
};

type ReplyBannerProps = {
	message: MindspaceMessage;
	colors: ThemeColors;
	onCancel: () => void;
};

const ReplyBanner: React.FC<ReplyBannerProps> = ({ message, colors, onCancel }) => (
	<View style={[styles.replyBanner, { borderColor: colors.border, backgroundColor: colors.faint }]}> 
		<View style={[styles.replyLine, { backgroundColor: colors.accent }]} />
		<View style={{ flex: 1 }}>
			<Text style={[styles.replyingTo, { color: colors.subtext }]}>Replying to {message.sender_name}</Text>
			<Text style={[styles.replyingBody, { color: colors.text }]} numberOfLines={2}>
				{message.body || (message.media_url ? 'Media attachment' : 'Story attachment')}
			</Text>
		</View>
		<Pressable onPress={onCancel} hitSlop={16}>
			<Ionicons name="close" size={18} color={colors.subtext} />
		</Pressable>
	</View>
);

type AttachmentPreviewProps = {
	attachment: AttachmentDraft;
	colors: ThemeColors;
	onRemove: () => void;
};

const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ attachment, colors, onRemove }) => (
	<View style={styles.attachmentPreview}> 
		{attachment.type === 'image' ? (
			<Image source={{ uri: attachment.uri }} style={styles.attachmentImage} />
		) : (
			<View style={[styles.videoAttachment, { backgroundColor: withAlpha(colors.text, 0.15) }]}> 
				<Ionicons name="play" size={26} color={colors.text} />
			</View>
		)}
		<Pressable onPress={onRemove} style={styles.removeAttachment}>
			<Ionicons name="close" size={16} color="#fff" />
		</Pressable>
	</View>
);

type StoryCalloutPreviewProps = {
	story: StorySummary;
	colors: ThemeColors;
	onClear: () => void;
	onOpen: () => void;
};

const StoryCalloutPreview: React.FC<StoryCalloutPreviewProps> = ({ story, colors, onClear, onOpen }) => (
	<Pressable onPress={onOpen} style={[styles.storyPreview, { backgroundColor: colors.faint }]}> 
		{story.cover_url ? (
			<Image source={{ uri: story.cover_url }} style={styles.storyPreviewImage} />
		) : (
			<View style={styles.storyPreviewImage}>
				<Ionicons name="book-outline" size={18} color={colors.subtext} />
			</View>
		)}
		<View style={{ flex: 1 }}>
			<Text style={[styles.storyPreviewLabel, { color: colors.subtext }]}>Story callout</Text>
			<Text style={[styles.storyPreviewTitle, { color: colors.text }]} numberOfLines={2}>
				{story.title}
			</Text>
			<Text style={{ color: colors.subtext }} numberOfLines={1}>
				{story.author_name || 'You'}
			</Text>
		</View>
		<Pressable
			onPress={(event) => {
				event.stopPropagation();
				onClear();
			}}
			hitSlop={16}
		>
			<Ionicons name="close" size={18} color={colors.subtext} />
		</Pressable>
	</Pressable>
);

type StoryCarouselProps = {
	options: StorySummary[];
	selected: StorySummary | null;
	onSelect: (story: StorySummary | null) => void;
	collapsed: boolean;
	onToggleCollapsed: () => void;
	onOpenStory: (story: StorySummary) => void;
	colors: ThemeColors;
};

const StoryCarousel: React.FC<StoryCarouselProps> = ({ options, selected, onSelect, collapsed, onToggleCollapsed, onOpenStory, colors }) => {
	if (!options.length) return null;

	return (
		<View style={styles.storyCarousel}>
			<View style={styles.storyCarouselHeader}>
				<Text style={[styles.storyCarouselTitle, { color: colors.subtext }]}>Story callouts</Text>
				<View style={styles.storyHeaderActions}>
					{selected ? (
						<Pressable onPress={() => onSelect(null)}>
							<Text style={{ color: colors.accent }}>Clear</Text>
						</Pressable>
					) : null}
					<Pressable onPress={onToggleCollapsed} hitSlop={12}>
						<Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={18} color={colors.subtext} />
					</Pressable>
				</View>
			</View>
			{!collapsed ? (
				<ScrollView horizontal showsHorizontalScrollIndicator={false}>
					{options.map((story) => {
						const active = selected?.id === story.id;
						return (
							<Pressable
								key={story.id}
								style={[styles.storyCard, { borderColor: active ? colors.accent : colors.border, backgroundColor: colors.card }]}
								onPress={() => onSelect(active ? null : story)}
							>
								{story.cover_url ? (
									<Image source={{ uri: story.cover_url }} style={styles.storyCardImage} />
								) : (
									<View style={[styles.storyCardImage, { alignItems: 'center', justifyContent: 'center' }]}>
										<Ionicons name="image-outline" size={18} color={colors.subtext} />
									</View>
								)}
								<Text style={[styles.storyCardTitle, { color: colors.text }]} numberOfLines={2}>
									{story.title}
								</Text>
								<View style={styles.storyCardFooter}>
									<Text style={[styles.storyCardMeta, { color: colors.subtext }]}>
										{story.created_at ? dayjs(story.created_at).fromNow() : 'Recently'}
									</Text>
									<Pressable
										onPress={(event) => {
											event.stopPropagation();
											onOpenStory(story);
										}}
										hitSlop={12}
									>
										<Ionicons name="play" size={16} color={colors.accent} />
									</Pressable>
								</View>
							</Pressable>
						);
					})}
				</ScrollView>
			) : null}
		</View>
	);
};

type MutualHeaderProps = {
	colors: ThemeColors;
	stats: { contributors: number; lastPost: string | null; total: number };
	refreshing: boolean;
	onRefresh: () => Promise<void> | void;
};

const MutualHeader: React.FC<MutualHeaderProps> = ({ colors, stats, refreshing, onRefresh }) => (
	<View style={[styles.headerCard, { borderColor: colors.border, backgroundColor: colors.card }]}> 
		<View style={styles.headerRow}>
			<Text style={[styles.headerTitle, { color: colors.text }]}>Mind Space</Text>
			<View style={[styles.headerPill, { backgroundColor: colors.faint, borderColor: colors.border }]}> 
				<Ionicons name="people-outline" size={16} color={colors.accent} />
				<Text style={{ color: colors.accent }}>{stats.contributors} mutuals</Text>
			</View>
		</View>
		<View style={styles.headerStatsRow}>
			<View>
				<Text style={[styles.statLabel, { color: colors.subtext }]}>Total drops</Text>
				<Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
			</View>
			<View>
				<Text style={[styles.statLabel, { color: colors.subtext }]}>Last activity</Text>
				<Text style={[styles.statValue, { color: colors.text }]}>{stats.lastPost ? dayjs(stats.lastPost).fromNow() : '—'}</Text>
			</View>
			<Pressable onPress={onRefresh} style={[styles.refreshButton, { borderColor: colors.border }]}> 
				{refreshing ? (
					<ActivityIndicator size="small" color={colors.accent} />
				) : (
					<Ionicons name="refresh" size={18} color={colors.accent} />
				)}
			</Pressable>
		</View>
	</View>
);

const withAlpha = (hex: string, alpha: number) => {
	let color = hex.replace('#', '');
	if (color.length === 8) color = color.slice(0, 6);
	if (color.length !== 6) {
		return hex;
	}
	const r = parseInt(color.slice(0, 2), 16);
	const g = parseInt(color.slice(2, 4), 16);
	const b = parseInt(color.slice(4, 6), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default MindspaceTab;

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
	},
	listWrapper: {
		flex: 1,
	},
	emptyState: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 48,
		gap: 8,
	},
	emptyTitle: {
		fontSize: 18,
		fontWeight: '700',
	},
	emptySubtitle: {
		fontSize: 14,
		textAlign: 'center',
	},
	composerWrapper: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		padding: 12,
	},
	composerCard: {
		borderRadius: 18,
		borderWidth: 1,
		padding: 12,
		gap: 12,
	},
	inputRow: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 12,
	},
	input: {
		flex: 1,
		minHeight: 48,
		fontSize: 15,
		paddingVertical: 4,
	},
	actionRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginBottom: 4,
	},
	iconButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
	},
	bottomRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	mutualPill: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		borderRadius: 999,
		borderWidth: 1,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	mutualText: {
		fontSize: 12,
		fontWeight: '600',
	},
	sendButton: {
		borderRadius: 999,
		paddingHorizontal: 20,
		paddingVertical: 10,
		minWidth: 100,
		alignItems: 'center',
	},
	sendLabel: {
		fontWeight: '700',
		fontSize: 14,
	},
	bubbleWrapper: {
		marginBottom: 16,
	},
	bubble: {
		borderRadius: 20,
		borderWidth: 1,
		padding: 12,
		gap: 8,
		maxWidth: '88%',
	},
	senderName: {
		fontSize: 13,
		fontWeight: '700',
		marginBottom: 4,
	},
	bodyText: {
		fontSize: 15,
		lineHeight: 21,
	},
	inlineImage: {
		width: 220,
		height: 260,
		borderRadius: 16,
	},
	inlineVideo: {
		width: 220,
		height: 260,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
	},
	metaRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		marginTop: 6,
	},
	timestamp: {
		fontSize: 12,
	},
	replyGhost: {
		borderLeftWidth: 3,
		paddingLeft: 8,
		gap: 2,
	},
	replyGhostAuthor: {
		fontSize: 12,
		fontWeight: '700',
	},
	replyGhostBody: {
		fontSize: 12,
	},
	calloutBubble: {
		borderRadius: 14,
		flexDirection: 'row',
		padding: 10,
		gap: 10,
	},
	calloutImage: {
		width: 54,
		height: 54,
		borderRadius: 12,
	},
	calloutImageFallback: {
		width: 54,
		height: 54,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#ffffff44',
		alignItems: 'center',
		justifyContent: 'center',
	},
	calloutLabel: {
		fontSize: 11,
		textTransform: 'uppercase',
		fontWeight: '700',
	},
	calloutTitle: {
		fontSize: 14,
		fontWeight: '700',
	},
	calloutAuthor: {
		fontSize: 12,
	},
	replyBanner: {
		borderWidth: 1,
		borderRadius: 14,
		padding: 10,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	replyLine: {
		width: 2,
		alignSelf: 'stretch',
		borderRadius: 2,
	},
	replyingTo: {
		fontSize: 13,
		fontWeight: '600',
	},
	replyingBody: {
		fontSize: 13,
	},
	attachmentPreview: {
		borderRadius: 16,
		overflow: 'hidden',
		alignSelf: 'flex-start',
	},
	attachmentImage: {
		width: 160,
		height: 160,
	},
	videoAttachment: {
		width: 160,
		height: 120,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 16,
	},
	removeAttachment: {
		position: 'absolute',
		top: 8,
		right: 8,
		width: 24,
		height: 24,
		borderRadius: 12,
		backgroundColor: '#00000099',
		alignItems: 'center',
		justifyContent: 'center',
	},
	storyPreview: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		borderRadius: 14,
		padding: 10,
	},
	storyPreviewImage: {
		width: 48,
		height: 48,
		borderRadius: 12,
		backgroundColor: '#1c1c1c',
	},
	storyPreviewLabel: {
		fontSize: 11,
		textTransform: 'uppercase',
		fontWeight: '700',
	},
	storyPreviewTitle: {
		fontSize: 14,
		fontWeight: '700',
	},
	storyCarousel: {
		marginBottom: 12,
	},
	storyCarouselHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 8,
	},
	storyCarouselTitle: {
		fontSize: 13,
		fontWeight: '600',
	},
	storyHeaderActions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	storyCard: {
		width: 140,
		borderWidth: 1,
		borderRadius: 16,
		padding: 10,
		marginRight: 10,
		gap: 6,
	},
	storyCardImage: {
		width: '100%',
		height: 90,
		borderRadius: 12,
	},
	storyCardTitle: {
		fontSize: 13,
		fontWeight: '600',
	},
	storyCardFooter: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	storyCardMeta: {
		fontSize: 11,
	},
	headerCard: {
		borderWidth: 1,
		borderRadius: 20,
		padding: 16,
		marginBottom: 16,
		gap: 10,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	headerTitle: {
		fontSize: 24,
		fontWeight: '800',
	},
	headerPill: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		borderWidth: 1,
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	headerSubtitle: {
		fontSize: 14,
		lineHeight: 20,
	},
	headerStatsRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	statLabel: {
		fontSize: 12,
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},
	statValue: {
		fontSize: 16,
		fontWeight: '700',
	},
	refreshButton: {
		width: 42,
		height: 42,
		borderRadius: 14,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
});

