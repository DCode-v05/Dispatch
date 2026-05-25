import type { Message, MessageDeliveryStatus, Room } from '@/types';

/**
 * Derive the delivery status of an outgoing message from local + presence state.
 *
 *   pending   – not yet echoed back by the server (rare; only during the
 *               brief window between socket.emit and the server's broadcast)
 *   sent      – server has the message; no recipient currently online + no reads
 *   delivered – at least one non-sender participant is currently online
 *   seen      – at least one non-sender participant is in readBy
 *
 * Because we only add messages to the local store on the socket `new_message`
 * echo (no optimistic UI), the presence of a message in the store is itself
 * proof of `sent`. We only treat a message as pending if it was explicitly
 * flagged so by the caller (`msg.status === 'pending'`).
 */
export function deriveStatus(
  msg: Message,
  room: Room | undefined,
  onlineUserIds: Set<string>,
): MessageDeliveryStatus {
  if (msg.status === 'pending') return 'pending';

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
