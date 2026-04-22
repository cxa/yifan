import { useLayoutEffect } from 'react';
import { useNavigation, type ParamListBase } from '@react-navigation/native';
import { useThemeColor } from 'heroui-native';
import type {
  NativeStackNavigationOptions,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';

import { isNativeScrollEdgeEffectAvailable } from '@/navigation/native-scroll-edge';
import { useAppFontFamily } from '@/settings/app-font-preference';

type UseNativeHeaderTitleOptions = {
  title: string;
};

const HEADER_TITLE_FONT_SIZE = 17;

const useNativeHeaderTitle = ({ title }: UseNativeHeaderTitleOptions) => {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const [foreground] = useThemeColor(['foreground']);
  const headerFontFamily = useAppFontFamily();

  useLayoutEffect(() => {
    const headerOptions: NativeStackNavigationOptions = {
      title,
      headerLargeTitle: false,
      headerTransparent: true,
      headerStyle: { backgroundColor: 'transparent' },
      headerTintColor: foreground,
      headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: false,
      scrollEdgeEffects: isNativeScrollEdgeEffectAvailable
        ? { top: 'automatic' }
        : undefined,
      headerTitleStyle: {
        fontFamily: headerFontFamily,
        fontSize: HEADER_TITLE_FONT_SIZE,
        color: foreground,
      },
    };

    navigation.setOptions(headerOptions);
    // When the screen lives inside a nested stack whose header is
    // hidden (e.g. TagStack), the visible header belongs to the
    // parent navigator, so mirror the title up so the parent header
    // picks up the dynamic value too.
    navigation.getParent()?.setOptions({ title });
  }, [foreground, headerFontFamily, navigation, title]);
};

export default useNativeHeaderTitle;
