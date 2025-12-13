import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type AlertOptions = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
};

type AlertContextValue = {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

export function useCustomAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    // Fallback to native Alert if context not available
    return {
      showAlert: (options: AlertOptions) => {
        const { Alert } = require('react-native');
        Alert.alert(
          options.title,
          options.message,
          options.buttons?.map((b) => ({ text: b.text, style: b.style, onPress: b.onPress }))
        );
      },
      hideAlert: () => {},
    };
  }
  return ctx;
}

// Helper function to show alert without hook (for use in callbacks)
let _globalShowAlert: ((options: AlertOptions) => void) | null = null;

export function showGlobalAlert(options: AlertOptions) {
  if (_globalShowAlert) {
    _globalShowAlert(options);
  } else {
    // Fallback to native
    const { Alert } = require('react-native');
    Alert.alert(
      options.title,
      options.message,
      options.buttons?.map((b) => ({ text: b.text, style: b.style, onPress: b.onPress }))
    );
  }
}

export function CustomAlertProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<AlertOptions | null>(null);
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(0.9));

  const showAlert = useCallback((opts: AlertOptions) => {
    setOptions(opts);
    setVisible(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const hideAlert = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      setOptions(null);
    });
  }, [fadeAnim, scaleAnim]);

  // Register global alert function
  React.useEffect(() => {
    _globalShowAlert = showAlert;
    return () => { _globalShowAlert = null; };
  }, [showAlert]);

  const handleButtonPress = useCallback((button: AlertButton) => {
    Haptics.selectionAsync().catch(() => {});
    hideAlert();
    // Delay the callback slightly to allow animation to start
    setTimeout(() => {
      button.onPress?.();
    }, 50);
  }, [hideAlert]);

  const handleBackdropPress = useCallback(() => {
    // Only dismiss if there's a cancel button or no buttons
    const hasCancel = options?.buttons?.some((b) => b.style === 'cancel');
    const noButtons = !options?.buttons || options.buttons.length === 0;
    if (hasCancel || noButtons) {
      hideAlert();
    }
  }, [options, hideAlert]);

  const buttons = options?.buttons ?? [{ text: 'OK', style: 'default' as const }];

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleBackdropPress}
      >
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
            )}
          </Animated.View>
        </TouchableWithoutFeedback>
        
        <View style={styles.centerContainer} pointerEvents="box-none">
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.alertBox,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <View style={styles.contentContainer}>
                <Text style={styles.title}>{options?.title}</Text>
                {options?.message ? (
                  <Text style={styles.message}>{options.message}</Text>
                ) : null}
              </View>
              
              <View style={[styles.buttonContainer, buttons.length > 2 && styles.buttonContainerVertical]}>
                {buttons.map((button, index) => {
                  const isCancel = button.style === 'cancel';
                  const isDestructive = button.style === 'destructive';
                  const isLast = index === buttons.length - 1;
                  const showSeparator = buttons.length <= 2 && index < buttons.length - 1;
                  
                  return (
                    <React.Fragment key={index}>
                      <TouchableOpacity
                        style={[
                          styles.button,
                          buttons.length <= 2 ? styles.buttonHorizontal : styles.buttonVertical,
                          isLast && buttons.length > 2 && styles.buttonLast,
                        ]}
                        onPress={() => handleButtonPress(button)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.buttonText,
                            isCancel && styles.buttonTextCancel,
                            isDestructive && styles.buttonTextDestructive,
                            !isCancel && !isDestructive && styles.buttonTextDefault,
                          ]}
                        >
                          {button.text}
                        </Text>
                      </TouchableOpacity>
                      {showSeparator && <View style={styles.buttonSeparatorVertical} />}
                      {buttons.length > 2 && index < buttons.length - 1 && <View style={styles.buttonSeparatorHorizontal} />}
                    </React.Fragment>
                  );
                })}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  alertBox: {
    width: Math.min(SCREEN_WIDTH - 60, 320),
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.95)' : '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.2)',
  },
  buttonContainerVertical: {
    flexDirection: 'column',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonHorizontal: {
    flex: 1,
  },
  buttonVertical: {
    width: '100%',
  },
  buttonLast: {
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  buttonSeparatorVertical: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  buttonSeparatorHorizontal: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.2)',
    width: '100%',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '400',
  },
  buttonTextDefault: {
    color: '#007AFF',
    fontWeight: '600',
  },
  buttonTextCancel: {
    color: '#007AFF',
    fontWeight: '400',
  },
  buttonTextDestructive: {
    color: '#FF3B30',
    fontWeight: '400',
  },
});

export default CustomAlertProvider;
