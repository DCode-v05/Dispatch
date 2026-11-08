import type { Message, MessageDeliveryStatus, Room } from '@/types';

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
