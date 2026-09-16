import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface TappableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** How far the element sinks while pressed. */
  pressScale?: number;
}

/**
 * The one press feel: sink slightly and dim a little on touch, spring back
 * on release. Disabled elements are simply faint. Every tappable surface in
 * the app should feel like this one.
 */
export function Tappable({
  style,
  pressScale = 0.98,
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: TappableProps) {
  const scale = useSharedValue(1);
  const dim = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: dim.value,
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        scale.set(withTiming(pressScale, { duration: Motion.fast }));
        dim.set(withTiming(0.85, { duration: Motion.fast }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, Motion.spring));
        dim.set(withTiming(1, { duration: Motion.base }));
        onPressOut?.(e);
      }}
      style={[style, disabled ? { opacity: 0.4 } : null, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
