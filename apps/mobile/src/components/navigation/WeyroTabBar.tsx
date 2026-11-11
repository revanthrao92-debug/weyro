import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { palette, spacing } from '@/theme';

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

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
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
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
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
                  size: 22,
                })}
                <Text
                  style={[styles.label, { color }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.6}
                >
                  {label}
                </Text>
                <View
                  style={[styles.indicator, focused && styles.indicatorActive]}
                />
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
    backgroundColor: 'rgba(16, 18, 20, 0.6)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  blur: {
    // Layered translucency (no native blur module in the current build).
    backgroundColor: 'rgba(16, 18, 20, 0.92)',
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
