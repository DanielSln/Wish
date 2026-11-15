import { useLocalSearchParams } from 'expo-router';
import { Wishlist } from '@/components/wishlist';
export default function Home() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const selected = typeof category === 'string' ? category : undefined;
  return <Wishlist key={selected??'all'} category={selected}/>;
}
