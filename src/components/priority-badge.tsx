import { Text } from 'react-native';
import type { Priority } from '@/domain/product';
import { priorityLabels } from '@/domain/product';
import { useUI } from './ui';
export function PriorityBadge({ priority }: { priority: Priority }) {
  const { colors } = useUI();
  const color = { high: colors.priorityHigh, medium: colors.priorityMedium, low: colors.priorityLow }[priority];
  return <Text style={{ color, fontSize: 12, fontWeight: '600' }}>● {priorityLabels[priority]} prioridade</Text>;
}
