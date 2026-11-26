import type { NotificationsService } from '../notifications/notifications.service';
import { OutboxService } from '../notifications/outbox.service';

type Notifier = Pick<NotificationsService, 'sendPushNotification'>;

interface OrderNotificationBase {
  orderId: string;
  partName: string;
  totalAmount: number;
  quantity: number;
  customerUserId?: string | null;
  providerUserId?: string | null;
}

const rupees = (amount: number) => `₹${Number(amount).toLocaleString('en-IN')}`;

/**
 * Shop notification loop. All dispatch is fire-and-forget: a notification
 * failure (no token, DB hiccup) must never fail an order transition.
 */
function notify(notifier: Notifier, params: Parameters<Notifier['sendPushNotification']>[0]) {
  try {
    notifier.sendPushNotification(params).catch(() => {});
  } catch {
    // Non-blocking: notifications are best-effort
  }
}

export function notifyOrderPlaced(
  notifier: Notifier,
  order: OrderNotificationBase,
) {
  if (!order.providerUserId) return;

  notify(notifier, {
    userId: order.providerUserId,
    title: 'New order',
    body: `${order.partName}, quantity ${order.quantity}, ${rupees(order.totalAmount)}. Waiting for the customer to pay.`,
    data: {
      type: 'SPARE_PART_ORDER_PLACED',
      orderId: order.orderId,
    },
  });
}

export function enqueueOrderPaid(
  outbox: OutboxService,
  tx: Parameters<OutboxService['enqueue']>[0],
  order: OrderNotificationBase,
) {
  const params: Parameters<Notifier['sendPushNotification']>[0] = {
    userId: order.customerUserId ?? '',
    title: 'Order confirmed',
    body: `Your order for ${order.partName} (quantity ${order.quantity}, ${rupees(order.totalAmount)}) is confirmed.`,
    data: { type: 'SPARE_PART_ORDER_PAID', orderId: order.orderId },
  };
  if (!params.userId) return;
  return outbox.enqueue(tx as never, 'spare-part.paid', params, 'expo-push');
}

export function notifyOrderPaid(
  notifier: Notifier,
  order: OrderNotificationBase,
) {
  if (order.customerUserId) {
    notify(notifier, {
      userId: order.customerUserId,
      title: 'Payment received',
      body: `We received your payment of ${rupees(order.totalAmount)} for ${order.partName}.`,
      data: {
        type: 'SPARE_PART_ORDER_PAID',
        orderId: order.orderId,
      },
    });
  }

  if (order.providerUserId) {
    notify(notifier, {
      userId: order.providerUserId,
      title: 'New paid order',
      body: `${order.partName}, quantity ${order.quantity}, ${rupees(order.totalAmount)}. Please pack and send it.`,
      data: {
        type: 'SPARE_PART_ORDER_PAID',
        orderId: order.orderId,
      },
    });
  }
}

export function notifyOrderCancelled(
  notifier: Notifier,
  order: OrderNotificationBase,
) {
  if (!order.providerUserId) return;

  notify(notifier, {
    userId: order.providerUserId,
    title: 'Order cancelled',
    body: `The customer cancelled the order for ${order.partName}.`,
    data: {
      type: 'SPARE_PART_ORDER_CANCELLED',
      orderId: order.orderId,
    },
  });
}

export function notifyOrderRefunded(
  notifier: Notifier,
  order: OrderNotificationBase,
) {
  if (!order.customerUserId) return;

  notify(notifier, {
    userId: order.customerUserId,
    title: 'Refund processed',
    body: `${rupees(order.totalAmount)} for ${order.partName} has been refunded to your original payment method.`,
    data: {
      type: 'SPARE_PART_ORDER_REFUNDED',
      orderId: order.orderId,
    },
  });
}
