import { Text, View } from 'react-native';
import type { PriceEvidence } from '@/services/import-prices';
import { importPriceSummary } from '@/domain/price-presentation';
import { money } from '@/domain/product';
import { useUI } from './ui';
export function ImportPriceSummary({ prices }: { prices: PriceEvidence }) {
  const { styles, colors } = useUI();
  const { lowest, original } = importPriceSummary(prices);
  const coupon = prices.coupon;
  const label = lowest?.label.split(' — ')[0];
  return <View style={{ gap: 5 }}>
    {original !== null && <Text style={[styles.body, { fontSize: 13, textDecorationLine: 'line-through' }]}>{money(original)}</Text>}
    <Text style={[styles.heading, { color: colors.primary, fontSize: 26 }]}>{money(lowest?.price_cents ?? null)}</Text>
    {label && <Text style={styles.body}>{label}</Text>}
    {coupon && <Text selectable style={styles.label}>Cupom: {coupon.code}{coupon.expired ? ' — validade não confirmada' : ''}</Text>}
    {coupon && !coupon.expired && coupon.price_cents === null && <Text style={styles.body}>Preço final com cupom não confirmado.</Text>}
  </View>;
}
