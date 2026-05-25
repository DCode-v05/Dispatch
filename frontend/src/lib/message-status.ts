import type { Message, MessageDeliveryStatus, Room } from '@/types';

/**
 * Derive the delivery status of an outgoing message from local + presence state.
 *
 *   pending   – optimistic: no server-side id yet
 *   sent      – server acknowledged (we have _id) but no recipient online + no reads
 *   delivered – at least one non-sender participant is currently online
 *   seen      – at least one non-sender participant is in readBy
 */
export function deriveStatus(
  msg: Message,
  room: Room | undefined,
  onlineUserIds: Set<string>,
): MessageDeliveryStatus {
  if (msg.status === 'pending' && !(msg._id || msg.id?.startsWith?.('local_') === false)) {
    return 'pending';
  }

  // If message has only the sender in readBy and no permanent id, treat as pending
  const hasServerId = !!msg._id || (!!msg.id && !msg.id.startsWith('local_'));
  if (!hasServerId) return 'pending';

  const otherParticipants = (room?.participants ?? []).filter(
    (p) => p !== msg.senderId,
  );

  if (otherParticipants.length === 0) {
    return 'sent';
  }

  const seenByOther = otherParticipants.some((p) =>
    (msg.readBy ?? []).includes(p),
  );
  if (seenByOther) return 'seen';

  const anyOtherOnline = otherParticipants.some((p) => onlineUserIds.has(p));
  if (anyOtherOnline) return 'delivered';

  return 'sent';
}
