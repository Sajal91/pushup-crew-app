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
};

export async function sendExpoPush(
  tokens: string[],
  payload: PushPayload,
): Promise<void> {
  const unique = [...new Set(tokens.filter(Boolean))];
  if (unique.length === 0) return;

  const messages: ExpoPushMessage[] = unique.map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    data: { type: payload.type },
    sound: 'default',
    priority: 'high',
    ...(payload.channelId ? { channelId: payload.channelId } : {}),
  }));

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Expo push failed (${response.status}): ${text}`);
  }
}
