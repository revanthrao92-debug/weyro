import type { NotificationsService } from '../notifications/notifications.service';

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
    title: 'New order received 🛒',
    body: `Order #${order.orderId.slice(0, 8)} · ${order.partName} × ${order.quantity} (${rupees(order.totalAmount)}). Awaiting payment.`,
    data: {
      type: 'SPARE_PART_ORDER_PLACED',
      orderId: order.orderId,
    },
  });
}

export function notifyOrderPaid(
  notifier: Notifier,
  order: OrderNotificationBase,
) {
  if (order.customerUserId) {
    notify(notifier, {
      userId: order.customerUserId,
      title: 'Payment confirmed ✅',
      body: `Your payment of ${rupees(order.totalAmount)} for ${order.partName} was received.`,
      data: {
        type: 'SPARE_PART_ORDER_PAID',
        orderId: order.orderId,
      },
    });
  }

  if (order.providerUserId) {
    notify(notifier, {
      userId: order.providerUserId,
      title: 'Order paid — prepare it 📦',
      body: `${order.partName} × ${order.quantity} (${rupees(order.totalAmount)}) is paid and ready to fulfil.`,
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
    body: `Order #${order.orderId.slice(0, 8)} · ${order.partName} was cancelled by the customer.`,
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
    title: 'Refund processed 💸',
    body: `${rupees(order.totalAmount)} for ${order.partName} has been refunded.`,
    data: {
      type: 'SPARE_PART_ORDER_REFUNDED',
      orderId: order.orderId,
    },
  });
}
