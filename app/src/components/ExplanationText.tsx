import { View, Text } from 'react-native';

/**
 * Markdown-lite for the agent's explanation: **bold**, # headings, and
 * "-"/"*" bullets — nothing else. The words are the agent's (already
 * guard-checked); this only stops raw asterisks reaching a reader who may
 * already find the page hard work. Unknown syntax falls through as text.
 */
function Inline({ text, className }: { text: string; className: string }) {
  // [label](url) → label; citations below the cards carry the tappable sources.
  const delinked = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  const parts = delinked.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Text className={className}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <Text key={i} className="font-bodybold">
            {p.slice(2, -2)}
          </Text>
        ) : (
          <Text key={i}>{p}</Text>
        ),
      )}
    </Text>
  );
}

export function ExplanationText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <View>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter((l) => l.trim() && !/^\s*[-*_]{3,}\s*$/.test(l));
        if (!lines.length) return null;
        return (
          <View key={bi} className={bi > 0 ? 'mt-3' : ''}>
            {lines.map((line, li) => {
              const h = line.match(/^#{1,6}\s+(.*)$/);
              if (h) {
                return (
                  <Text key={li} className="font-bodybold text-body text-ink">
                    {h[1].replace(/\*\*/g, '')}
                  </Text>
                );
              }
              const li_ = line.match(/^\s*[-*]\s+(.*)$/);
              if (li_) {
                return (
                  <View key={li} className="mt-1 flex-row">
                    <Text className="pr-2 font-body text-body text-ink" importantForAccessibility="no">
                      •
                    </Text>
                    <Inline text={li_[1]} className="flex-1 font-body text-body leading-6 text-ink" />
                  </View>
                );
              }
              return <Inline key={li} text={line} className="font-body text-body leading-6 text-ink" />;
            })}
          </View>
        );
      })}
    </View>
  );
}
