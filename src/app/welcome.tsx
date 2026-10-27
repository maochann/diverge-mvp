import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Motion, Radius, Spacing, Type } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth-context';
import { markReminderWanted } from '@/lib/daily-prompt-reminder';
import { useSerif, useTheme } from '@/lib/theme';
import { markWelcomeSeen } from '@/lib/welcome';
import { NotificationPermissionDenied, obtainPushToken } from '@/services/notifications';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type PageKey = 'reminder' | 'chapters' | 'circle' | 'prompt' | 'words';
const PAGES: readonly PageKey[] = ['reminder', 'chapters', 'circle', 'prompt', 'words'];

/** Draws once when its page is in view; still under Reduce Motion. */
function useDraw(active: boolean, delay = 0) {
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    if (active) {
      v.set(withDelay(delay, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })));
    } else {
      v.set(0);
    }
  }, [active, reduced, delay, v]);
  return v;
}

/** Page 1: a notification, as it will look. */
function ReminderFigure({ active, sample }: { active: boolean; sample: string }) {
  const { colors } = useTheme();
  const v = useDraw(active, 200);
  const style = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * -10 }],
  }));
  return (
    <Animated.View
      style={[
        styles.notice,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        style,
      ]}
    >
      <View style={[styles.noticeMark, { backgroundColor: colors.text }]} />
      <View style={styles.noticeText}>
        <Text style={[styles.noticeApp, { color: colors.textTertiary }]}>DIVERGE</Text>
        <Text style={[styles.noticeBody, { color: colors.text }]}>{sample}</Text>
      </View>
    </Animated.View>
  );
}

/** Page 2: the fork draws itself under a chapter ending. */
function ChaptersFigure({ active, marker }: { active: boolean; marker: string }) {
  const { colors } = useTheme();
  const serif = useSerif();
  const v = useDraw(active, 150);
  const W = 120;
  const H = 24;
  const split = W * 0.45;
  const LENGTH = 220;
  const props = useAnimatedProps(() => ({ strokeDashoffset: LENGTH * (1 - v.value) }));
  const fade = useAnimatedStyle(() => ({ opacity: v.value }));
  return (
    <View style={styles.figure}>
      <Animated.View style={[styles.figureRows, fade]}>
        {[0.9, 0.6, 0.75].map((w, i) => (
          <View key={i} style={[styles.textLine, { width: `${w * 100}%`, backgroundColor: colors.skeleton }]} />
        ))}
      </Animated.View>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <AnimatedPath
          d={`M0 ${H - 2} H${split} L${split + 14} 2 H${W}`}
          stroke={colors.tint}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={`${LENGTH} ${LENGTH}`}
          animatedProps={props}
        />
      </Svg>
      <Animated.Text style={[styles.marker, serif.regular, { color: colors.text }, fade]}>{marker}</Animated.Text>
    </View>
  );
}

/** Page 3: the circle, marks inside, people beyond. */
function CircleFigure({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const v = useDraw(active, 100);
  const SIZE = 220;
  const c = SIZE / 2;
  const r = 62;
  const circumference = 2 * Math.PI * r;
  const circleProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - v.value) }));
  const fade = useAnimatedStyle(() => ({ opacity: v.value }));
  const inside = [
    [c - 22, c - 10],
    [c + 18, c - 26],
    [c + 8, c + 24],
  ];
  const outside = [
    [c - 92, c - 40],
    [c + 90, c - 58],
    [c + 96, c + 44],
    [c - 70, c + 78],
  ];
  return (
    <View style={[styles.figure, { width: SIZE, height: SIZE }]}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <AnimatedCircle
          cx={c}
          cy={c}
          r={r}
          stroke={colors.textTertiary}
          strokeWidth={1}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={circleProps}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, fade]}>
        <View style={[styles.me, { left: c - 14, top: c - 14, borderColor: colors.text }]}>
          <Avatar url={null} name="you" size={26} />
        </View>
        {inside.map(([x, y], i) => (
          <View key={i} style={[styles.dot, { left: x - 3, top: y - 3, backgroundColor: colors.text }]} />
        ))}
        {outside.map(([x, y], i) => (
          <View key={i} style={[styles.person, { left: x - 16, top: y - 16, borderColor: colors.tint }]}>
            <Avatar url={null} name="person" size={28} />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

/** Page 4: one prompt, two different answers. */
function PromptFigure({ active, sample }: { active: boolean; sample: string }) {
  const { colors } = useTheme();
  const serif = useSerif();
  const v = useDraw(active, 100);
  const a = useAnimatedStyle(() => ({ opacity: v.value }));
  const b = useAnimatedStyle(() => ({
    opacity: Math.max(0, (v.value - 0.5) * 2),
    transform: [{ translateY: (1 - v.value) * 6 }],
  }));
  return (
    <View style={styles.figureWide}>
      <Animated.Text style={[styles.promptSample, serif.strong, { color: colors.text }, a]}>{sample}</Animated.Text>
      <Animated.View style={[styles.answers, b]}>
        {[0.8, 0.55].map((w, i) => (
          <View key={i} style={styles.answer}>
            <Avatar url={null} name="someone" size={24} />
            <View style={styles.answerLines}>
              <View style={[styles.textLine, { width: `${w * 100}%`, backgroundColor: colors.skeleton }]} />
              <View style={[styles.photo, { backgroundColor: colors.surface }]} />
            </View>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

/** Page 5: the circle fills and a word appears. */
function WordsFigure({ active, word }: { active: boolean; word: string }) {
  const { colors } = useTheme();
  const v = useDraw(active, 300);
  const fill = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.6 + 0.4 * v.value }] }));
  const label = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateX: (1 - v.value) * -6 }] }));
  return (
    <View style={styles.figure}>
      <View style={styles.wordRow}>
        <View style={[styles.ring, { borderColor: colors.textTertiary }]}>
          <Animated.View style={[styles.ringFill, { backgroundColor: colors.tint }, fill]} />
        </View>
        <Animated.Text style={[styles.word, { color: colors.tint }, label]}>{word}</Animated.Text>
      </View>
    </View>
  );
}

