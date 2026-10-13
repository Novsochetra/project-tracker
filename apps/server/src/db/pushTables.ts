export interface PushSubscriptionRow {
  id: string;
  userId: string | null;
  sessionId: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: number;
}

export interface PushKeyRow {
  id: string;
  publicKey: string;
  privateKey: string;
  createdAt: number;
}

export interface PushTables {
  pushSubscriptions: PushSubscriptionRow;
  pushKeys: PushKeyRow;
}
