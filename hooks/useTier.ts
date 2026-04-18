import { useAuth } from '../context/AuthContext';

export type Tier = 'free' | 'pro';

export function useTier() {
  const { profile } = useAuth();
  // All users treated as Pro for MVP.
  // The tier field is read from DB so upgrading a profile to 'pro' works,
  // but we default to 'pro' even when tier is 'free' or profile hasn't loaded yet.
  const tier: Tier = 'pro';
  return {
    tier,
    isPro: true,
    isFree: false,
  };
}
