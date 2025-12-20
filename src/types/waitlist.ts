export interface WaitlistEntry {
  id?: string;
  email: string;
  full_name?: string;
  phone_number?: string;
  interests?: string[];
  status?: 'pending' | 'confirmed' | 'joined';
  created_at?: string;
  updated_at?: string;
}

export interface WaitlistResponse {
  data?: WaitlistEntry | null;
  error?: {
    message: string;
    code?: string;
  };
}

export interface WaitlistStats {
  total_signups: number;
  pending: number;
  confirmed: number;
  joined: number;
  signup_date: string;
}
