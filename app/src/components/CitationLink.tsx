import { Linking, Pressable, Text } from 'react-native';
import type { ScreeningResult } from '../types';

/** One official source, dated — tappable, with a ≥48px touch target. */
export function CitationLink({ citation }: { citation: ScreeningResult['citations'][number] }) {
  return (
    <Pressable
      className="min-h-[48px] justify-center py-1"
      onPress={() => Linking.openURL(citation.source_url)}
      accessibilityRole="link"
      accessibilityLabel={`Source: ${citation.text}, as of ${citation.as_of}`}
    >
      <Text className="font-body text-caption text-pine underline">
        {citation.text} <Text className="text-ink-muted no-underline">(as of {citation.as_of})</Text>
      </Text>
    </Pressable>
  );
}
