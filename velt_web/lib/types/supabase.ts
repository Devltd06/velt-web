export type Profile = {
  id: string;
  name: string;
  email: string;
  role: 'buyer' | 'seller';
  profile_url?: string;
  banner_url?: string;

  // Buyer fields
  nickname?: string;
  dob?: string;
  phone?: string;
  location?: string;
  occupation?: string;
  net_worth?: string;

  // Seller fields
  brand_name?: string;
  started_on?: string;
  company_value?: string;
  certificate_url?: string;
};
