export class Expo {
  static isExpoPushToken(token: any): boolean {
    return typeof token === 'string' && token.startsWith('ExponentPushToken[');
  }

  static pushNotificationChunkSizeLimit = 100;
  static pushNotificationReceiptChunkSizeLimit = 300;

  chunkPushNotifications(messages: any[]): any[][] {
    return [messages];
  }

  async sendPushNotificationsAsync(messages: any[]): Promise<any[]> {
    return messages.map((m) => ({ status: 'ok', id: 'mock-ticket-id' }));
  }
}

export type ExpoPushMessage = any;
export type ExpoPushTicket = any;
