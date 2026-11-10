import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo, Animated } from 'react-native';
import { useImpactAchievement } from '../../lib/use-impact-achievement';
import { Button, styles, Text } from './ui';

const load = (key: string) => AsyncStorage.getItem(key);
const persist = (key: string, value: string) => AsyncStorage.setItem(key, value);

export default function ImpactAchievement({ userId, containers, completed }: { userId: string; containers: number; completed: number }) {
  const { achievement, dismiss } = useImpactAchievement(userId, containers, completed, load, persist);
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!achievement) return;
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active || reduced) return;
      opacity.setValue(0.35);
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    }).catch(() => {});
    return () => { active = false; opacity.stopAnimation(); opacity.setValue(1); };
  }, [achievement, opacity]);
  if (!achievement) return null;
  return <Animated.View style={[styles.inset, { opacity }]}>
    <Text weight="bold" style={styles.body} accessibilityLiveRegion="polite">Achievement unlocked · {achievement.title}</Text>
    <Button label="Dismiss" kind="quiet" onPress={dismiss} />
  </Animated.View>;
}
