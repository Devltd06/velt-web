import AsyncStorage from "@react-native-async-storage/async-storage";

export const SAVED_ACCOUNTS_KEY = "settings:recent_accounts";

export type SavedAccount = {
  id: string;
  name: string;
  avatar?: string | null;
  email?: string | null;
  refreshToken?: string | null;
  savedAt?: number | null;
};

const parseAccounts = (raw: string | null): SavedAccount[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as SavedAccount[];
    return [];
  } catch {
    return [];
  }
};

export const readSavedAccounts = async (): Promise<SavedAccount[]> => {
  try {
    const stored = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
    return parseAccounts(stored);
  } catch {
    return [];
  }
};

export const writeSavedAccounts = async (accounts: SavedAccount[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {}
};

export const upsertSavedAccount = async (account: SavedAccount, limit = 5): Promise<SavedAccount[]> => {
  const existing = await readSavedAccounts();
  const next = [account, ...existing.filter((a) => a.id !== account.id)].slice(0, limit);
  await writeSavedAccounts(next);
  return next;
};

export const deleteSavedAccount = async (accountId: string): Promise<SavedAccount[]> => {
  const existing = await readSavedAccounts();
  const next = existing.filter((acc) => acc.id !== accountId);
  await writeSavedAccounts(next);
  return next;
};
