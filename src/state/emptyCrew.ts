import type { Crew, CrewMember, ChatMessage } from '@/types';

export const EMPTY_CREW_META: Crew = {
  id: '',
  name: '',
  inviteCode: '',
  skipPotCents: 0,
  ownerId: '',
  region: '',
};

export const EMPTY_CREW: CrewMember[] = [];
export const EMPTY_CHAT: ChatMessage[] = [];
