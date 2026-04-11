#import <React/RCTBridgeModule.h>
#import <StoreKit/StoreKit.h>
#import <UIKit/UIKit.h>

@interface AppStoreProductModule : NSObject <RCTBridgeModule, SKStoreProductViewControllerDelegate>
@end

@implementation AppStoreProductModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

- (UIViewController *)rootViewController {
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if (![scene isKindOfClass:[UIWindowScene class]]) continue;
    UIWindowScene *windowScene = (UIWindowScene *)scene;
    if (windowScene.activationState != UISceneActivationStateForegroundActive) continue;
    UIViewController *root = windowScene.keyWindow.rootViewController;
    if (root) return root;
  }
  return nil;
}

RCT_EXPORT_METHOD(show:(NSString *)appId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  SKStoreProductViewController *vc = [[SKStoreProductViewController alloc] init];
  vc.delegate = self;

  NSDictionary *params = @{ SKStoreProductParameterITunesItemIdentifier: @([appId longLongValue]) };
  [vc loadProductWithParameters:params completionBlock:^(BOOL result, NSError *error) {
    if (error) {
      reject(@"load_failed", error.localizedDescription, error);
      return;
    }
    UIViewController *root = [self rootViewController];
    if (!root) {
      reject(@"no_root_vc", @"No active root view controller", nil);
      return;
    }
    [root presentViewController:vc animated:YES completion:^{
      resolve(nil);
    }];
  }];
}

- (void)productViewControllerDidFinish:(SKStoreProductViewController *)viewController {
  [viewController dismissViewControllerAnimated:YES completion:nil];
}

@end
