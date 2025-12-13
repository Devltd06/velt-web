import React from 'react';
import { View, ViewProps } from 'react-native';
import useTabSwipe from '@/hooks/useTabSwipe';

type Props = ViewProps & { swipeEnabled?: boolean };

const TabSwipeContainer: React.FC<Props> = ({ children, style, swipeEnabled = true, ...rest }) => {
  const panHandlers = swipeEnabled ? useTabSwipe() : {};

  return (
    <View {...rest} {...(panHandlers as any)} style={[{ flex: 1 }, style]}>
      {children}
    </View>
  );
};

export default TabSwipeContainer;
