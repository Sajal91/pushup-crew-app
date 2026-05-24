import { onboardingPath } from '@/lib/onboardingRoute';

export type AccountStatus = {
  email: string | null;
  isReturningUser: boolean;
  isNewUser: boolean;
  nameSetupComplete: boolean;
  hasCrew: boolean;
  name: string;
  dailyGoal: number;
};

type DbAccountStatus = {
  email: string | null;
  is_returning_user: boolean;
  is_new_user: boolean;
  name_setup_complete: boolean;
  has_crew: boolean;
  name: string;
  daily_goal: number;
};

export function mapAccountStatus(row: DbAccountStatus): AccountStatus {
  return {
    email: row.email ?? null,
    isReturningUser: Boolean(row.is_returning_user),
    isNewUser: Boolean(row.is_new_user),
    nameSetupComplete: Boolean(row.name_setup_complete),
    hasCrew: Boolean(row.has_crew),
    name: row.name ?? 'BRO',
    dailyGoal: row.daily_goal ?? 100,
  };
}

/** Route after sign-in based on DB account state (email / profile / crew). */
export function postSignInPath(status: AccountStatus, onboarded: boolean): string {
  if (!status.nameSetupComplete) {
    return onboardingPath('name');
  }

  if (onboarded && status.hasCrew) {
    return '/(tabs)';
  }

  if (!onboarded && status.hasCrew) {
    return onboardingPath('goal');
  }

  return onboardingPath('crew');
}
