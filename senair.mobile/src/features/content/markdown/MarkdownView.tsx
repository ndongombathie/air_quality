import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS, SPACING, TYPE } from '@/theme';
import { parseMarkdown, type InlineSpan } from './parseMarkdown';

function Spans({ spans }: { spans: InlineSpan[] }) {
  return (
    <>
      {spans.map((span, i) =>
        span.bold ? (
          <Text key={i} style={styles.bold}>
            {span.text}
          </Text>
        ) : (
          span.text
        ),
      )}
    </>
  );
}

/** Rendu natif (composants `Text`) du sous-ensemble Markdown : aucun HTML, aucune WebView. */
export function MarkdownView({ source }: { source: string }) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return (
    <View style={styles.container}>
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          return (
            <Text key={i} style={block.level === 2 ? styles.h2 : styles.h3} accessibilityRole="header">
              <Spans spans={block.spans} />
            </Text>
          );
        }
        if (block.type === 'list') {
          return (
            <View key={i} style={styles.list} accessibilityRole="list">
              {block.items.map((item, j) => (
                <View key={j} style={styles.item}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.paragraph}>
                    <Spans spans={item} />
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={i} style={styles.paragraph}>
            <Spans spans={block.spans} />
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.lg },
  h2: { ...TYPE.h2, color: COLORS.text, marginTop: SPACING.sm },
  h3: { ...TYPE.h3, color: COLORS.text },
  paragraph: { ...TYPE.body, color: COLORS.text, flex: 1 },
  bold: { fontFamily: FONTS.bold },
  list: { gap: SPACING.xs },
  item: { flexDirection: 'row', gap: SPACING.sm },
  bullet: { ...TYPE.body, color: COLORS.primary },
});
