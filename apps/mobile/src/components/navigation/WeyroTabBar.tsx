import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { palette, spacing } from '@/theme';
import { tabItemWidth } from './tabItemWidth';

/**
 * Custom tab bar — translucent graphite, titanium separators, orange active
 * indicator. Uses the same route set/role logic as the navigator; it only
 * changes presentation.
 */

type TabBarRoute = { key: string; name: string; params?: object };

type TabBarProps = {
  state: { index: number; routes: TabBarRoute[] };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        tabBarIcon?: (props: {
          focused: boolean;
          color: string;
          size: number;
        }) => ReactNode;
        tabBarAccessibilityLabel?: string;
      };
    }
  >;
  /** expo-router bottom tabs: switches by route key. */
  navigateToTab?: (routeKey: string) => void;
  emitter?: {
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented?: boolean };
  };
};

export function WeyroTabBar({ state, descriptors, navigateToTab, emitter }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Explicit widths: relying on flex alone let the labels collapse into one
  // string on device when the parent shrink-wrapped the row.
  const itemWidth = tabItemWidth(width, state.routes.length);

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.blur}>
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const options = descriptors[route.key]?.options ?? {};
            const color = focused ? palette.accent : palette.textMuted;
            const label = options.title ?? route.name;

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                testID={`tab-${route.name}`}
                style={({ pressed }) => [
                  styles.item,
                  { width: itemWidth },
                  pressed && styles.itemPressed,
                ]}
                onPress={() => {
                  const event = emitter?.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });

                  if (!focused && !event?.defaultPrevented) {
                    if (navigateToTab) {
                      navigateToTab(route.key);
                    } else {
                      // Safety net if a future navigator drops navigateToTab.
                      router.navigate(route.name === 'index' ? '/' : `/${route.name}`);
                    }
                  }
                }}
              >
                {options.tabBarIcon?.({
                  focused,
                  color,
                  size: 20,
                })}
                <Text
                  style={[styles.label, { color }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.borderStrong,
  },
  blur: {
    // Layered translucency (no native blur module in the current build).
    backgroundColor: palette.canvas,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 58,
  },
  itemPressed: { opacity: 0.65 },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: spacing.xs,
  },
  label: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  indicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: palette.accent,
  },
});
