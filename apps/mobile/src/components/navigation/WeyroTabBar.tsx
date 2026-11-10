import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/ui/Motion';
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
  navigation: {
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented?: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

export function WeyroTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <BlurView intensity={50} tint="dark" style={styles.blur}>
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const options = descriptors[route.key]?.options ?? {};
            const color = focused ? palette.accent : palette.textMuted;
            const label = options.title ?? route.name;

            return (
              <PressableScale
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                scaleTo={0.92}
                style={styles.item}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name, route.params);
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
              </PressableScale>
            );
          })}
        </View>
      </BlurView>
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
    backgroundColor: 'rgba(16, 18, 20, 0.55)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 58,
  },
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
