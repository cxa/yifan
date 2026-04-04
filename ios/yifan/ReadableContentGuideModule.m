#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <UIKit/UIKit.h>

@interface ReadableContentGuideModule : RCTEventEmitter <RCTBridgeModule>
@end

@implementation ReadableContentGuideModule {
  BOOL _hasListeners;
}

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

- (NSArray<NSString *> *)supportedEvents {
  return @[@"readableContentGuideDidChange"];
}

- (void)startObserving {
  _hasListeners = YES;
  [[NSNotificationCenter defaultCenter]
    addObserver:self
       selector:@selector(handleOrientationChange)
           name:UIDeviceOrientationDidChangeNotification
         object:nil];
  // Emit current insets shortly after JS subscribes — by this point the window
  // is fully laid out, unlike at module-load time when the window may not exist yet.
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.2 * NSEC_PER_SEC)),
                 dispatch_get_main_queue(), ^{
    if (!self->_hasListeners) return;
    NSDictionary *insets = [self readableContentInsets];
    if (insets) {
      [self sendEventWithName:@"readableContentGuideDidChange" body:insets];
    }
  });
}

- (void)stopObserving {
  _hasListeners = NO;
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)handleOrientationChange {
  if (!_hasListeners) return;

  UIDeviceOrientation orientation = [UIDevice currentDevice].orientation;
  // Ignore face-up / face-down / unknown — they don't change the screen layout.
  if (!UIDeviceOrientationIsPortrait(orientation) && !UIDeviceOrientationIsLandscape(orientation)) {
    return;
  }

  // The window bounds are updated at the START of the rotation transition (before
  // the visual animation plays), so layoutIfNeeded gives accurate new-orientation
  // values much earlier than the full animation duration (~400ms).
  // Fire at 100ms so the JS side can start animating to the correct readable
  // width while the rotation is still visually in progress.
  // A second shot at 400ms guards against any device where layout settles later.
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.1 * NSEC_PER_SEC)),
                 dispatch_get_main_queue(), ^{
    if (!self->_hasListeners) return;
    NSDictionary *insets = [self readableContentInsets];
    if (insets) {
      [self sendEventWithName:@"readableContentGuideDidChange" body:insets];
    }
  });
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.4 * NSEC_PER_SEC)),
                 dispatch_get_main_queue(), ^{
    if (!self->_hasListeners) return;
    NSDictionary *insets = [self readableContentInsets];
    if (insets) {
      [self sendEventWithName:@"readableContentGuideDidChange" body:insets];
    }
  });
}

- (UIWindow *)keyWindow {
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if (![scene isKindOfClass:[UIWindowScene class]]) continue;
    UIWindowScene *windowScene = (UIWindowScene *)scene;
    if (windowScene.activationState != UISceneActivationStateForegroundActive) continue;
    UIWindow *window = windowScene.keyWindow;
    if (window) return window;
  }
  return nil;
}

- (NSDictionary *)readableContentInsets {
  UIWindow *window = [self keyWindow];
  if (!window) return nil;

  // Force layout so the guide's constraints are resolved before we read the frame.
  [window layoutIfNeeded];

  CGFloat windowWidth  = window.bounds.size.width;
  CGFloat windowHeight = window.bounds.size.height;

  // Prefer rootViewController.view — it participates in the layout hierarchy
  // and consistently produces non-zero readable-content insets on iPad.
  UIView *referenceView = window.rootViewController.view ?: window;
  [referenceView layoutIfNeeded];
  CGRect guideInRef  = referenceView.readableContentGuide.layoutFrame;
  CGRect guide       = (referenceView == window)
    ? guideInRef
    : [referenceView convertRect:guideInRef toView:window];

  return @{
    @"left":   @(guide.origin.x),
    @"top":    @(guide.origin.y),
    @"right":  @(windowWidth  - CGRectGetMaxX(guide)),
    @"bottom": @(windowHeight - CGRectGetMaxY(guide)),
    @"width":  @(guide.size.width),
  };
}

RCT_EXPORT_METHOD(getReadableContentInsets:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSDictionary *insets = [self readableContentInsets];
  if (insets) {
    resolve(insets);
  } else {
    reject(@"no_window", @"No active key window", nil);
  }
}

@end
