import { useMemo, useCallback } from 'react';
import { PanResponder, PanResponderInstance } from 'react-native';
import { TabActions, useNavigation, useNavigationState } from '@react-navigation/native';

type SwipeOptions = {
  distanceThreshold?: number;
  velocityThreshold?: number;
};

export const useTabSwipe = (options?: SwipeOptions): PanResponderInstance['panHandlers'] => {
  const navigation = useNavigation<any>();
  const { routes, index } = useNavigationState((state) => ({
    routes: state?.routes ?? [],
    index: state?.index ?? 0,
  }));

  const distanceThreshold = options?.distanceThreshold ?? 48;
  const velocityThreshold = options?.velocityThreshold ?? 0.2;

  const jumpToAdjacent = useCallback(
    (direction: number) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= routes.length) return;
      const nextRoute = routes[nextIndex];
      if (!nextRoute) return;
      navigation.dispatch(TabActions.jumpTo(nextRoute.name));
    },
    [index, navigation, routes]
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 10,
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) < distanceThreshold || Math.abs(gesture.vx) < velocityThreshold) return;
          jumpToAdjacent(gesture.dx > 0 ? -1 : 1);
        },
      }),
    [distanceThreshold, jumpToAdjacent, velocityThreshold]
  );

  return responder.panHandlers;
};

export default useTabSwipe;
