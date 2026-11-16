import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ExpandableText } from './expandable-text';
import { useUI } from './ui';
export function DescriptionField({ value, onChange, editable, error }: { value: string; onChange: (value: string) => void; editable: boolean; error?: string }) {
  const { styles, colors } = useUI();
  const [editing, setEditing] = useState(!value);
  const open = editing || !value;
  return <View style={{ gap: 6 }}>
    <Text style={styles.label}>Descrição</Text>
    {open ? <>
      <TextInput accessibilityLabel="Descrição" value={value} onChangeText={onChange} editable={editable} multiline scrollEnabled maxLength={10000} style={[styles.input, { height: 200, textAlignVertical: 'top' }, !!error && { borderColor: colors.error }]} placeholderTextColor={colors.muted} />
      <Text style={[styles.body, { fontSize: 12 }]}>Você pode percorrer e editar todo o texto neste campo.</Text>
    </> : <ExpandableText text={value} />}
    {!!value && <Pressable disabled={!editable} accessibilityRole="button" accessibilityState={{ disabled: !editable }} onPress={() => setEditing(value => !value)} style={({ pressed }) => ({ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', opacity: !editable ? 0.45 : pressed ? 0.7 : 1 })}>
      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>{open ? 'Concluir edição da descrição' : 'Editar descrição'}</Text>
    </Pressable>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </View>;
}
