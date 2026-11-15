import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { ProductForm } from '@/components/product-form';
import { styles } from '@/components/ui';
export default function EditProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (typeof id !== 'string' || !id) return <View style={styles.page}><Text style={styles.error}>Produto inválido.</Text></View>;
  return <ProductForm id={id} />;
}
