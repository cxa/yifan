#import "EnvSecrets.h"
#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
#import <UIKit/UIKit.h>
#import <rn-fanfou-client/FanfouSecrets.h>

__attribute__((constructor)) static void FFConfigureFanfouSecrets(void) {
  NSString *consumerKey = FFConsumerKey();
  NSString *consumerSecret = FFConsumerSecret();
  if (consumerKey.length == 0 || consumerSecret.length == 0) {
    return;
  }
  FanfouSecretsConfigure(consumerKey, consumerSecret);
}

@interface SystemUiInfo : NSObject <RCTBridgeModule>
@end

@implementation SystemUiInfo

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (NSDictionary *)constantsToExport {
  BOOL homeIndicatorAutoHidden = NO;

  if (@available(iOS 11.0, *)) {
    UIViewController *viewController = RCTPresentedViewController();
    if (viewController != nil) {
      homeIndicatorAutoHidden = viewController.prefersHomeIndicatorAutoHidden;
    }
  }

  return @{
    @"homeIndicatorAutoHidden" : @(homeIndicatorAutoHidden),
  };
}

@end