/**
 * The first-launch tour: five pages of paper, one sentence each, with the
 * app's own marks drawing themselves. No illustrations, no overlay, no
 * dots. The reminder comes first and is a choice, not a prompt.
 */
export default function WelcomeScreen() {
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const serif = useSerif();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [reminderOn, setReminderOn] = useState(false);
  const [asking, setAsking] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const isReplay = replay === '1';
  const last = page === PAGES.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  const go = (index: number) => scroller.current?.scrollTo({ x: index * width, animated: true });

  const finish = async (to: 'sign-up' | 'sign-in' | 'back') => {
    await markWelcomeSeen();
    if (to === 'back') router.back();
    else router.replace(to === 'sign-up' ? '/sign-up' : '/sign-in');
  };

  const turnOnReminder = async () => {
    setAsking(true);
    try {
      await obtainPushToken();
      await markReminderWanted();
      setReminderOn(true);
    } catch (e) {
      if (e instanceof NotificationPermissionDenied) {
        Alert.alert(t('notify.permissionTitle'), t('notify.permissionBody'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('notify.openSettings'), onPress: () => void Linking.openSettings() },
        ]);
      } else {
        Alert.alert(t('notify.failed'), e instanceof Error ? e.message : String(e));
      }
    } finally {
      setAsking(false);
    }
  };

  const body = (key: PageKey) => {
    const active = PAGES[page] === key;
    switch (key) {
      case 'reminder':
        return <ReminderFigure active={active} sample={t('welcome.reminder.sample')} />;
      case 'chapters':
        return <ChaptersFigure active={active} marker={t('welcome.chapters.marker')} />;
      case 'circle':
        return <CircleFigure active={active} />;
      case 'prompt':
        return <PromptFigure active={active} sample={t('welcome.prompt.sample')} />;
      case 'words':
        return <WordsFigure active={active} word={t('reaction.relate')} />;
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        <Text style={[styles.counter, { color: colors.textTertiary }]}>
          {t('welcome.page', { n: page + 1, total: PAGES.length })}
        </Text>
        {last ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('welcome.skip')}
            onPress={() => (isReplay ? void finish('back') : go(PAGES.length - 1))}
            hitSlop={10}
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
          >
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>{t('welcome.skip')}</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        style={styles.pages}
      >
        {PAGES.map((key) => (
          <View key={key} style={[styles.page, { width }]}>
            <View style={styles.figureSlot}>{body(key)}</View>
            <Animated.View entering={FadeIn.duration(Motion.base)} style={styles.copy}>
              <Text style={[styles.title, serif.strong, { color: colors.text }]}>{t(`welcome.${key}.title`)}</Text>
              <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{t(`welcome.${key}.body`)}</Text>
              {key === 'reminder' ? (
                <View style={styles.reminderActions}>
                  {reminderOn ? (
                    <Text style={[styles.enabled, { color: colors.tint }]}>{t('welcome.reminder.enabled')}</Text>
                  ) : (
                    <>
                      <Button
                        title={t('welcome.reminder.on')}
                        compact
                        loading={asking}
                        onPress={() => void turnOnReminder()}
                      />
                      <Button title={t('welcome.reminder.later')} variant="outline" compact onPress={() => go(1)} />
                    </>
                  )}
                </View>
              ) : null}
            </Animated.View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottom}>
        {last ? (
          isReplay || session ? (
            <Button title={t('welcome.done')} onPress={() => void finish('back')} />
          ) : (
            <>
              <Button title={t('welcome.start')} onPress={() => void finish('sign-up')} />
              <Button title={t('welcome.haveAccount')} variant="secondary" onPress={() => void finish('sign-in')} />
            </>
          )
        ) : (
          <Button title={t('welcome.next')} variant="outline" onPress={() => go(page + 1)} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    minHeight: 44,
  },
  counter: {
    ...Type.caption,
    fontVariant: ['tabular-nums'],
  },
  skip: {
    minHeight: 44,
    justifyContent: 'center',
  },
  skipText: Type.captionStrong,
  pages: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
    gap: Spacing.xxl,
  },
  figureSlot: {
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  figure: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  figureWide: {
    alignSelf: 'stretch',
    gap: Spacing.lg,
  },
  figureRows: {
    alignSelf: 'stretch',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  textLine: {
    height: 10,
    borderRadius: Radius.sm,
  },
  marker: {
    ...Type.chapter,
  },
  copy: {
    gap: Spacing.md,
  },
  title: {
    ...Type.display,
  },
  bodyText: Type.body,
  reminderActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    minHeight: 34,
    alignItems: 'center',
  },
  enabled: Type.captionStrong,
  bottom: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    alignSelf: 'stretch',
    marginHorizontal: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.lg + 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noticeMark: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
  },
  noticeText: {
    flex: 1,
    gap: 2,
  },
  noticeApp: {
    ...Type.micro,
    letterSpacing: 0.6,
  },
  noticeBody: Type.body,
  me: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  person: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptSample: {
    ...Type.display,
    textAlign: 'center',
  },
  answers: {
    gap: Spacing.md,
  },
  answer: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  answerLines: {
    flex: 1,
    gap: Spacing.sm,
  },
  photo: {
    height: 44,
    borderRadius: Radius.md,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  ring: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringFill: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  word: {
    ...Type.heading,
  },
  pressed: {
    opacity: 0.6,
  },
});
