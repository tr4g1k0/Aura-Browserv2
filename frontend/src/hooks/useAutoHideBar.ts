import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';

export function useAutoHideBar() {
  const barTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollYRef = useRef(0);
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBarHiddenRef = useRef(false);

  const showBar = useCallback(() => {
    if (!isBarHiddenRef.current) return;
    isBarHiddenRef.current = false;
    Animated.timing(barTranslateY, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [barTranslateY]);

  const hideBar = useCallback(() => {
    if (isBarHiddenRef.current) return;
    isBarHiddenRef.current = true;
    Animated.timing(barTranslateY, {
      toValue: 200,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [barTranslateY]);

  const handleScrollDirection = useCallback((scrollY: number) => {
    const delta = scrollY - lastScrollYRef.current;
    const isAtTop = scrollY <= 5;

    if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);

    if (isAtTop) {
      showBar();
    } else if (delta > 8) {
      hideBar();
    } else if (delta < -8) {
      showBar();
    }

    scrollIdleTimerRef.current = setTimeout(() => showBar(), 1000);
    lastScrollYRef.current = scrollY;
  }, [showBar, hideBar]);

  return { barTranslateY, showBar, hideBar, handleScrollDirection };
}
