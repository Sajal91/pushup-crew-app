export type PushPayload = {
  type: string;
  title: string;
  body: string;
  channelId?: string;
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: { type: string };
  sound: 'default';
  priority: 'high';
  channelId?: string;
  android?: {
    channelId: string;
    priority: 'high';
  };
  ios?: {
    sound: 'default';
  };
};

export type ExpoPushResult = {
  sent: number;
  tickets: unknown[];
  errors: string[];
};

export async function sendExpoPush(
  tokens: string[],
  payload: PushPayload,
): Promise<ExpoPushResult> {
  const unique = [...new Set(tokens.filter(Boolean))];
  if (unique.length === 0) {
    return { sent: 0, tickets: [], errors: [] };
  }

  const channelId = payload.channelId ?? 'crew-alerts';

  const messages: ExpoPushMessage[] = unique.map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    data: { type: payload.type },
    sound: 'default',
    priority: 'high',
    channelId,
    android: {
      channelId,
      priority: 'high',
    },
    ios: {
      sound: 'default',
    },
  }));

  const response = await fetch('https://exp.host/--/api/v2/push/send?useFcmV1=true', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const raw = await response.text();
  let parsed: { data?: Array<{ status?: string; message?: string; details?: unknown; id?: string }> } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Expo push returned non-JSON (${response.status}): ${raw}`);
  }

  if (!response.ok) {
    throw new Error(`Expo push failed (${response.status}): ${raw}`);
  }

  const tickets = parsed.data ?? [];
  const errors: string[] = [];

  for (const ticket of tickets) {
    if (ticket.status === 'error') {
      const detail = ticket.details ? ` ${JSON.stringify(ticket.details)}` : '';
      errors.push(`${ticket.message ?? 'Unknown Expo push error'}${detail}`);
    }
  }

  if (errors.length > 0) {
    console.error('[expo-push] ticket errors:', errors);
  }

  return {
    sent: tickets.filter((t) => t.status === 'ok').length,
    tickets,
    errors,
  };
}
