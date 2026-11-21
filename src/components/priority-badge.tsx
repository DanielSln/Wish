import { Text } from 'react-native';
import type { Priority } from '@/domain/product';
import { priorityLabels } from '@/domain/product';
import { useUI } from './ui';
export function PriorityBadge({ priority }: { priority: Priority }) {
  const { colors } = useUI();
  const color = { high: colors.priorityHigh, medium: colors.priorityMedium, low: colors.priorityLow }[priority];
  return <Text accessibilityLabel={`Prioridade ${priorityLabels[priority].toLowerCase()}`} style={{ color, fontSize: 13, fontWeight: '600', flexShrink: 1 }}>● {priorityLabels[priority]}</Text>;
}
