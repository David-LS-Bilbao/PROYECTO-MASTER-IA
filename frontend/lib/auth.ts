import type { UserEntitlements, UserProfile } from '@/lib/api';

type PlanType = UserProfile['plan'];

interface PremiumUserLike {
  plan?: PlanType | null;
  subscriptionPlan?: PlanType | null;
  entitlements?: Partial<UserEntitlements> | null;
  deepAnalysis?: boolean;
}

/**
 * Premium is granted either by paid plan or deep-analysis entitlement (promo).
 */
export function isUserPremium(user: PremiumUserLike | null | undefined): boolean {
  if (!user) {
    return false;
  }

  const plan = user.plan ?? user.subscriptionPlan;
  const hasPremiumPlan = plan === 'PREMIUM';
  const hasPromoEntitlement = user.deepAnalysis === true || user.entitlements?.deepAnalysis === true;

  return hasPremiumPlan || hasPromoEntitlement;
}

