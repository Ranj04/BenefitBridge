import { View, Text } from 'react-native';

/**
 * Where the numbers came from, when, and which copy: the live-data receipt.
 * "live" gets a green dot; a cache fallback is stated plainly, never hidden.
 */
export function ProvenanceStamp({
  freshness,
  version,
  fetchedAt,
}: {
  freshness: 'live' | 'cached';
  version?: number;
  fetchedAt?: string;
}) {
  const live = freshness === 'live';
  return (
    <View
      className="flex-row items-center gap-2 rounded-card border border-fog bg-hearth px-3 py-2"
      accessibilityLabel={`Data source: HHS ASPE poverty guidelines API, ${live ? 'fetched live' : 'from last-good cache'}${version ? `, version ${version}` : ''}`}
    >
      <View className={`h-2.5 w-2.5 rounded-full ${live ? 'bg-moss' : 'bg-ember'}`} />
      <Text className="flex-1 font-body text-caption text-ink">
        FPL basis pulled <Text className="font-bodybold">{live ? 'live' : 'from last-good cache'}</Text> from the HHS ASPE API
        {version ? ` · store v${version}` : ''}
        {fetchedAt ? ` · ${fetchedAt}` : ''}
      </Text>
    </View>
  );
}
