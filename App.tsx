import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Button, HeroUINativeProvider } from 'heroui-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import './global.css';

const App = () => {
  const [notice, setNotice] = useState<string | null>(null);
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const heroTranslate = useRef(new Animated.Value(16)).current;
  const cardTranslate = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(heroOpacity, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(heroTranslate, {
          toValue: 0,
          duration: 520,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslate, {
          toValue: 0,
          duration: 520,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [cardOpacity, cardTranslate, heroOpacity, heroTranslate]);

  const handleSignIn = useCallback(() => {
    setNotice('OAuth sign-in will land here next.');
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <HeroUINativeProvider>
        <SafeAreaProvider>
          <SafeAreaView
            style={styles.safeArea}
            edges={['top', 'left', 'right']}
          >
            <StatusBar barStyle="dark-content" />
            <View style={styles.background}>
              <View style={styles.orbPrimary} />
              <View style={styles.orbSecondary} />
            </View>
            <ScrollView contentContainerStyle={styles.container}>
              <Animated.View
                style={[
                  styles.hero,
                  {
                    opacity: heroOpacity,
                    transform: [{ translateY: heroTranslate }],
                  },
                ]}
              >
                <Text style={styles.overline}>Fanfou</Text>
                <Text style={styles.title}>
                  A calmer way to read the timeline.
                </Text>
                <Text style={styles.subtitle}>
                  Built for focus, crafted for speed, and ready for iOS and
                  Android.
                </Text>
              </Animated.View>

              <Animated.View
                style={[
                  styles.card,
                  {
                    opacity: cardOpacity,
                    transform: [{ translateY: cardTranslate }],
                  },
                ]}
              >
                <Text style={styles.cardTitle}>Coming online soon</Text>
                <Text style={styles.cardCopy}>
                  We&apos;re stitching the essentials: login, timeline, and
                  posting.
                </Text>
                <View style={styles.chips}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>Chronological timeline</Text>
                  </View>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>Smart mentions</Text>
                  </View>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>Photo-first posting</Text>
                  </View>
                </View>
                <View style={styles.ctaRow}>
                  <View style={styles.cta}>
                    <Button onPress={handleSignIn}>Sign in with Fanfou</Button>
                  </View>
                </View>
                {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              </Animated.View>
            </ScrollView>
          </SafeAreaView>
        </SafeAreaProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
};

export default App;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f2ea',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  orbPrimary: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: '#e7f1ee',
    top: -120,
    right: -120,
    opacity: 0.8,
  },
  orbSecondary: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#ffe7c2',
    bottom: -110,
    left: -80,
    opacity: 0.9,
  },
  container: {
    padding: 24,
    gap: 24,
  },
  hero: {
    gap: 12,
  },
  overline: {
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#2b3a3f',
    fontFamily: 'Georgia',
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    color: '#142127',
    fontFamily: 'Georgia',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: '#42565c',
    fontFamily: 'Georgia',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: '#1b2428',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    color: '#16252a',
    fontFamily: 'Georgia',
  },
  cardCopy: {
    fontSize: 14,
    lineHeight: 20,
    color: '#455b61',
    fontFamily: 'Georgia',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#f1f6f5',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipText: {
    fontSize: 12,
    color: '#2a3a3f',
    fontFamily: 'Georgia',
  },
  ctaRow: {
    marginTop: 4,
  },
  cta: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  notice: {
    fontSize: 12,
    color: '#6c5a2f',
    fontFamily: 'Georgia',
  },
});
