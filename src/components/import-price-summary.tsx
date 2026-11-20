import { Text, View } from 'react-native';
import type { PriceEvidence } from '@/services/import-prices';
import { importPriceSummary } from '@/domain/price-presentation';
import { money } from '@/domain/product';
import { useUI } from './ui';
export function ImportPriceSummary({prices}:{prices:PriceEvidence}) {
  const {styles,colors}=useUI();const summary=importPriceSummary(prices);
  return <View style={{gap:5}}>
    {summary.lowest?<><Text style={styles.label}>Menor valor anunciado sem cupom</Text><Text style={[styles.heading,{color:colors.primary}]}>{money(summary.lowest.price_cents)} — {summary.lowest.label}</Text></>:<Text style={styles.body}>Preço não informado pela página.</Text>}
    {summary.lowest?.conditional&&summary.current!==null&&<Text style={styles.body}>Outro preço informado: {money(summary.current)}</Text>}
    {summary.conditional&&!summary.lowest?.conditional&&<Text style={styles.body}>{summary.conditional.label}: {money(summary.conditional.price_cents)}</Text>}
    {summary.original!==null&&<Text style={[styles.body,{fontSize:13}]}>Preço anterior informado: {money(summary.original)}</Text>}
    <Text style={[styles.body,{fontSize:12}]}>Valor observado nesta consulta, sujeito às condições e mudanças na loja. Revise antes de salvar.</Text>
  </View>;
}
